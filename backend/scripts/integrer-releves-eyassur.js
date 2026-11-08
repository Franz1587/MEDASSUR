/* Intégration des relevés de factures Eyassur (= règlements maladie) dans MEDASSUR+.
 *
 * Usage : node scripts/integrer-releves-eyassur.js <fichier.ndjson> (--societe <id> | --societe-nom "<nom>") [--reprise] [--limit N] [--chunk N] [--rapport chemin.xlsx]
 *
 * --societe / --societe-nom : OBLIGATOIRE. Société propriétaire des données : les lignes créées par l'exécution
 *   (prises en charge, factures, règlements, prestataires créés) lui sont rattachées à la fin du script ;
 *   sans cela elles n'auraient aucun societeId et seraient invisibles pour ses utilisateurs.
 *
 * 1. Les factures (lignes) de chaque relevé sont importées via le moteur d'import global existant
 *    (ImportService.importerFacturesGlobal : résolution matricule/prestataire, doublons ignorés, FactureEnAttente).
 * 2. Chaque relevé devient un BordereauReglement "Reçu" (règlement maladie) rattaché à ses prises en charge ;
 *    la référence Eyassur (RLV…) est conservée dans `periode`, ce qui rend le script idempotent.
 * 3. Un rapport Excel indique, ligne par ligne, si la facture est réglée (bordereau payé) ou non.
 */
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { randomUUID } = require("crypto");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/src/app.module");
const { ImportService } = require("../dist/src/import/import.service");
const { PrismaService } = require("../dist/src/prisma/prisma.service");
const { montantNetPrisesEnCharge } = require("../dist/src/lib/montant-net.util");

const args = process.argv.slice(2);
const entree = args.find((a) => /\.ndjson$/i.test(a));
const opt = (nom, def) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : def; };
const SOCIETE_ID = opt("--societe", "");
const SOCIETE_NOM = opt("--societe-nom", "");
const REPRISE = args.includes("--reprise");
const FICHIER_RESILIES = path.join(process.env.TEMP || __dirname, "reprise-contrats-resilies.json");
const LIMITE = Number(opt("--limit", 0)) || 0;
const TAILLE_LOT = Number(opt("--chunk", 250));
const RAPPORT = opt("--rapport", path.join(__dirname, "..", "..", `RAPPORT-RELEVES-EYASSUR-${new Date().toISOString().slice(0, 10)}.xlsx`));

const chiffres = (s) => Number(String(s ?? "").replace(/\D/g, "")) || 0;
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const jour = (s) => (String(s ?? "").match(/\d\d\/\d\d\/\d{2,4}/) || [""])[0];
const annee4 = (d) => d.replace(/^(\d\d\/\d\d\/)(\d\d)$/, "$120$2");
const motsTries = (s) => norm(s).split(" ").filter(Boolean).sort().join(" ");

async function main() {
  if (!entree) throw new Error("Fichier .ndjson requis.");
  if (!SOCIETE_ID && !SOCIETE_NOM) throw new Error('Option obligatoire : --societe <id> ou --societe-nom "<nom>" (société propriétaire des données).');
  let releves = fs.readFileSync(entree, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const vus = new Set();
  releves = releves.filter((r) => (vus.has(r.ref) ? false : vus.add(r.ref)));
  // Lignes vides (relevé dont le tableau de factures n'a pas pu être lu) : jamais des données.
  releves.forEach((r) => { r.lignes = r.lignes.filter((l) => l.reference || l.matricule || l.beneficiaire); });
  releves.sort((a, b) => a.ref.localeCompare(b.ref));
  if (LIMITE) releves = releves.slice(0, LIMITE);
  console.log(`Relevés à traiter : ${releves.length}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const importService = app.get(ImportService);
  const prisma = app.get(PrismaService);
  // La séquence peut être en retard sur les numéros déjà utilisés (reprises d'antériorité) : on la recale.
  await prisma.$executeRawUnsafe(`SELECT setval('reglement_numero_seq', GREATEST((SELECT last_value FROM reglement_numero_seq), COALESCE((SELECT max(replace(numero, ' ', '')::bigint) FROM "BordereauReglement" WHERE replace(numero, ' ', '') ~ '^[0-9]+$'), 1)))`);

  // ── Mode reprise de données : les contrôles de saisie courante ne doivent pas écarter des factures déjà traitées. ──
  // 1) « Saisie après résiliation autorisée » (mécanisme prévu par la fiche contrat) activée le temps de l'import,
  //    puis restaurée ; la liste est écrite sur disque pour pouvoir restaurer même après un arrêt brutal.
  const restaurerResilies = async () => {
    if (!fs.existsSync(FICHIER_RESILIES)) return;
    const ids = JSON.parse(fs.readFileSync(FICHIER_RESILIES, "utf8"));
    for (let i = 0; i < ids.length; i += 1000) await prisma.contrat.updateMany({ where: { id: { in: ids.slice(i, i + 1000) } }, data: { saisieApresResiliationAutorisee: false } });
    fs.unlinkSync(FICHIER_RESILIES);
    console.log(`Autorisation de saisie après résiliation restaurée sur ${ids.length} contrats.`);
  };
  await restaurerResilies();
  if (REPRISE) {
    const resilies = await prisma.contrat.findMany({ where: { statut: "Résilié", saisieApresResiliationAutorisee: false }, select: { id: true } });
    fs.writeFileSync(FICHIER_RESILIES, JSON.stringify(resilies.map((c) => c.id)));
    for (let i = 0; i < resilies.length; i += 1000) await prisma.contrat.updateMany({ where: { id: { in: resilies.slice(i, i + 1000).map((c) => c.id) } }, data: { saisieApresResiliationAutorisee: true } });
    console.log(`Saisie après résiliation autorisée temporairement sur ${resilies.length} contrats.`);
    // 2) Le contrôle « contrat connu à la date d'après l'historique de rattachement » (avenants) est neutralisé
    //    dans CE processus uniquement : une reprise ne doit pas rejeter une facture déjà payée.
    prisma.$use(async (params, next) => {
      if (params.model === "AvenantAssure" && params.action === "findMany" && params.args?.where && Object.keys(params.args.where).join() === "assureId" && Array.isArray(params.args.orderBy)) return [];
      const res = await next(params);
      // Même matricule dupliqué sur deux contrats d'une MÊME police (population doublonnée) : on retient le premier contrat.
      if (params.model === "AssureSante" && params.action === "findMany" && params.args?.where?.matricule?.in && Array.isArray(res)) {
        const vus = new Set();
        return res.slice().sort((a, b) => String(a.contratId).localeCompare(String(b.contratId))).filter((a) => {
          const k = `${String(a.matricule ?? "").trim().toLowerCase()}|${a.contrat?.numeroPolice?.trim().toLowerCase() ?? `id:${a.contratId}`}`;
          if (vus.has(k)) return false;
          vus.add(k);
          return true;
        });
      }
      return res;
    });
  }
  const dateFr = (s) => { const m = String(s ?? "").match(/(\d\d)\/(\d\d)\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null; };
  // Matricule porté par plusieurs polices : on retient celle qui couvre la date de la prestation.
  const choisirPolice = (cands, datePrest) => {
    const d = dateFr(datePrest);
    const score = (a) => {
      const debut = dateFr(a.dateAffiliation), fin = dateFr(a.dateRadiation);
      return (d && debut && d >= debut && (!fin || d <= fin) ? 4 : 0) + (a.statut === "Actif" ? 2 : 0) + (["Actif", "En renouvellement"].includes(a.contrat?.statut) ? 1 : 0);
    };
    return [...cands].sort((a, b) => score(b) - score(a) || (dateFr(b.dateAffiliation) ?? 0) - (dateFr(a.dateAffiliation) ?? 0))[0];
  };
  try {
    const societe = SOCIETE_ID
      ? await prisma.societeAssurance.findUnique({ where: { id: SOCIETE_ID }, select: { id: true, nom: true } })
      : await prisma.societeAssurance.findFirst({ where: { nom: { equals: SOCIETE_NOM, mode: "insensitive" } }, select: { id: true, nom: true } });
    if (!societe) throw new Error("Société introuvable.");
    console.log(`Société : ${societe.nom} (${societe.id})`);
    // L'import s'exécute SANS contexte tenant (le filtrage par société masquerait des lignes déjà présentes et
    // provoquerait des doublons) ; les lignes créées sont rattachées à la société à la fin, par SQL.
    const debutRun = new Date();
    await (async () => {
    // Lignes sans matricule dans Eyassur : bénéficiaire identifié par son nom complet (jamais en cas d'ambiguïté).
    const sansMatricule = releves.flatMap((r) => r.lignes).filter((l) => !String(l.matricule ?? "").trim() && l.beneficiaire?.trim());
    let matriculesRetrouves = 0;
    for (const l of sansMatricule) {
      const mots = norm(l.beneficiaire).split(" ").filter((w) => w.length > 1).sort((a, b) => b.length - a.length);
      if (!mots.length) continue;
      const trouves = await prisma.assureSante.findMany({ where: { OR: [{ nom: { contains: mots[0], mode: "insensitive" } }, { prenom: { contains: mots[0], mode: "insensitive" } }] }, select: { matricule: true, nom: true, prenom: true }, take: 300 });
      const exacts = [...new Set(trouves.filter((a) => motsTries(`${a.nom} ${a.prenom ?? ""}`) === motsTries(l.beneficiaire) && a.matricule).map((a) => a.matricule))];
      if (exacts.length === 1) { l.matricule = exacts[0]; matriculesRetrouves++; }
    }
    if (sansMatricule.length) console.log(`Lignes sans matricule : ${sansMatricule.length}, identifiées par le nom : ${matriculesRetrouves}`);
  const resume = { releves: 0, bordereauxCrees: 0, bordereauxExistants: 0, bordereauxCompletes: 0, sansLigneRattachable: 0, lignes: 0, importees: 0, dejaPresentes: 0, enAttente: 0, rejetees: 0, nonRetrouvees: 0, reglees: 0, nonReglees: 0, relevesHorsPrestataire: 0 };
  const rapportLignes = [];
  const rapportReleves = [];

  for (let debut = 0; debut < releves.length; debut += TAILLE_LOT) {
    const lot = releves.slice(debut, debut + TAILLE_LOT);

    // Relevés déjà intégrés — détection par le numéro (= référence Eyassur).
    const dejaCrees = new Map();
    for (const r of lot) {
      const b = await prisma.bordereauReglement.findFirst({ where: { numero: r.ref }, select: { id: true, numero: true, statut: true, datePaiement: true } });
      if (b) dejaCrees.set(r.ref, b);
    }

    // ── 1. Import des lignes de factures ──
    // Lignes déjà représentées par une prise en charge existante (même facture, prestataire, date et montant,
    // en frais réels OU en base remboursée) : jamais renvoyées à l'import, qui en créerait une copie.
    const lignesLot = lot.flatMap((r) => r.lignes);
    const prestLot = await importService.resoudrePrestatairesEnLot([...new Set(lignesLot.map((l) => l.prestataire.replace(/\s+/g, " ").trim()))]);
    const nomPrest = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    const facsLot = await prisma.facture.findMany({ where: { referenceFacture: { in: [...new Set(lignesLot.map((l) => l.reference.trim()))] } }, select: { id: true, referenceFacture: true, prestataire: { select: { nom: true } } } });
    const facParId = new Map(facsLot.map((f) => [f.id, f]));
    const pecLot = facsLot.length === 0 ? [] : await prisma.priseEnCharge.findMany({ where: { factureId: { in: facsLot.map((f) => f.id) }, statut: { not: "Annulé" } }, select: { id: true, factureId: true, date: true, montant: true, baseRemboursement: true } });
    const idxPec = new Map();
    for (const pe of pecLot) {
      const f = facParId.get(pe.factureId);
      for (const m of new Set([Number(pe.montant), Number(pe.baseRemboursement ?? pe.montant)])) {
        const k = `${nomPrest(f.prestataire.nom)}|${f.referenceFacture}|${pe.date}|${m}`;
        if (!idxPec.has(k)) idxPec.set(k, []);
        idxPec.get(k).push(pe);
      }
    }
    const consommees = new Set();
    const representees = new Set();
    for (const l of lignesLot) {
      const prest = prestLot.get(l.prestataire.replace(/\s+/g, " ").trim());
      if (!prest) continue;
      const dispo = (idxPec.get(`${nomPrest(prest.nom)}|${l.reference.trim()}|${annee4(jour(l.datePrestation))}|${chiffres(l.aPayer)}`) ?? []).find((pe) => !consommees.has(pe.id));
      if (dispo) { consommees.add(dispo.id); representees.add(l); }
    }
    const aImporter = [];
    for (const r of lot) for (const l of r.lignes) if (!representees.has(l)) aImporter.push({ releve: r, ligne: l });
    const resultatImport = new Map(); // ligne Eyassur -> dernier motif de rejet
    for (const l of representees) resultatImport.set(l, "Déjà importée — ligne déjà présente dans MEDASSUR+.");
    if (aImporter.length > 0) {
      // Police compagnie : pour un matricule porté par plusieurs polices, celle qui couvre la date de la prestation.
      const policeParLigne = new Map();
      if (REPRISE) {
        const mats = [...new Set(aImporter.map(({ ligne }) => ligne.matricule.trim()))];
        const parMat = new Map();
        const rowsA = await prisma.assureSante.findMany({
          where: { matricule: { in: mats, mode: "insensitive" } },
          select: { matricule: true, statut: true, dateAffiliation: true, dateRadiation: true, contrat: { select: { numeroPolice: true, statut: true } } },
        });
        for (const a of rowsA) { const k = a.matricule.trim().toLowerCase(); if (!parMat.has(k)) parMat.set(k, []); parMat.get(k).push(a); }
        for (const { ligne } of aImporter) {
          const cands = parMat.get(ligne.matricule.trim().toLowerCase()) ?? [];
          const polices = new Set(cands.map((a) => a.contrat?.numeroPolice?.trim().toLowerCase()).filter(Boolean));
          const actifs = cands.filter((a) => a.statut === "Actif" && ["Actif", "En renouvellement"].includes(a.contrat?.statut));
          if (cands.length > 1 && (polices.size > 1 || actifs.length !== 1)) {
            const choix = choisirPolice(cands, annee4(jour(ligne.datePrestation)));
            if (choix?.contrat?.numeroPolice) policeParLigne.set(ligne, choix.contrat.numeroPolice);
          }
        }
      }
      let restantes = aImporter.map((x, i) => i);
      for (let passe = 1; passe <= 4 && restantes.length > 0; passe++) {
        const classeur = new ExcelJS.Workbook();
        const feuille = classeur.addWorksheet("Factures");
        const colonnes = importService.COLONNES_FACTURE_GLOBALE;
        feuille.addRow(colonnes.map((c) => c.header));
        for (const i of restantes) {
          const l = aImporter[i].ligne;
          const valeurs = {
            matricule: l.matricule, numeroPolice: policeParLigne.get(l) ?? "", prestataire: l.prestataire.replace(/\s+/g, " ").trim(), referenceFacture: l.reference,
            dateReception: jour(l.dateReception), typePrestation: l.categorie, datePrestation: annee4(jour(l.datePrestation)),
            montant: chiffres(l.aPayer), quantite: 1, statut: "Accepté", beneficiaire: l.beneficiaire,
          };
          feuille.addRow(colonnes.map((c) => valeurs[c.key] ?? ""));
        }
        const buffer = Buffer.from(await classeur.xlsx.writeBuffer());
        const res = await importService.importerFacturesGlobal(buffer);
        const motifs = new Map(res.rejets.map((rej) => [rej.ligne - 2, rej.motif]));
        const aRejouer = [];
        restantes.forEach((i, pos) => {
          const motif = motifs.get(pos);
          if (motif === undefined) { resultatImport.delete(aImporter[i].ligne); return; }
          resultatImport.set(aImporter[i].ligne, motif);
          // Collisions d'identifiants aléatoires (PC-/FAC-) : transitoires, on rejoue.
          if (/Unique constraint failed on the fields: \(`id`\)|Impossible de créer l'en-tête de facture/.test(motif)) aRejouer.push(i);
        });
        resume.importees += res.crees; if (passe === 1) resume.enAttente += res.enAttente;
        console.log(`  lot ${debut / TAILLE_LOT + 1} passe ${passe}: ${restantes.length} lignes → créées ${res.crees}, en attente ${res.enAttente}, corrigées ${res.corrigees ?? 0}, rejets ${res.rejets.length}`);
        restantes = aRejouer;
      }
    }
    const indexImport = new Map(aImporter.map((x, i) => [x.ligne, i]));

    // ── 2. Rapprochement ligne Eyassur ↔ prise en charge MEDASSUR+ ──
    const toutesLignes = lot.flatMap((r) => r.lignes.map((l) => ({ r, l })));
    const nomsPrest = [...new Set(toutesLignes.map(({ l }) => l.prestataire.replace(/\s+/g, " ").trim()))];
    const prestataireParNom = await importService.resoudrePrestatairesEnLot(nomsPrest);
    const matricules = [...new Set(toutesLignes.map(({ l }) => l.matricule.trim()))];
    const assures = await prisma.assureSante.findMany({ where: { matricule: { in: matricules, mode: "insensitive" } }, select: { id: true, matricule: true } });
    const candidats = new Map();
    const ajouterCandidat = (m, id) => { const k = m.trim().toLowerCase(); if (!candidats.has(k)) candidats.set(k, new Set()); candidats.get(k).add(id); };
    assures.forEach((a) => ajouterCandidat(a.matricule, a.id));
    const nonResolus = matricules.filter((m) => !candidats.has(m.trim().toLowerCase()));
    if (nonResolus.length > 0) {
      const alias = await prisma.matriculeAssuree.findMany({ where: { matricule: { in: nonResolus, mode: "insensitive" } }, select: { matricule: true, identiteId: true } });
      if (alias.length > 0) {
        const parIdentite = await prisma.assureSante.findMany({ where: { identiteId: { in: [...new Set(alias.map((a) => a.identiteId))] } }, select: { id: true, identiteId: true } });
        for (const a of alias) parIdentite.filter((p) => p.identiteId === a.identiteId).forEach((p) => ajouterCandidat(a.matricule, p.id));
      }
    }
    const refs = [...new Set(toutesLignes.map(({ l }) => l.reference.trim()))];
    const factures = await prisma.facture.findMany({ where: { referenceFacture: { in: refs } }, select: { id: true, referenceFacture: true, prestataire: { select: { nom: true } } } });
    const factureParId = new Map(factures.map((f) => [f.id, f]));
    const pecs = factures.length === 0 ? [] : await prisma.priseEnCharge.findMany({
      where: { factureId: { in: factures.map((f) => f.id) }, statut: { not: "Annulé" } },
      select: { id: true, factureId: true, assureId: true, date: true, montant: true, baseRemboursement: true, montantTps: true, bordereauId: true, createdAt: true, assure: { select: { nom: true, prenom: true } }, bordereau: { select: { id: true, numero: true, statut: true, datePaiement: true } } },
      orderBy: { createdAt: "asc" },
    });
    const indexPec = new Map();
    for (const p of pecs) {
      const f = factureParId.get(p.factureId);
      for (const m of new Set([Number(p.montant), Number(p.baseRemboursement ?? p.montant)])) {
        const cle = `${nomPrest(f.prestataire.nom)}|${f.referenceFacture}|${p.date}|${m}`;
        if (!indexPec.has(cle)) indexPec.set(cle, []);
        indexPec.get(cle).push(p);
      }
    }
    const enAttente = matricules.length === 0 ? [] : await prisma.factureEnAttente.findMany({ where: { matricule: { in: matricules } }, select: { matricule: true, referenceFacture: true, datePrestation: true, montant: true } });
    const attenteCles = new Set(enAttente.map((e) => `${e.matricule.toLowerCase()}|${e.referenceFacture}|${e.datePrestation}|${Number(e.montant)}`));

    const utilisees = new Set();
    const pecParLigne = new Map();
    for (const { r, l } of toutesLignes) {
      const prest = prestataireParNom.get(l.prestataire.replace(/\s+/g, " ").trim());
      const m = chiffres(l.aPayer);
      const datePrest = annee4(jour(l.datePrestation));
      const liste = prest ? (indexPec.get(`${nomPrest(prest.nom)}|${l.reference.trim()}|${datePrest}|${m}`) ?? []) : [];
      const cands = candidats.get(l.matricule.trim().toLowerCase());
      const nomBenef = motsTries(l.beneficiaire);
      const libres = liste.filter((p) => !utilisees.has(p.id));
      const pec = libres.find((p) => cands?.has(p.assureId)) ?? libres.find((p) => motsTries(`${p.assure?.prenom ?? ""} ${p.assure?.nom ?? ""}`) === nomBenef) ?? null;
      if (pec) { utilisees.add(pec.id); pecParLigne.set(l, pec); }
    }

    // ── 3. Un règlement maladie (bordereau "Reçu") par relevé ──
    for (const r of lot) {
      resume.releves++;
      const nomPrest = r.concerne.replace(/\s+/g, " ").trim();
      let bordereau = dejaCrees.get(r.ref) ?? null;
      let creation = false;
      const aRattacher = r.lignes.map((l) => pecParLigne.get(l)).filter((p) => p && !p.bordereauId);
      if (!bordereau) {
        if (r.type !== "Prestataire") {
          resume.relevesHorsPrestataire++;
        } else if (aRattacher.length === 0) {
          resume.sansLigneRattachable++;
        } else {
          const prest = prestataireParNom.get(nomPrest);
          if (prest) {
            const numero = r.ref;
            const dateRec = jour(r.dc);
            bordereau = await prisma.bordereauReglement.create({
              data: {
                id: `BDX-${randomUUID().slice(0, 8).toUpperCase()}`, numero, prestataireId: prest.id,
                periode: dateRec, nbPrisesEnCharge: aRattacher.length, montantTotal: montantNetPrisesEnCharge(aRattacher),
                montantValide: montantNetPrisesEnCharge(aRattacher),
                statut: "Validé", dateReception: dateRec,
                prisesEnCharge: { connect: aRattacher.map((p) => ({ id: p.id })) },
              },
              select: { id: true, numero: true, statut: true, datePaiement: true },
            });
            creation = true;
            resume.bordereauxCrees++;
            for (const p of aRattacher) p.bordereau = bordereau;
          }
        }
      } else {
        resume.bordereauxExistants++;
        // Règlement déjà créé : on y rattache les lignes récupérées depuis (reprise), tant qu'il n'est pas payé.
        if (bordereau.statut !== "Payé" && aRattacher.length > 0) {
          await prisma.bordereauReglement.update({ where: { id: bordereau.id }, data: { prisesEnCharge: { connect: aRattacher.map((p) => ({ id: p.id })) } } });
          const toutes = await prisma.priseEnCharge.findMany({ where: { bordereauId: bordereau.id }, select: { baseRemboursement: true, montantTps: true } });
          await prisma.bordereauReglement.update({ where: { id: bordereau.id }, data: { nbPrisesEnCharge: toutes.length, montantTotal: montantNetPrisesEnCharge(toutes) } });
          for (const p of aRattacher) p.bordereau = bordereau;
          resume.bordereauxCompletes++;
        }
      }

      let nbReglees = 0, nbNonReglees = 0, nbSansPec = 0;
      for (const l of r.lignes) {
        resume.lignes++;
        const pec = pecParLigne.get(l);
        const motifRejet = resultatImport.get(l);
        let etatImport, etatReglement;
        if (pec) {
          etatImport = motifRejet && /Déjà importée/i.test(motifRejet) ? "Déjà présente dans MEDASSUR+" : "Importée";
          const b = pec.bordereau;
          if (b && b.statut === "Payé") { etatReglement = `Réglée — règlement n° ${b.numero}${b.datePaiement ? ` payé le ${b.datePaiement}` : ""}`; nbReglees++; resume.reglees++; }
          else if (b) { etatReglement = `Non réglée — règlement maladie n° ${b.numero} (${b.statut})`; nbNonReglees++; resume.nonReglees++; }
          else { etatReglement = "Non réglée — aucun règlement"; nbNonReglees++; resume.nonReglees++; }
          if (/Déjà présente/.test(etatImport)) resume.dejaPresentes++;
        } else {
          nbSansPec++;
          if (attenteCles.has(`${l.matricule.toLowerCase()}|${l.reference.trim()}|${annee4(jour(l.datePrestation))}|${chiffres(l.aPayer)}`)) { etatImport = "En attente — matricule inconnu de MEDASSUR+"; etatReglement = "Non réglée"; }
          else if (motifRejet) { etatImport = `Rejetée — ${motifRejet}`; etatReglement = "Non réglée"; resume.rejetees++; }
          else { etatImport = "Non retrouvée dans MEDASSUR+"; etatReglement = "Non réglée"; resume.nonRetrouvees++; }
        }
        rapportLignes.push([r.ref, jour(r.dc), nomPrest, l.reference, l.beneficiaire, l.matricule, annee4(jour(l.datePrestation)), chiffres(l.aPayer), l.categorie, etatImport, etatReglement, bordereau?.numero ?? ""]);
      }
      rapportReleves.push([r.ref, jour(r.dc), nomPrest, r.type, chiffres(r.montant), r.lignes.length, nbReglees, nbNonReglees, nbSansPec, bordereau ? bordereau.numero : "", bordereau ? bordereau.statut : (r.type !== "Prestataire" ? "Hors prestataire (non créé)" : "Non créé"), creation ? "Créé" : (bordereau ? "Déjà existant" : "")]);
    }
  }

  const classeur = new ExcelJS.Workbook();
  const f1 = classeur.addWorksheet("Relevés");
  f1.addRow(["Relevé Eyassur", "Date", "Prestataire / concerné", "Type", "Montant Eyassur (FCFA)", "Nb factures Eyassur", "Réglées", "Non réglées", "Non intégrées", "N° règlement MEDASSUR+", "Statut règlement", "Création"]);
  rapportReleves.forEach((x) => f1.addRow(x));
  const f2 = classeur.addWorksheet("Factures");
  f2.addRow(["Relevé Eyassur", "Date relevé", "Prestataire", "Réf. facture", "Bénéficiaire", "Matricule", "Date prestation", "À payer (FCFA)", "Catégorie", "Intégration MEDASSUR+", "État du règlement", "N° règlement"]);
  rapportLignes.forEach((x) => f2.addRow(x));
  const f3 = classeur.addWorksheet("Synthèse");
  Object.entries(resume).forEach(([k, v]) => f3.addRow([k, v]));
  [f1, f2, f3].forEach((f) => { f.getRow(1).font = { bold: true }; f.columns.forEach((c) => { c.width = 24; }); });
  await classeur.xlsx.writeFile(RAPPORT);
  console.log("Synthèse", JSON.stringify(resume, null, 1));
  console.log("Rapport :", RAPPORT);
    })();
    // Rattachement à la société des lignes créées par cette exécution (sinon invisibles pour ses utilisateurs).
    const depuis = debutRun.toISOString().slice(0, -1); // createdAt est stocké en UTC (timestamp sans fuseau)
    const maj = {
      priseEnCharge: await prisma.$executeRawUnsafe(`UPDATE "PriseEnCharge" SET "societeId"=$1 WHERE "societeId" IS NULL AND "createdAt" >= $2::timestamp`, societe.id, depuis),
      factures: await prisma.$executeRawUnsafe(`UPDATE "Facture" SET "societeId"=$1 WHERE "societeId" IS NULL AND "createdAt" >= $2::timestamp`, societe.id, depuis),
      facturesEnAttente: await prisma.$executeRawUnsafe(`UPDATE "FactureEnAttente" SET "societeId"=$1 WHERE "societeId" IS NULL AND "createdAt" >= $2::timestamp`, societe.id, depuis),
      reglements: await prisma.$executeRawUnsafe(`UPDATE "BordereauReglement" SET "societeId"=$1 WHERE "societeId" IS NULL AND numero LIKE 'RLV%'`, societe.id),
      prestataires: await prisma.$executeRawUnsafe(`UPDATE "Prestataire" SET "societeId"=$1 WHERE "societeId" IS NULL AND id IN (SELECT DISTINCT "prestataireId" FROM "PriseEnCharge" WHERE "createdAt" >= $2::timestamp AND "prestataireId" IS NOT NULL)`, societe.id, depuis),
    };
    console.log("Rattachées à la société :", JSON.stringify(maj));
    // Le moteur d'import réinsère les lignes « en attente » à chaque exécution : on supprime les doublons.
    const doublonsAttente = await prisma.$executeRawUnsafe(`DELETE FROM "FactureEnAttente" WHERE id IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY matricule, prestataire, "referenceFacture", "datePrestation", montant, "dateReception" ORDER BY "createdAt", id) rn FROM "FactureEnAttente") t WHERE rn > 1)`);
    console.log("Doublons « en attente » supprimés :", doublonsAttente);
  } finally {
    await restaurerResilies();
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
