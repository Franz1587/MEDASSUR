import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { MouvementsService } from "../mouvements/mouvements.service";
import { recalculerPrimeSelonPopulation } from "../contrats/prime-exercice.util";
import { STATUTS_CONTRAT_ACTIFS } from "../clients/statut-souscripteur.util";
import { normaliserTelephone } from "../lib/telephone.util";
import {
  clePolice, detecterRoles, lireClasseur, memeSouscripteur, normaliserCle, statutDepuisFichier,
  type RolesClasseur,
} from "./classeur.util";

// Import d'un classeur multi-feuilles par ARIANA (2026-11) — voir demande
// utilisateur : lire un classeur « participants + synthèse par contrat » et
// appliquer toutes les mises à jour possibles comme à l'import des assurés
// selon les contrats : statuts, listes des contrats, téléphones, affectation
// des factures, correction des contrats. Le fichier fait foi pour le
// rattachement d'un assuré à son contrat ; rien n'est jamais supprimé ni radié
// parce qu'une personne manque dans le fichier.

export interface OptionsClasseur {
  statuts: boolean;
  contrats: boolean;     // rattacher chaque assuré au contrat indiqué par le fichier
  telephones: boolean;
  factures: boolean;     // les prestations/ententes/factures suivent l'assuré déplacé
  creerAbsents: boolean; // créer les personnes du fichier inconnues de la base
  produits: "aucun" | "vides" | "tous"; // libellé produit des contrats (feuille de synthèse)
}

export const OPTIONS_CLASSEUR_PAR_DEFAUT: OptionsClasseur = {
  statuts: true, contrats: true, telephones: true, factures: true, creerAbsents: false, produits: "vides",
};

interface ActionAssure {
  ligne: number; matricule: string; nom: string; prenom: string; policeFichier: string;
  contratCibleId: string; policeCible: string;
  assureId?: string; contratActuelId?: string; policeActuelle?: string; statutActuel?: string;
  statutVers?: "Actif" | "Suspendu";
  deplacer?: boolean; membresIds?: string[];
  telephone?: string;
  creer?: boolean;
}

export interface Anomalie { type: string; libelle: string; nombre: number; exemples: string[] }

interface ActionContrat {
  contratId: string; police: string; produitActuel: string; produitFichier: string;
  souscripteurBase: string; souscripteurFichier: string; ecartSouscripteur: boolean; participantsFichier: number | null;
}

interface Plan {
  id: string; societeId: string | null; creeLe: number; nomFichier: string;
  assures: ActionAssure[]; contrats: ActionContrat[];
}

export interface ResultatClasseur {
  typeDetecte: "classeur";
  planId: string;
  nomFichier: string;
  feuilles: { nom: string; role: "participants" | "contrats" | "ignorée"; lignes: number; colonnes: string[] }[];
  totaux: {
    lignesParticipants: number; assuresTrouves: number; inchanges: number;
    suspensions: number; reactivations: number; deplacements: number; membresSuivent: number;
    telephonesAjoutes: number; absents: number; prestationsSuivent: number;
    contratsProduitVide: number; contratsProduitEcart: number; contratsSouscripteurEcart: number;
  };
  echantillons: { suspensions: LigneEchantillon[]; reactivations: LigneEchantillon[]; deplacements: LigneEchantillon[]; telephones: LigneEchantillon[]; absents: LigneEchantillon[] };
  contrats: { police: string; produitActuel: string; produitFichier: string; souscripteurBase: string; souscripteurFichier: string; ecartSouscripteur: boolean }[];
  anomalies: Anomalie[];
  constats: string[];
  options: OptionsClasseur;
}

interface LigneEchantillon { matricule: string; nom: string; detail: string }

export interface BilanClasseur {
  statutsModifies: number; deplaces: number; membresDeplaces: number; prestationsRattachees: number;
  facturesRattachees: number; ententesRattachees: number; telephonesAjoutes: number; crees: number; produitsMisAJour: number;
  ignores: number; erreurs: string[];
}

const TTL_PLAN_MS = 60 * 60 * 1000;
const parLots = <T,>(liste: T[], taille: number): T[][] => {
  const lots: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
};

@Injectable()
export class ImportClasseurService {
  private plans = new Map<string, Plan>();

  constructor(private prisma: PrismaService, private mouvements: MouvementsService) {}

  // Reconnaît un classeur exploitable sans appel externe : au moins une feuille
  // « participants » (N° de contrat + matricule). Retourne null sinon, pour que
  // l'import libre continue par sa détection habituelle.
  detecter(buffer: Buffer, ext: string): RolesClasseur | null {
    if (ext !== ".xlsx" && ext !== ".xls") return null;
    try {
      const roles = detecterRoles(lireClasseur(buffer));
      return roles.participants ? roles : null;
    } catch { return null; }
  }

  async apercu(buffer: Buffer, nomFichier: string): Promise<ResultatClasseur> {
    const feuilles = lireClasseur(buffer);
    const roles = detecterRoles(feuilles);
    if (!roles.participants) throw new BadRequestException("Aucune feuille de participants reconnue (colonnes N° de contrat et Matricule).");
    const { feuille, col } = roles.participants;
    const v = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

    // ── Référentiels ──────────────────────────────────────────────────────
    const contrats = await this.prisma.contrat.findMany({
      where: { estTest: false },
      select: { id: true, numeroPolice: true, statut: true, branche: true, produit: true, clientId: true, client: { select: { nom: true } } },
    });
    const parPolice = new Map<string, typeof contrats>();
    for (const c of contrats) {
      const k = clePolice(c.numeroPolice ?? "");
      if (k) (parPolice.get(k) ?? parPolice.set(k, []).get(k)!).push(c);
    }
    const etiquette = new Map(contrats.map((c) => [c.id, c.numeroPolice ?? c.id]));

    const anomalies = new Map<string, Anomalie>();
    const noter = (type: string, libelle: string, exemple: string) => {
      const a = anomalies.get(type) ?? anomalies.set(type, { type, libelle, nombre: 0, exemples: [] }).get(type)!;
      a.nombre++;
      if (a.exemples.length < 8 && !a.exemples.includes(exemple)) a.exemples.push(exemple);
    };

    // ── Lignes du fichier, contrat résolu ─────────────────────────────────
    interface LigneFichier { ligne: number; police: string; matricule: string; tel: string; prenom: string; nom: string; souscripteur: string; statut: string; contratId: string | null }
    const vues = new Set<string>();
    const lignes: LigneFichier[] = [];
    let doublonsFichier = 0;
    feuille.lignes.forEach((r, i) => {
      const matricule = v(r, col.matricule);
      const police = v(r, col.police);
      const ligne = i + 2;
      if (!matricule) { noter("sans_matricule", "Lignes sans matricule", `ligne ${ligne} : ${v(r, col.nom)} ${v(r, col.prenom)}`.trim()); return; }
      const souscripteur = v(r, col.souscripteur);
      const candidats = parPolice.get(clePolice(police)) ?? [];
      let cible = candidats.length === 1 ? candidats[0] : null;
      if (candidats.length > 1) {
        const filtres = candidats.filter((c) => memeSouscripteur(c.client?.nom ?? "", souscripteur));
        cible = filtres.length === 1 ? filtres[0] : null;
        if (!cible) { noter("police_ambigue", "Numéros de contrat portés par plusieurs contrats", police); }
      } else if (candidats.length === 0) {
        noter("police_introuvable", "Numéros de contrat absents de l'application", police);
      }
      if (cible && cible.branche === "Assistance") {
        noter("assistance", "Contrats d'assistance (leur population est celle des contrats maladie liés)", police);
        cible = null;
      }
      const cleDoublon = `${matricule.toLowerCase()}|${cible?.id ?? clePolice(police)}`;
      if (vues.has(cleDoublon)) { doublonsFichier++; return; }
      vues.add(cleDoublon);
      lignes.push({ ligne, police, matricule, tel: v(r, col.telephone), prenom: v(r, col.prenom), nom: v(r, col.nom), souscripteur, statut: v(r, col.statut), contratId: cible?.id ?? null });
    });

    // ── Assurés existants (par matricule, insensible à la casse) ─────────
    const matricules = [...new Set(lignes.map((l) => l.matricule))];
    const existants: { id: string; matricule: string; nom: string; prenom: string | null; telephone: string | null; statut: string; familleId: string | null; contratId: string }[] = [];
    for (const lot of parLots(matricules, 1000)) {
      existants.push(...await this.prisma.assureSante.findMany({
        where: { matricule: { in: lot, mode: "insensitive" } },
        select: { id: true, matricule: true, nom: true, prenom: true, telephone: true, statut: true, familleId: true, contratId: true },
      }));
    }
    const parMatricule = new Map<string, typeof existants>();
    for (const a of existants) (parMatricule.get(a.matricule.toLowerCase()) ?? parMatricule.set(a.matricule.toLowerCase(), []).get(a.matricule.toLowerCase())!).push(a);
    const matriculesFichier = new Set(matricules.map((m) => m.toLowerCase()));

    // Numéros déjà portés par une famille (unicité globale des assurés principaux).
    const numerosPris = new Set((await this.prisma.assureSante.findMany({
      where: { familleId: null, telephone: { not: null } }, select: { telephone: true },
    })).map((a) => (a.telephone ?? "").replace(/\D/g, "").slice(-9)));

    // ── Décision par assuré ───────────────────────────────────────────────
    const parMat = new Map<string, LigneFichier[]>();
    for (const l of lignes) (parMat.get(l.matricule.toLowerCase()) ?? parMat.set(l.matricule.toLowerCase(), []).get(l.matricule.toLowerCase())!).push(l);

    const assures: ActionAssure[] = [];
    let inchanges = 0, absents = 0, ayantsDroitTelephone = 0;
    const racinesADeplacer: ActionAssure[] = [];

    for (const [mat, rows] of parMat) {
      const resolues = rows.filter((r) => r.contratId);
      if (resolues.length === 0) continue;
      const db = parMatricule.get(mat) ?? [];
      const cibles = new Set(resolues.map((r) => r.contratId!));
      const sansAffiliation = resolues.filter((r) => !db.some((a) => a.contratId === r.contratId));
      const dbSeulement = db.filter((a) => !cibles.has(a.contratId));
      const paires = new Map<string, { aff?: typeof db[number]; deplacer: boolean; creer: boolean }>();
      for (const r of resolues) paires.set(r.contratId!, { aff: db.find((a) => a.contratId === r.contratId), deplacer: false, creer: false });

      if (sansAffiliation.length > 0) {
        if (db.length === 0 || dbSeulement.length === 0) {
          for (const r of sansAffiliation) paires.get(r.contratId!)!.creer = true;
        } else if (sansAffiliation.length === 1 && dbSeulement.length === 1) {
          const p = paires.get(sansAffiliation[0].contratId!)!;
          p.aff = dbSeulement[0]; p.deplacer = true;
        } else {
          noter("matricule_multiple", "Matricules présents sur plusieurs contrats, rattachement ambigu (à vérifier à la main)", `${rows[0].matricule} (fichier : ${resolues.map((r) => r.police).join(", ")})`);
          continue;
        }
      }

      for (const r of resolues) {
        const p = paires.get(r.contratId!)!;
        const contratCible = contrats.find((c) => c.id === r.contratId)!;
        const action: ActionAssure = {
          ligne: r.ligne, matricule: r.matricule, nom: r.nom || p.aff?.nom || "", prenom: r.prenom || p.aff?.prenom || "",
          policeFichier: r.police, contratCibleId: r.contratId!, policeCible: etiquette.get(r.contratId!) ?? r.police,
        };
        if (!p.aff) {
          if (p.creer) { action.creer = true; absents++; assures.push({ ...action, telephone: this.telephoneUtile(r.tel) }); }
          continue;
        }
        action.assureId = p.aff.id; action.statutActuel = p.aff.statut;
        action.contratActuelId = p.aff.contratId; action.policeActuelle = etiquette.get(p.aff.contratId) ?? p.aff.contratId;
        let modifie = false;
        if (p.deplacer) { action.deplacer = true; modifie = true; if (p.aff.familleId === null) racinesADeplacer.push(action); }

        const voulu = statutDepuisFichier(r.statut);
        if (voulu && p.aff.statut !== "Radié" && p.aff.statut !== voulu) {
          if (voulu === "Actif" && !STATUTS_CONTRAT_ACTIFS.includes(contratCible.statut)) {
            noter("contrat_inactif", "Réactivations refusées : le contrat est résilié ou expiré", `${r.matricule} → police ${action.policeCible} (${contratCible.statut})`);
          } else { action.statutVers = voulu; modifie = true; }
        }

        const tel = this.telephoneUtile(r.tel);
        if (tel && !p.aff.telephone) {
          if (p.aff.familleId !== null) ayantsDroitTelephone++;
          else if (numerosPris.has(tel.replace(/\D/g, "").slice(-9))) noter("telephone_utilise", "Numéros déjà portés par une autre famille (un numéro = une famille)", `${r.matricule} : ${tel}`);
          else { action.telephone = tel; numerosPris.add(tel.replace(/\D/g, "").slice(-9)); modifie = true; }
        }
        if (modifie) assures.push(action); else inchanges++;
      }
    }

    // Ayants droit non listés dans le fichier : ils suivent leur assuré principal déplacé.
    let membresSuivent = 0;
    if (racinesADeplacer.length > 0) {
      const membres: { id: string; matricule: string; familleId: string | null }[] = [];
      for (const lot of parLots(racinesADeplacer.map((a) => a.assureId!), 1000)) {
        membres.push(...await this.prisma.assureSante.findMany({ where: { familleId: { in: lot } }, select: { id: true, matricule: true, familleId: true } }));
      }
      const parRacine = new Map<string, string[]>();
      for (const m of membres.filter((x) => !matriculesFichier.has(x.matricule.toLowerCase()))) (parRacine.get(m.familleId!) ?? parRacine.set(m.familleId!, []).get(m.familleId!)!).push(m.id);
      for (const a of racinesADeplacer) { a.membresIds = parRacine.get(a.assureId!) ?? []; membresSuivent += a.membresIds.length; }
    }

    // ── Prestations qui suivront les assurés déplacés (estimation) ────────
    const deplacements = assures.filter((a) => a.deplacer);
    let prestationsSuivent = 0;
    const paireIds = new Map<string, string[]>();
    for (const a of deplacements) (paireIds.get(a.contratActuelId!) ?? paireIds.set(a.contratActuelId!, []).get(a.contratActuelId!)!).push(a.assureId!, ...(a.membresIds ?? []));
    for (const [ancien, ids] of paireIds) {
      for (const lot of parLots(ids, 1000)) prestationsSuivent += await this.prisma.priseEnCharge.count({ where: { assureId: { in: lot }, contratId: ancien } });
    }

    // ── Feuille « contrats » ──────────────────────────────────────────────
    const actionsContrats: ActionContrat[] = [];
    const nbParContrat = new Map<string, number>();
    for (const l of lignes) nbParContrat.set(clePolice(l.police), (nbParContrat.get(clePolice(l.police)) ?? 0) + 1);
    const constats: string[] = [];
    if (roles.contrats) {
      const c2 = roles.contrats.col;
      const iNb = roles.contrats.feuille.entetes.findIndex((h) => /nb|nombre/.test(normaliserCle(h)) && /particip|assure/.test(normaliserCle(h)));
      for (const r of roles.contrats.feuille.lignes) {
        const police = v(r, c2.police);
        if (!police || /^total/i.test(normaliserCle(police))) continue;
        const candidats = parPolice.get(clePolice(police)) ?? [];
        const souscripteurFichier = v(r, c2.souscripteur);
        const filtres = candidats.length > 1 ? candidats.filter((c) => memeSouscripteur(c.client?.nom ?? "", souscripteurFichier)) : candidats;
        if (filtres.length !== 1) {
          noter(candidats.length === 0 ? "contrat_synthese_introuvable" : "contrat_synthese_ambigu", candidats.length === 0 ? "Contrats de la synthèse absents de l'application (création impossible sans souscripteur, compagnie ni dates)" : "Contrats de la synthèse portés par plusieurs contrats", `${police} — ${v(r, c2.produit)}`);
          continue;
        }
        const c = filtres[0];
        const attendu = Number(v(r, iNb).replace(/\D/g, ""));
        const dansFeuille = nbParContrat.get(clePolice(police)) ?? 0;
        if (attendu && attendu !== dansFeuille) constats.push(`Police ${police} : la synthèse annonce ${attendu} participant(s), la feuille des participants en compte ${dansFeuille}.`);
        actionsContrats.push({
          contratId: c.id, police: c.numeroPolice ?? police, produitActuel: c.produit ?? "", produitFichier: v(r, c2.produit),
          souscripteurBase: c.client?.nom ?? "", souscripteurFichier, ecartSouscripteur: !memeSouscripteur(c.client?.nom ?? "", souscripteurFichier),
          participantsFichier: attendu || null,
        });
      }
    }
    if (doublonsFichier > 0) constats.push(`${doublonsFichier} ligne(s) répétée(s) dans le fichier (même matricule, même contrat) comptée(s) une seule fois.`);
    if (ayantsDroitTelephone > 0) constats.push(`${ayantsDroitTelephone} numéro(s) de téléphone concernent des ayants droit : le numéro n'est porté que par l'assuré principal de la famille, ils sont ignorés.`);
    const radies = lignes.filter((l) => (parMatricule.get(l.matricule.toLowerCase()) ?? []).some((a) => a.statut === "Radié")).length;
    if (radies > 0) constats.push(`${radies} ligne(s) concernent des assurés « Radié » (sortie définitive) : leur statut n'est jamais modifié par un fichier.`);

    const plan: Plan = { id: randomUUID(), societeId: TenantContext.getSocieteId(), creeLe: Date.now(), nomFichier, assures, contrats: actionsContrats };
    this.purger();
    this.plans.set(plan.id, plan);

    const echant = (liste: ActionAssure[], detail: (a: ActionAssure) => string): LigneEchantillon[] =>
      liste.slice(0, 25).map((a) => ({ matricule: a.matricule, nom: `${a.nom} ${a.prenom}`.trim(), detail: detail(a) }));
    const suspensions = assures.filter((a) => a.statutVers === "Suspendu");
    const reactivations = assures.filter((a) => a.statutVers === "Actif");
    const avecTel = assures.filter((a) => a.telephone && !a.creer);

    return {
      typeDetecte: "classeur", planId: plan.id, nomFichier,
      feuilles: feuilles.map((f) => ({
        nom: f.nom, lignes: f.lignes.length, colonnes: f.entetes.filter(Boolean),
        role: roles.participants?.feuille === f ? "participants" : roles.contrats?.feuille === f ? "contrats" : "ignorée",
      })),
      totaux: {
        lignesParticipants: feuille.lignes.length,
        assuresTrouves: assures.filter((a) => a.assureId).length + inchanges,
        inchanges, suspensions: suspensions.length, reactivations: reactivations.length,
        deplacements: deplacements.length, membresSuivent, telephonesAjoutes: avecTel.length, absents, prestationsSuivent,
        contratsProduitVide: actionsContrats.filter((c) => !c.produitActuel && c.produitFichier).length,
        contratsProduitEcart: actionsContrats.filter((c) => c.produitActuel && c.produitFichier && normaliserCle(c.produitActuel) !== normaliserCle(c.produitFichier)).length,
        contratsSouscripteurEcart: actionsContrats.filter((c) => c.ecartSouscripteur).length,
      },
      echantillons: {
        suspensions: echant(suspensions, (a) => `${a.statutActuel} → Suspendu (police ${a.policeCible})`),
        reactivations: echant(reactivations, (a) => `${a.statutActuel} → Actif (police ${a.policeCible})`),
        deplacements: echant(deplacements, (a) => `police ${a.policeActuelle} → ${a.policeCible}${a.membresIds?.length ? ` (+${a.membresIds.length} ayant(s) droit)` : ""}`),
        telephones: echant(avecTel, (a) => a.telephone ?? ""),
        absents: echant(assures.filter((a) => a.creer), (a) => `à créer sur la police ${a.policeCible}`),
      },
      contrats: actionsContrats.map(({ police, produitActuel, produitFichier, souscripteurBase, souscripteurFichier, ecartSouscripteur }) => ({ police, produitActuel, produitFichier, souscripteurBase, souscripteurFichier, ecartSouscripteur })),
      anomalies: [...anomalies.values()].sort((a, b) => b.nombre - a.nombre),
      constats,
      options: OPTIONS_CLASSEUR_PAR_DEFAUT,
    };
  }

  private telephoneUtile(brut: string): string | undefined {
    const t = (normaliserTelephone(brut) ?? "").toString();
    return t.replace(/\D/g, "").length >= 6 ? t : undefined;
  }

  private purger() {
    const limite = Date.now() - TTL_PLAN_MS;
    for (const [id, p] of this.plans) if (p.creeLe < limite) this.plans.delete(id);
    while (this.plans.size >= 8) this.plans.delete(this.plans.keys().next().value as string);
  }

  async confirmer(planId: string, options: Partial<OptionsClasseur>): Promise<BilanClasseur> {
    const plan = this.plans.get(planId);
    if (!plan || plan.societeId !== TenantContext.getSocieteId()) {
      throw new BadRequestException("Cet aperçu a expiré — relancez l'analyse du classeur.");
    }
    const opt: OptionsClasseur = { ...OPTIONS_CLASSEUR_PAR_DEFAUT, ...options };
    const bilan: BilanClasseur = {
      statutsModifies: 0, deplaces: 0, membresDeplaces: 0, prestationsRattachees: 0, facturesRattachees: 0, ententesRattachees: 0,
      telephonesAjoutes: 0, crees: 0, produitsMisAJour: 0, ignores: 0, erreurs: [],
    };
    const touches = new Set<string>();

    // Mise à jour par lots, repli ligne à ligne si un lot échoue (ex. matricule déjà présent sur le contrat cible).
    const majAssures = async (ids: string[], data: Record<string, unknown>, ancien?: string): Promise<number> => {
      let ok = 0;
      for (const lot of parLots(ids, 200)) {
        try { ok += (await this.prisma.assureSante.updateMany({ where: { id: { in: lot } }, data })).count; }
        catch {
          for (const id of lot) {
            try { ok += (await this.prisma.assureSante.updateMany({ where: { id }, data })).count; }
            catch { bilan.ignores++; bilan.erreurs.push(`Mise à jour impossible (assuré ${id}${ancien ? `, police ${ancien}` : ""}) : contrainte d'unicité.`); }
          }
        }
      }
      return ok;
    };

    // 1. Rattachement aux contrats (avant les statuts : la règle d'activité dépend du contrat cible)
    if (opt.contrats) {
      const groupes = new Map<string, { ancien: string; cible: string; ids: string[]; membres: string[] }>();
      for (const a of plan.assures.filter((x) => x.deplacer && x.assureId)) {
        const k = `${a.contratActuelId}>${a.contratCibleId}`;
        const g = groupes.get(k) ?? groupes.set(k, { ancien: a.contratActuelId!, cible: a.contratCibleId, ids: [], membres: [] }).get(k)!;
        g.ids.push(a.assureId!); g.membres.push(...(a.membresIds ?? []));
      }
      for (const g of groupes.values()) {
        const nb = await majAssures(g.ids, { contratId: g.cible }, g.ancien);
        const nbM = await majAssures(g.membres, { contratId: g.cible }, g.ancien);
        bilan.deplaces += nb; bilan.membresDeplaces += nbM;
        touches.add(g.ancien); touches.add(g.cible);
        if (opt.factures) {
          const tous = [...g.ids, ...g.membres];
          for (const lot of parLots(tous, 500)) {
            const lignesFact = await this.prisma.priseEnCharge.findMany({ where: { assureId: { in: lot }, contratId: g.ancien }, select: { factureId: true } });
            const factureIds = [...new Set(lignesFact.map((l) => l.factureId).filter((f): f is string => !!f))];
            bilan.prestationsRattachees += (await this.prisma.priseEnCharge.updateMany({ where: { assureId: { in: lot }, contratId: g.ancien }, data: { contratId: g.cible } })).count;
            bilan.ententesRattachees += (await this.prisma.accordPrealable.updateMany({ where: { assureId: { in: lot }, contratId: g.ancien }, data: { contratId: g.cible } })).count;
            // L'en-tête d'une facture suit seulement si toutes ses lignes sont désormais sur le contrat cible.
            for (const fl of parLots(factureIds, 200)) {
              const factures = await this.prisma.facture.findMany({ where: { id: { in: fl }, contratId: g.ancien }, select: { id: true, lignes: { select: { contratId: true } } } });
              const suivent = factures.filter((f) => f.lignes.every((l) => l.contratId === g.cible)).map((f) => f.id);
              if (suivent.length) bilan.facturesRattachees += (await this.prisma.facture.updateMany({ where: { id: { in: suivent } }, data: { contratId: g.cible } })).count;
            }
          }
        }
      }
    }

    // 2. Statuts
    if (opt.statuts) {
      for (const statut of ["Suspendu", "Actif"] as const) {
        const ids = plan.assures.filter((a) => a.statutVers === statut && a.assureId).map((a) => a.assureId!);
        // Jamais sur un « Radié » (sortie définitive), même si la fiche a changé depuis l'aperçu.
        for (const lot of parLots(ids, 500)) {
          bilan.statutsModifies += (await this.prisma.assureSante.updateMany({ where: { id: { in: lot }, statut: { not: "Radié" } }, data: { statut } })).count;
        }
      }
      for (const a of plan.assures) if (a.statutVers) touches.add(a.contratCibleId);
    }

    // 3. Téléphones (assuré principal uniquement, un numéro = une famille)
    if (opt.telephones) {
      for (const a of plan.assures.filter((x) => x.telephone && x.assureId)) {
        try {
          const r = await this.prisma.assureSante.updateMany({ where: { id: a.assureId!, telephone: null, familleId: null }, data: { telephone: a.telephone } });
          bilan.telephonesAjoutes += r.count;
        } catch { bilan.ignores++; bilan.erreurs.push(`Téléphone ${a.telephone} (matricule ${a.matricule}) : numéro déjà utilisé par une autre famille.`); }
      }
    }

    // 4. Création des personnes absentes — par le point d'entrée unique des mouvements (identité, compteurs, avenant d'incorporation)
    if (opt.creerAbsents) {
      const parContrat = new Map<string, ActionAssure[]>();
      for (const a of plan.assures.filter((x) => x.creer)) (parContrat.get(a.contratCibleId) ?? parContrat.set(a.contratCibleId, []).get(a.contratCibleId)!).push(a);
      const aujourdhui = new Date();
      const dateEffet = `${String(aujourdhui.getDate()).padStart(2, "0")}/${String(aujourdhui.getMonth() + 1).padStart(2, "0")}/${aujourdhui.getFullYear()}`;
      for (const [contratId, liste] of parContrat) {
        for (const lot of parLots(liste, 50)) {
          try {
            const r = await this.mouvements.appliquerMouvement(contratId, dateEffet, lot.map((a) => ({
              nom: a.nom || a.matricule, prenom: a.prenom || undefined, matricule: a.matricule, beneficiaires: 1, cotisation: 0, typeAssure: "AS", telephone: a.telephone,
            })), []);
            bilan.crees += r.crees.length; touches.add(contratId);
          } catch (e) {
            bilan.ignores += lot.length;
            bilan.erreurs.push(`Création impossible sur la police ${lot[0].policeCible} (${lot.length} personne(s)) : ${e instanceof Error ? e.message : "erreur"}`);
          }
        }
      }
    }

    // 5. Libellé produit des contrats (feuille de synthèse)
    if (opt.produits !== "aucun") {
      for (const c of plan.contrats) {
        if (!c.produitFichier) continue;
        const ecart = c.produitActuel && normaliserCle(c.produitActuel) !== normaliserCle(c.produitFichier);
        if (c.produitActuel && !(opt.produits === "tous" && ecart)) continue;
        await this.prisma.contrat.update({ where: { id: c.contratId }, data: { produit: c.produitFichier } });
        bilan.produitsMisAJour++;
      }
    }

    // 6. Primes recalculées d'après la population réelle des contrats touchés (jamais bloquant)
    if (touches.size > 0) {
      try { await recalculerPrimeSelonPopulation(this.prisma, [...touches]); }
      catch (e) { bilan.erreurs.push(`Recalcul des primes incomplet : ${e instanceof Error ? e.message : "erreur"}`); }
    }

    this.plans.delete(planId);
    return bilan;
  }
}
