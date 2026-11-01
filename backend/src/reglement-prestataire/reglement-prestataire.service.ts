import { TenantContext } from "../tenant/tenant-context";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GenererBordereauDto } from "./dto/generer-bordereau.dto";
import { PayerBordereauDto } from "./dto/payer-bordereau.dto";
import { montantNetPrisesEnCharge } from "../lib/montant-net.util";

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

@Injectable()
export class ReglementPrestataireService {
  constructor(private prisma: PrismaService) {}

  // lettreCheque.banque — pour que l'écran "Règlements établis" affiche
  // directement, sans recherche, la référence de chèque ET la banque si ce
  // règlement a déjà été payé par chèque (voir demande utilisateur, écran
  // src/features/reglement-prestataire).
  // Liste allégée et paginée (2026-11, mesuré en prod : 8 237 règlements
  // renvoyés AVEC toutes leurs lignes = 3 Mo compressés, 7 s) — l'écran
  // n'affiche que nbPrisesEnCharge, jamais les lignes elles-mêmes.
  async findAll(page?: number, taille = 25) {
    const args = {
      select: {
        id: true, numero: true, prestataireId: true, periode: true, nbPrisesEnCharge: true, montantTotal: true, montantValide: true,
        statut: true, dateReception: true, datePaiement: true, referenceVirement: true, medecinId: true, transactionEbillingId: true,
        prestataire: { select: { nom: true, telephone: true } },
        medecin: { select: { nom: true, prenom: true, titre: true } },
        lettreCheque: { select: { numero: true, numeroCheque: true, banque: { select: { nom: true } } } },
        // Mobile Money (2026-10) — référence de la Transaction liée
        transactionEbilling: { select: { reference: true } },
      },
      orderBy: { dateReception: "desc" as const },
    };
    if (!page) return this.prisma.bordereauReglement.findMany(args);
    const [items, total] = await Promise.all([
      this.prisma.bordereauReglement.findMany({ ...args, skip: (page - 1) * taille, take: taille }),
      this.prisma.bordereauReglement.count(),
    ]);
    return { items, total, page, taille };
  }

  // Détail complet — écran de consultation d'un règlement (voir
  // ReglementDetail côté frontend) : chaque ligne porte sa Facture et,
  // quand il a déjà été généré, le numéro du Décompte correspondant
  // (couple Facture/assuré, voir DocumentsService.obtenirOuCreerDecompte).
  async findOne(id: string) {
    const bordereau = await this.prisma.bordereauReglement.findUnique({
      where: { id },
      include: {
        prestataire: true,
        medecin: true,
        // Agence de l'agent qui a établi le règlement (2026-09) — voir
        // demande utilisateur : "lier un agent de saisie à une agence...
        // afin que ce soit cette agence qui remonte sur le décompte" (même
        // règle sur le Règlement, voir DocumentsService.renderReglement).
        creePar: { include: { agence: true } },
        prisesEnCharge: { include: { assure: true, facture: true, acteMedical: true }, orderBy: { date: "asc" } },
      },
    });
    if (!bordereau) throw new NotFoundException(`Bordereau ${id} introuvable`);

    // Par facture puis appariement en mémoire (voir historique() : limite de paramètres PostgreSQL).
    const factureIds = [...new Set(bordereau.prisesEnCharge.map((l) => l.factureId).filter((id): id is string => !!id))];
    const decomptes = [];
    for (let i = 0; i < factureIds.length; i += 5000) {
      decomptes.push(...await this.prisma.decompte.findMany({ where: { factureId: { in: factureIds.slice(i, i + 5000) } }, select: { factureId: true, assureId: true, numero: true } }));
    }
    const decompteParPaire = new Map(decomptes.map((d) => [`${d.factureId}::${d.assureId}`, d.numero]));

    return {
      ...bordereau,
      prisesEnCharge: bordereau.prisesEnCharge.map((l) => ({
        ...l,
        decompteNumero: l.factureId ? decompteParPaire.get(`${l.factureId}::${l.assureId}`) ?? null : null,
      })),
    };
  }

  /**
   * Regroupe les prises en charge non réglées des factures sélectionnées
   * (voir FacturesService.findEligiblesReglement / écran de recherche) en
   * un nouveau bordereau de règlement. Le montant, le nombre de lignes et
   * la période sont calculés à partir des données réelles, jamais saisis
   * manuellement.
   */
  // creeParId (2026-09) — voir demande utilisateur : "il faut que le
  // système puisse retracer qui fait quoi dans l'application". Capturé
  // depuis l'utilisateur connecté qui établit le règlement (voir
  // ReglementPrestataireController.genererBordereau), imprimé sur le
  // Règlement à la place de la mention fixe "OL" du modèle papier (voir
  // DocumentsService.renderReglement).
  async genererBordereau(dto: GenererBordereauDto, creeParId?: string) {
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId } });
    if (!prestataire) throw new NotFoundException(`Prestataire ${dto.prestataireId} introuvable`);

    // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur
    // ci-dessus : vérifie que le médecin choisi intervient bien dans cette
    // structure, pour ne jamais établir un règlement à l'ordre de quelqu'un
    // d'étranger à l'établissement réglé.
    if (dto.medecinId) {
      const lien = await this.prisma.medecinPrestataire.findUnique({ where: { medecinId_prestataireId: { medecinId: dto.medecinId, prestataireId: dto.prestataireId } } });
      if (!lien) throw new BadRequestException(`Ce médecin n'intervient pas dans la structure ${prestataire.nom}.`);
    }

    // Une ligne dont la Facture a été annulée, ou déjà rattachée à un
    // bordereau, ne peut pas intégrer ce nouveau règlement (voir
    // FacturesService.annuler / findEligiblesReglement).
    const prises = await this.prisma.priseEnCharge.findMany({
      where: { prestataireId: dto.prestataireId, bordereauId: null, factureId: { in: dto.factureIds }, facture: { statut: { not: "Annulée" } } },
      include: { facture: true },
    });
    if (prises.length === 0) {
      throw new BadRequestException("Aucune prise en charge non réglée pour les factures sélectionnées.");
    }
    const factureIdsTrouvees = new Set(prises.map((p) => p.factureId));
    const manquantes = dto.factureIds.filter((fid) => !factureIdsTrouvees.has(fid));
    if (manquantes.length > 0) {
      throw new BadRequestException(`Facture(s) déjà réglée(s) entre-temps ou introuvable(s) : ${manquantes.join(", ")}`);
    }

    // Montant NET (base remboursement − TPS), jamais les frais réels bruts
    // (2026-09) — voir demande utilisateur : "les informations du règlement
    // maladie ne sont pas en harmonie avec les autres données de la chaîne
    // de traitement et règlement d'une facture". `montantTotal` servait
    // jusqu'ici de frais réel facturé, alors que le PDF Règlement affiche un
    // "Net à Payer" recalculé depuis les lignes, le chèque réel
    // (ReglementComptableService) recalculait ENCORE ce même net séparément,
    // et le lettrage bancaire utilisait le frais réel — trois valeurs
    // différentes pour un seul règlement. `montantTotal`/`montantValide`
    // portent désormais la même règle partout (voir montantNetPrisesEnCharge).
    const montantTotal = montantNetPrisesEnCharge(prises);
    const id = `BDX-${randomUUID().slice(0, 8).toUpperCase()}`;
    // "N° Ordre Mvt" du modèle papier fourni ("Modèle Règlement.pdf") : un
    // simple compteur (espace comme séparateur de milliers, ex "12 835"),
    // sans préfixe ni année — tiré de la séquence Postgres
    // `reglement_numero_seq`, atomique sous accès concurrents et jamais
    // remise à zéro (voir schema.prisma BordereauReglement.numero).
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('reglement_numero_seq') AS nextval`;
    const numero = nextval.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    // Période dérivée des dates de réception réelles des factures
    // incluses — reflète le lot effectivement réglé plutôt qu'une saisie
    // libre potentiellement incohérente avec la sélection.
    const datesTriees = [...new Set(prises.map((p) => p.facture?.dateReception).filter((d): d is string => !!d))]
      .map((str) => ({ str, t: parseDateFr(str)?.getTime() ?? 0 }))
      .sort((a, b) => a.t - b.t);
    const periode = dto.periode?.trim() || (datesTriees.length
      ? (datesTriees[0].str === datesTriees.at(-1)!.str ? datesTriees[0].str : `${datesTriees[0].str} au ${datesTriees.at(-1)!.str}`)
      : "");

    const bordereau = await this.prisma.bordereauReglement.create({
      data: {
        id,
        numero,
        prestataireId: dto.prestataireId,
        medecinId: dto.medecinId,
        creeParId,
        periode,
        nbPrisesEnCharge: prises.length,
        montantTotal,
        statut: "Reçu",
        dateReception: new Date().toLocaleDateString("fr-FR"),
        prisesEnCharge: { connect: prises.map((p) => ({ id: p.id })) },
      },
      include: { prestataire: true, medecin: true, prisesEnCharge: true },
    });

    return bordereau;
  }

  // Changer le bénéficiaire du règlement après coup (2026-08) — voir
  // demande utilisateur : possible tant que le règlement n'est pas encore
  // payé (au-delà, la traçabilité comptable ne doit plus bouger). `null`
  // remet le règlement à l'ordre de la structure elle-même.
  async definirMedecin(id: string, medecinId: string | null) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut === "Payé") throw new BadRequestException("Bordereau déjà payé — le bénéficiaire ne peut plus être modifié.");
    if (medecinId) {
      const lien = await this.prisma.medecinPrestataire.findUnique({ where: { medecinId_prestataireId: { medecinId, prestataireId: bordereau.prestataireId } } });
      if (!lien) throw new BadRequestException("Ce médecin n'intervient pas dans cette structure.");
    }
    return this.prisma.bordereauReglement.update({ where: { id }, data: { medecinId }, include: { prestataire: true, medecin: true } });
  }

  /** Validation comptable du bordereau — le montant validé peut différer du montant déclaré en cas de litige. */
  async valider(id: string, montantValide?: number) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut === "Payé") throw new BadRequestException("Bordereau déjà payé");
    return this.prisma.bordereauReglement.update({
      where: { id },
      data: { statut: "Validé", montantValide: montantValide ?? Number(bordereau.montantTotal) },
    });
  }

  async rejeter(id: string) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut === "Payé") throw new BadRequestException("Bordereau déjà payé");
    return this.prisma.bordereauReglement.update({ where: { id }, data: { statut: "Rejeté" } });
  }

  /** Marque le bordereau comme payé (virement effectué) — bloc financier/trésorerie. */
  async payer(id: string, dto: PayerBordereauDto) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut !== "Validé") throw new BadRequestException("Le bordereau doit être validé avant paiement");
    return this.prisma.bordereauReglement.update({
      where: { id },
      data: { statut: "Payé", datePaiement: new Date().toLocaleDateString("fr-FR"), referenceVirement: dto.referenceVirement },
    });
  }

  // Recalcule montantTotal/nbPrisesEnCharge à partir des PriseEnCharge
  // réellement rattachées — appelé par FacturesService après toute
  // modification d'une ligne déjà batchée dans un bordereau (édition de
  // montant, détachement suite à annulation de facture), pour que le
  // bordereau reste toujours le reflet exact de ses lignes, y compris s'il
  // est déjà "Payé" (voir FacturesService.modifierLigne — comportement
  // demandé explicitement par l'utilisateur, "mise à jour systématique").
  async recalculerMontantTotal(bordereauId: string) {
    const bordereau = await this.prisma.bordereauReglement.findUnique({ where: { id: bordereauId }, include: { prisesEnCharge: true } });
    if (!bordereau) return;
    const montantTotal = montantNetPrisesEnCharge(bordereau.prisesEnCharge);
    await this.prisma.bordereauReglement.update({
      where: { id: bordereauId },
      data: { montantTotal, nbPrisesEnCharge: bordereau.prisesEnCharge.length },
    });
  }

  // Retire une ligne d'un bordereau (facture annulée après batching) et
  // recalcule aussitôt le total — appelé uniquement si le bordereau n'est
  // pas "Payé" (voir FacturesService.annuler, qui bloque avant d'appeler
  // ceci si un paiement a déjà eu lieu).
  async detacherLigne(bordereauId: string, ligneId: string) {
    await this.prisma.priseEnCharge.update({ where: { id: ligneId }, data: { bordereauId: null } });
    await this.recalculerMontantTotal(bordereauId);
  }

  // État de prélèvement TPS par prestataire × mois de règlement (2026-08)
  // — pièce comptable : regroupe les lignes déjà réglées (rattachées à un
  // bordereau) portant un montantTps figé à la saisie (voir SanteService.
  // calculerTps), par mois de la date de réception du bordereau qui les
  // porte (pas la date de l'acte).
  // filtres.annee (exercice) exclut les lignes "Non réglé" — un exercice
  // n'a de sens que pour une ligne effectivement rattachée à un règlement.
  // filtres.du/au filtrent sur cette même date de règlement.
  // Chaque groupe porte aussi son détail ligne par ligne (facture, assuré,
  // date de soin) — l'État TPS n'est pas qu'un total global, il est aussi
  // transmis individuellement à chaque prestataire concerné, qui doit
  // pouvoir retrouver les factures précises ayant motivé le prélèvement
  // (voir feedback "Facture égale détails").
  async etatTps(filtres?: { prestataireId?: string; annee?: string; du?: string; au?: string }) {
    // Pas de filtre sur bordereauId : une ligne dont la TPS est déjà
    // calculée mais qui n'a pas encore rejoint de règlement apparaît sous
    // le repère "Non réglé" plutôt que de disparaître du rapport — sans
    // ça, une TPS bien calculée resterait invisible tant que le
    // gestionnaire n'a pas généré le règlement correspondant.
    const lignes = await this.prisma.priseEnCharge.findMany({
      where: { montantTps: { gt: 0 }, prestataireId: filtres?.prestataireId },
      include: { bordereau: true, prestataireRef: true, facture: true, assure: true },
    });

    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);

    const groupes = new Map<string, {
      prestataireId: string; prestataireNom: string; mois: string;
      nbLignes: number; totalBaseRemboursement: number; totalTps: number;
      lignes: { factureReference: string; assureNom: string; date: string; montant: number; baseRemboursement: number; montantTps: number }[];
    }>();
    for (const l of lignes) {
      if (!l.prestataireId) continue;
      let mois = "Non réglé";
      let dateReglement: Date | null = null;
      if (l.bordereau) {
        const [, m, y] = l.bordereau.dateReception.split("/");
        mois = m && y ? `${m}/${y}` : "—";
        dateReglement = parseDateFr(l.bordereau.dateReception);
      }
      if (filtres?.annee) {
        if (mois === "Non réglé") continue;
        const [, y] = mois.split("/");
        if (y !== filtres.annee) continue;
      }
      if (du || au) {
        if (!dateReglement) continue;
        if (du && dateReglement < du) continue;
        if (au && dateReglement > au) continue;
      }
      const cle = `${l.prestataireId}::${mois}`;
      const existant = groupes.get(cle);
      const baseRemboursement = l.baseRemboursement != null ? Number(l.baseRemboursement) : 0;
      const montantTps = Number(l.montantTps);
      const ligneDetail = {
        factureReference: l.facture?.referenceFacture ?? "—",
        assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
        date: l.date, montant: Number(l.montant), baseRemboursement, montantTps,
      };
      if (existant) {
        existant.nbLignes += 1; existant.totalBaseRemboursement += baseRemboursement; existant.totalTps += montantTps;
        existant.lignes.push(ligneDetail);
      } else {
        groupes.set(cle, {
          prestataireId: l.prestataireId, prestataireNom: l.prestataireRef?.nom ?? l.prestataire,
          mois, nbLignes: 1, totalBaseRemboursement: baseRemboursement, totalTps: montantTps,
          lignes: [ligneDetail],
        });
      }
    }
    // "Non réglé" toujours en tête (le plus actionnable), puis les mois
    // réglés du plus récent au plus ancien.
    return [...groupes.values()].sort((a, b) => {
      if (a.mois === b.mois) return a.prestataireNom.localeCompare(b.prestataireNom);
      if (a.mois === "Non réglé") return -1;
      if (b.mois === "Non réglé") return 1;
      return b.mois.localeCompare(a.mois);
    }).map((g) => ({ ...g, lignes: g.lignes.sort((a, b) => (parseDateFr(b.date)?.getTime() ?? 0) - (parseDateFr(a.date)?.getTime() ?? 0)) }));
  }

  // Liste des prestataires assujettis à la TPS — pour l'écran/état
  // "Prestataires assujettis" (voir DocumentsService.renderListePrestatairesTps).
  prestatairesAssujettisTps() {
    return this.prisma.prestataire.findMany({
      where: { tpsAssujetti: true },
      orderBy: { nom: "asc" },
    });
  }

  // Historique de factures par exercice (2026-08) — écran de consultation
  // depuis "Règlement" : retrouver d'anciennes factures déjà réglées, par
  // prestataire, intervalle de date, N° de règlement, référence de
  // décompte ou assuré/ayant droit. Ne porte que sur les lignes déjà
  // rattachées à un bordereau (bordereauId non nul) — l'historique parle
  // de factures réglées, contrairement à l'état TPS qui garde aussi les
  // lignes "Non réglé" (voir etatTps ci-dessus).
  // Toujours ligne par ligne (assuré, date de soin, frais réel, montant
  // remboursé) plutôt qu'un total agrégé, voir feedback utilisateur
  // "Facture égale détails".
  // `page` (2026-11) : l'écran ne reçoit que la page affichée (mesuré en
  // prod : 35 076 lignes = 22 Mo de JSON à décoder dans le navigateur) ;
  // les totaux par exercice restent calculés sur toutes les lignes. Sans
  // page (export PDF/Excel), toutes les lignes comme avant.
  async historique(filtres: {
    prestataireId?: string; du?: string; au?: string;
    numeroReglement?: string; referenceDecompte?: string; assure?: string;
    referenceReglementComptable?: string;
  }, page?: number, taille = 25) {
    // Une seule requête SQL à plat (2026-11, mesuré : ~35 000 lignes = 10 s
    // d'hydratation d'objets imbriqués par Prisma, la requête elle-même étant
    // rapide). Filtre société explicite : le SQL brut contourne le middleware.
    const societeId = TenantContext.getSocieteId();
    const motifAssure = filtres.assure ? `%${filtres.assure}%` : null;
    const brutes = await this.prisma.$queryRaw<{
      id: string; date: string; assureId: string; factureId: string | null; montant: number; baseRemboursement: number | null; statut: string;
      bordereauId: string; prestataireId: string | null; prestataire: string; assureNom: string; assurePrenom: string | null;
      dateReception: string | null; referenceFacture: string | null; bordereauNumero: string; bordereauStatut: string;
      lcNumero: string | null; lcNumeroCheque: number | null; banqueNom: string | null; prestataireNom: string | null;
    }[]>(Prisma.sql`
      SELECT p.id, p.date, p."assureId", p."factureId", p.montant::float8 AS montant, p."baseRemboursement"::float8 AS "baseRemboursement", p.statut,
             p."bordereauId", p."prestataireId", p.prestataire, a.nom AS "assureNom", a.prenom AS "assurePrenom",
             f."dateReception", f."referenceFacture", b.numero AS "bordereauNumero", b.statut AS "bordereauStatut",
             lc.numero AS "lcNumero", lc."numeroCheque" AS "lcNumeroCheque", bq.nom AS "banqueNom", pr.nom AS "prestataireNom"
      FROM "PriseEnCharge" p
      JOIN "AssureSante" a ON a.id = p."assureId"
      JOIN "BordereauReglement" b ON b.id = p."bordereauId"
      LEFT JOIN "Facture" f ON f.id = p."factureId"
      LEFT JOIN "LettreCheque" lc ON lc.id = b."lettreChequeId"
      LEFT JOIN "Banque" bq ON bq.id = lc."banqueId"
      LEFT JOIN "Prestataire" pr ON pr.id = p."prestataireId"
      WHERE p."bordereauId" IS NOT NULL
        ${societeId ? Prisma.sql`AND p."societeId" = ${societeId}` : Prisma.empty}
        ${filtres.prestataireId ? Prisma.sql`AND p."prestataireId" = ${filtres.prestataireId}` : Prisma.empty}
        ${motifAssure ? Prisma.sql`AND (a.nom ILIKE ${motifAssure} OR a.prenom ILIKE ${motifAssure} OR a.matricule ILIKE ${motifAssure})` : Prisma.empty}
      ORDER BY p.date DESC, p.id`);
    const lignesBrutes = brutes.map((l) => ({
      ...l,
      assure: { nom: l.assureNom, prenom: l.assurePrenom },
      facture: l.dateReception !== null ? { dateReception: l.dateReception, referenceFacture: l.referenceFacture! } : null,
      bordereau: {
        numero: l.bordereauNumero, statut: l.bordereauStatut,
        lettreCheque: l.lcNumero !== null ? { numero: l.lcNumero, numeroCheque: l.lcNumeroCheque!, banque: { nom: l.banqueNom ?? "" } } : null,
      },
      prestataireRef: l.prestataireNom !== null ? { nom: l.prestataireNom } : null,
    }));

    // Décomptes chargés par facture (lots de 5 000) puis appariés en mémoire :
    // un OR (facture, assuré) par ligne dépassait la limite PostgreSQL de
    // 32 767 paramètres sur un gros historique (erreur 500).
    const chargerDecomptes = async (lignesVisees: { factureId: string | null }[]) => {
      const factureIds = [...new Set(lignesVisees.map((l) => l.factureId).filter((id): id is string => !!id))];
      const decomptes = [];
      for (let i = 0; i < factureIds.length; i += 5000) {
        decomptes.push(...await this.prisma.decompte.findMany({ where: { factureId: { in: factureIds.slice(i, i + 5000) } }, select: { factureId: true, assureId: true, numero: true, numeroSinistre: true } }));
      }
      return new Map(decomptes.map((d) => [`${d.factureId}::${d.assureId}`, d]));
    };
    // Décomptes de toutes les lignes seulement si on filtre dessus ; sinon
    // ceux de la page affichée suffisent (voir plus bas).
    const decompteParPaire = filtres.referenceDecompte || !page ? await chargerDecomptes(lignesBrutes) : new Map<string, { numero: string; numeroSinistre: string | null }>();

    const du = parseDateFr(filtres.du);
    const au = parseDateFr(filtres.au);
    const numeroReglementNorm = filtres.numeroReglement?.replace(/\s/g, "").toLowerCase();
    const referenceDecompteNorm = filtres.referenceDecompte?.trim().toLowerCase();
    const referenceReglementComptableNorm = filtres.referenceReglementComptable?.trim().toLowerCase();

    const lignes: {
      id: string; date: string; exercice: string; assureNom: string; assureId: string;
      factureId: string | null; factureReference: string | null;
      decompteNumero: string | null; numeroSinistre: string | null;
      montant: number; montantRembourse: number; statutLigne: string;
      bordereauId: string | null; bordereauNumero: string | null; bordereauStatut: string | null;
      lettreChequeNumero: string | null; numeroCheque: number | null; banqueNom: string | null;
      prestataireId: string | null; prestataireNom: string;
    }[] = [];

    for (const l of lignesBrutes) {
      const dateFacture = parseDateFr(l.facture?.dateReception);
      if (du && dateFacture && dateFacture < du) continue;
      if (au && dateFacture && dateFacture > au) continue;
      if (numeroReglementNorm && !l.bordereau?.numero.replace(/\s/g, "").toLowerCase().includes(numeroReglementNorm)) continue;
      // Recherche par chèque/lettre chèque : numéro de chèque, numéro
      // interne LC- ou nom de banque — la ligne n'est éligible que si son
      // règlement a effectivement un règlement comptable correspondant.
      if (referenceReglementComptableNorm) {
        const lc = l.bordereau?.lettreCheque;
        const cible = `${lc?.numeroCheque ?? ""} ${lc?.numero ?? ""} ${lc?.banque.nom ?? ""}`.toLowerCase();
        if (!lc || !cible.includes(referenceReglementComptableNorm)) continue;
      }

      const decompte = l.factureId ? decompteParPaire.get(`${l.factureId}::${l.assureId}`) : undefined;
      if (referenceDecompteNorm) {
        const cible = `${decompte?.numero ?? ""} ${decompte?.numeroSinistre ?? ""}`.toLowerCase();
        if (!cible.includes(referenceDecompteNorm)) continue;
      }

      lignes.push({
        id: l.id,
        date: l.date,
        exercice: l.facture?.dateReception.split("/")[2] ?? l.date.split("/")[2] ?? "—",
        assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
        assureId: l.assureId,
        factureId: l.factureId,
        factureReference: l.facture?.referenceFacture ?? null,
        decompteNumero: decompte?.numero ?? null,
        numeroSinistre: decompte?.numeroSinistre ?? null,
        montant: Number(l.montant),
        montantRembourse: l.baseRemboursement != null ? Number(l.baseRemboursement) : 0,
        statutLigne: l.statut,
        bordereauId: l.bordereauId,
        bordereauNumero: l.bordereau?.numero ?? null,
        bordereauStatut: l.bordereau?.statut ?? null,
        lettreChequeNumero: l.bordereau?.lettreCheque?.numero ?? null,
        numeroCheque: l.bordereau?.lettreCheque?.numeroCheque ?? null,
        banqueNom: l.bordereau?.lettreCheque?.banque.nom ?? null,
        prestataireId: l.prestataireId,
        prestataireNom: l.prestataireRef?.nom ?? l.prestataire,
      });
    }

    const exercicesMap = new Map<string, { annee: string; nbLignes: number; montantDeclare: number; montantRembourse: number }>();
    for (const l of lignes) {
      const e = exercicesMap.get(l.exercice) ?? { annee: l.exercice, nbLignes: 0, montantDeclare: 0, montantRembourse: 0 };
      e.nbLignes += 1;
      e.montantDeclare += l.montant;
      e.montantRembourse += l.montantRembourse;
      exercicesMap.set(l.exercice, e);
    }

    const exercices = [...exercicesMap.values()].sort((a, b) => b.annee.localeCompare(a.annee));
    if (!page) return { lignes, exercices };
    const pageLignes = lignes.slice((page - 1) * taille, page * taille);
    if (!filtres.referenceDecompte) {
      const parPaire = await chargerDecomptes(pageLignes);
      for (const l of pageLignes) {
        const d = l.factureId ? parPaire.get(`${l.factureId}::${l.assureId}`) : undefined;
        l.decompteNumero = d?.numero ?? null;
        l.numeroSinistre = d?.numeroSinistre ?? null;
      }
    }
    return { lignes: pageLignes, exercices, total: lignes.length, page, taille };
  }
}
