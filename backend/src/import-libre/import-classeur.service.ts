import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { MouvementsService } from "../mouvements/mouvements.service";
import { recalculerPrimeSelonPopulation } from "../contrats/prime-exercice.util";
import { STATUTS_CONTRAT_ACTIFS } from "../clients/statut-souscripteur.util";
import { normaliserTelephone } from "../lib/telephone.util";
import {
  clePolice, dateInversee, detecterRoles, lireClasseur, memeSouscripteur, motsNom, nomsCompatibles, normaliserCle,
  sexeDepuisFichier, statutContratEquivalent, statutDepuisFichier, typeAssureDepuisFichier,
  type ColonnesClasseur, type FeuilleReconnue, type RolesClasseur, type TypeAssure,
} from "./classeur.util";

// Import d'un classeur multi-feuilles par ARIANA (2026-11) — voir demandes
// utilisateur : lire un classeur « participants + synthèse par contrat », puis
// « mieux apprécier et analyser les données de chaque feuille, peu importe ce
// qui s'y trouve, en comparant avec la base ». Chaque feuille est classée
// (population, contrats, doublons supprimés, points à vérifier, remarques, autre),
// analysée face à la base, et les corrections sont proposées à l'aperçu.
// Le fichier fait foi pour le rattachement, le type et le statut d'une personne ;
// rien n'est jamais supprimé ni radié parce qu'une personne manque dans le fichier,
// et aucune date, aucun nom ni aucun souscripteur existant n'est écrasé.

export interface OptionsClasseur {
  statuts: boolean;
  contrats: boolean;     // rattacher chaque assuré au contrat indiqué par le fichier
  telephones: boolean;
  factures: boolean;     // les prestations/ententes/factures suivent l'assuré déplacé
  identite: boolean;     // compléter date de naissance et sexe MANQUANTS
  types: boolean;        // corriger AS/CJ/EF et rattacher les ayants droit à leur assuré principal
  matricules: boolean;   // aligner sur le matricule conservé (feuille « doublons supprimés »)
  creerAbsents: boolean; // créer les personnes du fichier inconnues de la base
  produits: "aucun" | "vides" | "tous"; // libellé produit des contrats (feuille de synthèse)
}

export const OPTIONS_CLASSEUR_PAR_DEFAUT: OptionsClasseur = {
  statuts: true, contrats: true, telephones: true, factures: true, identite: true,
  types: false, matricules: false, creerAbsents: false, produits: "vides",
};

interface ActionAssure {
  ligne: number; matricule: string; nom: string; prenom: string; policeFichier: string;
  contratCibleId: string; policeCible: string;
  assureId?: string; contratActuelId?: string; policeActuelle?: string; statutActuel?: string;
  statutVers?: "Actif" | "Suspendu";
  deplacer?: boolean; membresIds?: string[];
  telephone?: string;
  naissance?: string; sexe?: "M" | "F";
  typeVers?: TypeAssure; typeActuel?: string; racineAssureId?: string; racineMatricule?: string;
  ancienMatricule?: string; identiteId?: string;
  creer?: boolean; typeCreation?: TypeAssure;
}

export interface Anomalie { type: string; libelle: string; nombre: number; exemples: string[] }
export interface EcartDonnee { champ: string; nombre: number; exemples: string[]; note?: string }

interface ActionContrat {
  contratId: string; police: string; produitActuel: string; produitFichier: string;
  souscripteurBase: string; souscripteurFichier: string; ecartSouscripteur: boolean;
}

interface Plan {
  id: string; societeId: string | null; creeLe: number; nomFichier: string;
  assures: ActionAssure[]; contrats: ActionContrat[];
}

export interface AnalyseFeuille {
  nom: string; role: string; lignes: number;
  colonnes: { entete: string; sens: string; remplies: number; rapprochees?: number }[];
  resume: string[];
}

interface LigneEchantillon { matricule: string; nom: string; detail: string }

export interface ResultatClasseur {
  typeDetecte: "classeur";
  planId: string;
  nomFichier: string;
  feuilles: AnalyseFeuille[];
  totaux: {
    lignesParticipants: number; assuresTrouves: number; inchanges: number;
    suspensions: number; reactivations: number; deplacements: number; membresSuivent: number;
    telephonesAjoutes: number; absents: number; prestationsSuivent: number;
    naissancesAjoutees: number; sexesAjoutes: number; typesCorriges: number; rattachements: number; alignements: number;
    contratsProduitVide: number; contratsProduitEcart: number; contratsSouscripteurEcart: number;
  };
  echantillons: {
    suspensions: LigneEchantillon[]; reactivations: LigneEchantillon[]; deplacements: LigneEchantillon[]; telephones: LigneEchantillon[];
    absents: LigneEchantillon[]; types: LigneEchantillon[]; alignements: LigneEchantillon[];
  };
  contrats: { police: string; produitActuel: string; produitFichier: string; souscripteurBase: string; souscripteurFichier: string; ecartSouscripteur: boolean }[];
  ecarts: EcartDonnee[];
  anomalies: Anomalie[];
  constats: string[];
  options: OptionsClasseur;
}

export interface BilanClasseur {
  statutsModifies: number; deplaces: number; membresDeplaces: number; prestationsRattachees: number;
  facturesRattachees: number; ententesRattachees: number; telephonesAjoutes: number; crees: number; produitsMisAJour: number;
  naissancesAjoutees: number; sexesAjoutes: number; typesCorriges: number; rattaches: number; alignes: number;
  ignores: number; erreurs: string[];
}

interface Aff {
  id: string; matricule: string; nom: string; prenom: string | null; telephone: string | null; statut: string;
  familleId: string | null; contratId: string; dateNaissance: string | null; sexe: string | null; typeAssure: string | null; identiteId: string | null;
}

const TTL_PLAN_MS = 60 * 60 * 1000;
const parLots = <T,>(liste: T[], taille: number): T[][] => {
  const lots: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
};
const chiffres = (s: string) => s.replace(/\D/g, "");
const cle9 = (s: string) => chiffres(s).slice(-9);
const LIBELLE_ROLE: Record<string, string> = {
  participants: "Population (une ligne par personne)", contrats: "Synthèse par contrat", anomalies: "Points à vérifier laissés par la source",
  doublons: "Doublons supprimés (anciens et nouveaux matricules)", remarques: "Remarques", autre: "Feuille non exploitable automatiquement",
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
    const roles = detecterRoles(lireClasseur(buffer));
    if (!roles.participants) throw new BadRequestException("Aucune feuille de participants reconnue (colonnes N° de contrat et Matricule).");
    const { feuille, col } = roles.participants;
    const v = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

    // ── Référentiels (société courante, cloisonnement automatique) ────────
    const contrats = await this.prisma.contrat.findMany({
      where: { estTest: false },
      select: { id: true, numeroPolice: true, statut: true, branche: true, produit: true, dateDebut: true, dateFin: true, clientId: true, client: { select: { nom: true } } },
    });
    const parPolice = new Map<string, typeof contrats>();
    for (const c of contrats) {
      const k = clePolice(c.numeroPolice ?? "");
      if (k) (parPolice.get(k) ?? parPolice.set(k, []).get(k)!).push(c);
    }
    const etiquette = new Map(contrats.map((c) => [c.id, c.numeroPolice ?? c.id]));
    const toutes: Aff[] = await this.prisma.assureSante.findMany({
      select: { id: true, matricule: true, nom: true, prenom: true, telephone: true, statut: true, familleId: true, contratId: true, dateNaissance: true, sexe: true, typeAssure: true, identiteId: true },
    });
    const parMatricule = new Map<string, Aff[]>();
    for (const a of toutes) (parMatricule.get(a.matricule.toLowerCase()) ?? parMatricule.set(a.matricule.toLowerCase(), []).get(a.matricule.toLowerCase())!).push(a);
    const numerosPris = new Set(toutes.filter((a) => a.familleId === null && a.telephone).map((a) => cle9(a.telephone!)));

    const anomalies = new Map<string, Anomalie>();
    const noter = (type: string, libelle: string, exemple: string) => {
      const a = anomalies.get(type) ?? anomalies.set(type, { type, libelle, nombre: 0, exemples: [] }).get(type)!;
      a.nombre++;
      if (a.exemples.length < 8 && !a.exemples.includes(exemple)) a.exemples.push(exemple);
    };
    const ecartsMap = new Map<string, EcartDonnee>();
    const ecart = (champ: string, exemple: string, note?: string) => {
      const e = ecartsMap.get(champ) ?? ecartsMap.set(champ, { champ, nombre: 0, exemples: [] }).get(champ)!;
      e.nombre++;
      if (e.exemples.length < 6) e.exemples.push(exemple);
      if (note) e.note = note;
    };
    const constats: string[] = [];
    const resumes = new Map<FeuilleReconnue, string[]>();
    const resume = (f: FeuilleReconnue, ligne: string) => (resumes.get(f) ?? resumes.set(f, []).get(f)!).push(ligne);

    // ── Feuilles annexes : doublons supprimés et points à vérifier ────────
    const ancienVersNouveau = new Map<string, string>();
    const nouveauVersAnciens = new Map<string, string[]>();
    const paires: { supprime: string; conserve: string; nom: string }[] = [];
    for (const f of roles.doublons) {
      for (const r of f.feuille.lignes) {
        const s = v(r, f.col.supprime), k = v(r, f.col.conserve);
        if (!s || !k || s.toLowerCase() === k.toLowerCase()) continue;
        paires.push({ supprime: s, conserve: k, nom: `${v(r, f.col.nom)} ${v(r, f.col.prenom)}`.trim() });
        ancienVersNouveau.set(s.toLowerCase(), k);
        (nouveauVersAnciens.get(k.toLowerCase()) ?? nouveauVersAnciens.set(k.toLowerCase(), []).get(k.toLowerCase())!).push(s);
      }
    }
    const nomsIncertains = new Set<string>(); // noms de la source signalés « à vérifier » : jamais comparés ni recopiés
    for (const f of roles.anomalies) for (const r of f.feuille.lignes) { const m = v(r, f.col.matricule).toLowerCase(); if (m) nomsIncertains.add(m); }

    // ── Lignes du population, contrat résolu ──────────────────────────────
    interface LigneFichier {
      ligne: number; police: string; matricule: string; tel: string; prenom: string; nom: string; souscripteur: string;
      statut: string; type?: TypeAssure; naissance: string; sexe?: "M" | "F"; contratId: string | null;
    }
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
        if (!cible) noter("police_ambigue", "Numéros de contrat portés par plusieurs contrats", police);
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
      lignes.push({
        ligne, police, matricule, tel: v(r, col.telephone), prenom: v(r, col.prenom), nom: v(r, col.nom), souscripteur, statut: v(r, col.statut),
        type: typeAssureDepuisFichier(v(r, col.type)), naissance: v(r, col.dateNaissance), sexe: sexeDepuisFichier(v(r, col.sexe)), contratId: cible?.id ?? null,
      });
    });

    // ── 1re passe : à quelle fiche de la base correspond chaque ligne ─────
    const parMat = new Map<string, LigneFichier[]>();
    for (const l of lignes) (parMat.get(l.matricule.toLowerCase()) ?? parMat.set(l.matricule.toLowerCase(), []).get(l.matricule.toLowerCase())!).push(l);
    interface Paire { aff?: Aff; deplacer: boolean; creer: boolean; renommer: boolean }
    const decisions = new Map<string, Paire>(); // « matricule|contrat cible » → fiche
    const matriculesFichier = new Set(parMat.keys());
    let alignables = 0;
    for (const [mat, rows] of parMat) {
      const resolues = rows.filter((r) => r.contratId);
      if (resolues.length === 0) continue;
      let db = parMatricule.get(mat) ?? [];
      let renommer = false;
      if (db.length === 0) {
        // Absent sous ce matricule : il est peut-être encore enregistré sous son ancien matricule (feuille « doublons supprimés »).
        for (const ancien of nouveauVersAnciens.get(mat) ?? []) {
          const d = parMatricule.get(ancien.toLowerCase());
          if (d?.length) { db = d; renommer = true; alignables++; break; }
        }
      }
      const cibles = new Set(resolues.map((r) => r.contratId!));
      const sansAffiliation = resolues.filter((r) => !db.some((a) => a.contratId === r.contratId));
      const dbSeulement = db.filter((a) => !cibles.has(a.contratId));
      const p = new Map<string, Paire>();
      for (const r of resolues) p.set(r.contratId!, { aff: db.find((a) => a.contratId === r.contratId), deplacer: false, creer: false, renommer: false });
      if (sansAffiliation.length > 0) {
        if (db.length === 0 || dbSeulement.length === 0) {
          for (const r of sansAffiliation) p.get(r.contratId!)!.creer = true;
        } else if (sansAffiliation.length === 1 && dbSeulement.length === 1) {
          const q = p.get(sansAffiliation[0].contratId!)!;
          q.aff = dbSeulement[0]; q.deplacer = true;
        } else {
          noter("matricule_multiple", "Matricules présents sur plusieurs contrats, rattachement ambigu (à vérifier à la main)", `${rows[0].matricule} (fichier : ${resolues.map((r) => r.police).join(", ")})`);
          continue;
        }
      }
      for (const [cid, q] of p) {
        if (renommer && q.aff) q.renommer = true;
        decisions.set(`${mat}|${cid}`, q);
      }
    }
    for (const pr of paires) {
      const s = parMatricule.get(pr.supprime.toLowerCase()), k = parMatricule.get(pr.conserve.toLowerCase());
      if (s?.length && k?.length) noter("doublon_en_base", "Doublons toujours présents dans l'application (ancien ET nouveau matricule) : à fusionner à la main", `${pr.supprime} → ${pr.conserve} ${pr.nom}`.trim());
    }

    // ── Familles : un seul assuré principal par (contrat, téléphone) ──────
    const groupesAS = new Map<string, LigneFichier[]>();
    for (const l of lignes.filter((x) => x.contratId && x.type === "AS" && chiffres(x.tel))) {
      const k = `${l.contratId}|${cle9(l.tel)}`;
      (groupesAS.get(k) ?? groupesAS.set(k, []).get(k)!).push(l);
    }
    const racineDe = (l: LigneFichier): { assureId?: string; matricule: string } | null => {
      if (!l.contratId || !chiffres(l.tel)) return null;
      const g = groupesAS.get(`${l.contratId}|${cle9(l.tel)}`);
      if (!g || g.length !== 1) return null;
      const d = decisions.get(`${g[0].matricule.toLowerCase()}|${l.contratId}`);
      if (!d) return null;
      if (d.aff) return d.aff.familleId === null ? { assureId: d.aff.id, matricule: g[0].matricule } : null;
      return d.creer ? { matricule: g[0].matricule } : null;
    };

    // ── 2e passe : actions par assuré ─────────────────────────────────────
    const assures: ActionAssure[] = [];
    let inchanges = 0, ayantsDroitTelephone = 0;
    const racinesADeplacer: ActionAssure[] = [];
    for (const l of lignes) {
      if (!l.contratId) continue;
      const d = decisions.get(`${l.matricule.toLowerCase()}|${l.contratId}`);
      if (!d) continue;
      const contratCible = contrats.find((c) => c.id === l.contratId)!;
      const aff = d.aff;
      const action: ActionAssure = {
        ligne: l.ligne, matricule: l.matricule, nom: l.nom || aff?.nom || "", prenom: l.prenom || aff?.prenom || "",
        policeFichier: l.police, contratCibleId: l.contratId, policeCible: etiquette.get(l.contratId) ?? l.police,
      };
      if (!aff) {
        if (!d.creer) continue;
        const type = l.type ?? "AS";
        if (type !== "AS") {
          const racine = racineDe(l);
          if (!racine) { noter("ayant_droit_sans_principal", "Ayants droit à créer dont l'assuré principal n'est pas identifiable (même contrat et même téléphone)", `${l.matricule} ${l.nom}`.trim()); continue; }
          action.racineAssureId = racine.assureId; action.racineMatricule = racine.matricule;
        }
        action.creer = true; action.typeCreation = type;
        action.naissance = l.naissance || undefined; action.sexe = l.sexe;
        if (type === "AS") action.telephone = this.telephoneUtile(l.tel);
        const voulueCreation = statutDepuisFichier(l.statut);
        if (voulueCreation === "Suspendu") action.statutVers = "Suspendu";
        assures.push(action);
        continue;
      }
      action.assureId = aff.id; action.statutActuel = aff.statut; action.identiteId = aff.identiteId ?? undefined;
      action.contratActuelId = aff.contratId; action.policeActuelle = etiquette.get(aff.contratId) ?? aff.contratId;
      let modifie = false;
      if (d.deplacer) { action.deplacer = true; modifie = true; if (aff.familleId === null) racinesADeplacer.push(action); }
      if (d.renommer) { action.ancienMatricule = aff.matricule; modifie = true; }

      const voulu = statutDepuisFichier(l.statut);
      if (voulu && aff.statut !== "Radié" && aff.statut !== voulu) {
        if (voulu === "Actif" && !STATUTS_CONTRAT_ACTIFS.includes(contratCible.statut)) {
          noter("contrat_inactif", "Réactivations refusées : le contrat est résilié ou expiré", `${l.matricule} → police ${action.policeCible} (${contratCible.statut})`);
        } else { action.statutVers = voulu; modifie = true; }
      }

      const tel = this.telephoneUtile(l.tel);
      if (tel && !aff.telephone) {
        if (aff.familleId !== null || (l.type && l.type !== "AS")) ayantsDroitTelephone++;
        else if (numerosPris.has(cle9(tel))) noter("telephone_utilise", "Numéros déjà portés par une autre famille (un numéro = une famille)", `${l.matricule} : ${tel}`);
        else { action.telephone = tel; numerosPris.add(cle9(tel)); modifie = true; }
      }

      // Date de naissance et sexe : complétés seulement s'ils manquent ; tout désaccord est signalé, jamais écrasé.
      if (l.naissance) {
        if (!aff.dateNaissance) { action.naissance = l.naissance; modifie = true; }
        else if (aff.dateNaissance !== l.naissance) ecart("Date de naissance différente", `${l.matricule} : base ${aff.dateNaissance} / fichier ${l.naissance}`, dateInversee(aff.dateNaissance, l.naissance) ? "jour et mois inversés pour certaines" : undefined);
      }
      if (l.sexe) {
        if (!aff.sexe) { action.sexe = l.sexe; modifie = true; }
        else if (aff.sexe !== l.sexe) ecart("Sexe différent", `${l.matricule} : base ${aff.sexe} / fichier ${l.sexe}`);
      }
      if (!nomsIncertains.has(l.matricule.toLowerCase()) && !nomsCompatibles(motsNom(l.nom, l.prenom), motsNom(aff.nom, aff.prenom))) {
        ecart("Nom différent", `${l.matricule} : base « ${aff.nom} ${aff.prenom ?? ""} » / fichier « ${l.nom} ${l.prenom} »`.replace(/\s+/g, " "));
      }

      // Type AS / CJ / EF et lien familial.
      if (l.type && aff.typeAssure !== l.type) {
        if (aff.familleId !== null) {
          if (l.type === "AS") ecart("Assuré principal rattaché à une famille dans l'application", `${l.matricule} ${l.nom}`.trim(), "non modifié : à vérifier à la main");
          else { action.typeVers = l.type; action.typeActuel = aff.typeAssure ?? "—"; modifie = true; }
        } else if (l.type === "AS") { action.typeVers = "AS"; action.typeActuel = aff.typeAssure ?? "—"; modifie = true; }
        else {
          const racine = racineDe(l);
          if (racine?.assureId && racine.assureId !== aff.id) { action.typeVers = l.type; action.typeActuel = aff.typeAssure ?? "—"; action.racineAssureId = racine.assureId; modifie = true; }
          else noter("ayant_droit_sans_principal", "Ayants droit dont l'assuré principal n'est pas identifiable (même contrat et même téléphone)", `${l.matricule} ${l.nom}`.trim());
        }
      }
      if (modifie) assures.push(action); else inchanges++;
    }

    // Ayants droit non listés dans le fichier : ils suivent leur assuré principal déplacé.
    let membresSuivent = 0;
    if (racinesADeplacer.length > 0) {
      const racines = new Set(racinesADeplacer.map((a) => a.assureId!));
      const parRacine = new Map<string, string[]>();
      for (const m of toutes.filter((x) => x.familleId && racines.has(x.familleId) && !matriculesFichier.has(x.matricule.toLowerCase()))) {
        (parRacine.get(m.familleId!) ?? parRacine.set(m.familleId!, []).get(m.familleId!)!).push(m.id);
      }
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
    let contratsLus = 0, contratsConnus = 0, effectifsIncoherents = 0;
    const exProduit: string[] = [];
    if (roles.contrats) {
      const rc = roles.contrats;
      const c2 = rc.col;
      for (const r of rc.feuille.lignes) {
        const police = v(r, c2.police);
        if (!police || /^total/i.test(normaliserCle(police))) continue;
        contratsLus++;
        const candidats = parPolice.get(clePolice(police)) ?? [];
        const souscripteurFichier = v(r, c2.souscripteur);
        const filtres = candidats.length > 1 ? candidats.filter((c) => memeSouscripteur(c.client?.nom ?? "", souscripteurFichier)) : candidats;
        if (filtres.length !== 1) {
          noter(candidats.length === 0 ? "contrat_synthese_introuvable" : "contrat_synthese_ambigu", candidats.length === 0 ? "Contrats de la synthèse absents de l'application (création impossible sans compagnie ni dates)" : "Contrats de la synthèse portés par plusieurs contrats", `${police} — ${v(r, c2.produit) || souscripteurFichier}`);
          continue;
        }
        const c = filtres[0];
        contratsConnus++;
        const attendu = Number(v(r, c2.nbPersonnes).replace(/\D/g, ""));
        const dansFeuille = nbParContrat.get(clePolice(police)) ?? 0;
        if (attendu && attendu !== dansFeuille) { effectifsIncoherents++; if (constats.length < 25) constats.push(`Police ${police} : la synthèse annonce ${attendu} personne(s), la feuille de population en compte ${dansFeuille}.`); }
        const statutF = v(r, c2.statutContrat);
        if (statutF && !statutContratEquivalent(statutF, c.statut)) ecart("Statut du contrat différent", `${police} : base ${c.statut} / fichier ${statutF}`);
        for (const [champ, fichier, base] of [["Date de début du contrat différente", v(r, c2.dateDebut), c.dateDebut], ["Date de fin du contrat différente", v(r, c2.dateFin), c.dateFin]] as const) {
          if (fichier && fichier !== base) ecart(champ, `${police} : base ${base || "—"} / fichier ${fichier}`);
        }
        actionsContrats.push({
          contratId: c.id, police: c.numeroPolice ?? police, produitActuel: c.produit ?? "", produitFichier: v(r, c2.produit),
          souscripteurBase: c.client?.nom ?? "", souscripteurFichier, ecartSouscripteur: !memeSouscripteur(c.client?.nom ?? "", souscripteurFichier),
        });
        if (exProduit.length < 3 && v(r, c2.produit) && c.produit && normaliserCle(v(r, c2.produit)) !== normaliserCle(c.produit)) exProduit.push(`${police}`);
      }
    }
    if (doublonsFichier > 0) constats.push(`${doublonsFichier} ligne(s) répétée(s) dans le fichier (même matricule, même contrat) comptée(s) une seule fois.`);
    if (ayantsDroitTelephone > 0) constats.push(`${ayantsDroitTelephone} numéro(s) de téléphone concernent des ayants droit : le numéro n'est porté que par l'assuré principal de la famille, ils sont ignorés.`);
    const radies = lignes.filter((l) => (parMatricule.get(l.matricule.toLowerCase()) ?? []).some((a) => a.statut === "Radié")).length;
    if (radies > 0) constats.push(`${radies} ligne(s) concernent des assurés « Radié » (sortie définitive) : leur statut n'est jamais modifié par un fichier.`);

    // ── Rapport par feuille ───────────────────────────────────────────────
    const matriculesBase = new Set(toutes.map((a) => a.matricule.toLowerCase()));
    const analyses = roles.toutes.map((f) => this.analyserFeuille(f, matriculesBase, new Set(parPolice.keys()), resumes.get(f) ?? []));
    const rp = roles.participants;
    const decidees = [...decisions.values()];
    resume(rp, `${feuille.lignes.length} ligne(s) lues, ${lignes.filter((l) => l.contratId).length} personne(s) rattachée(s) à une police connue.`);
    resume(rp, `${decidees.filter((d) => d.aff).length} retrouvée(s) dans l'application, ${decidees.filter((d) => d.creer).length} absente(s).`);
    resume(rp, `Comparaison : ${assures.filter((a) => a.statutVers).length} statut(s), ${deplacements.length} contrat(s), ${assures.filter((a) => a.typeVers).length} type(s), ${assures.filter((a) => a.naissance && !a.creer).length} date(s) de naissance manquante(s), ${assures.filter((a) => a.telephone && !a.creer).length} téléphone(s).`);
    if (roles.contrats) resume(roles.contrats, `${contratsLus} contrat(s) : ${contratsConnus} reconnu(s) dans l'application, ${effectifsIncoherents} effectif(s) incohérent(s) avec la population, ${actionsContrats.filter((c) => c.ecartSouscripteur).length} souscripteur(s) à vérifier${exProduit.length ? `, libellés produit différents (ex. ${exProduit.join(", ")})` : ""}.`);
    for (const f of roles.doublons) {
      const s = paires.filter((p) => parMatricule.has(p.supprime.toLowerCase())).length, k = paires.filter((p) => parMatricule.has(p.conserve.toLowerCase())).length;
      const deux = paires.filter((p) => parMatricule.has(p.supprime.toLowerCase()) && parMatricule.has(p.conserve.toLowerCase())).length;
      resume(f, `${paires.length} paire(s) ancien → nouveau matricule : ancien encore en base ${s}, nouveau en base ${k}, les deux (doublon réel à fusionner) ${deux}.`);
      resume(f, `${alignables} personne(s) enregistrée(s) sous l'ancien matricule peuvent être alignées sur le nouveau.`);
    }
    for (const f of roles.anomalies) {
      const parPoint = new Map<string, number>();
      for (const r of f.feuille.lignes) { const p = v(r, f.col.motif).split("(")[0].trim() || "—"; parPoint.set(p, (parPoint.get(p) ?? 0) + 1); }
      resume(f, `${f.feuille.lignes.length} ligne(s) à vérifier : ${[...parPoint].map(([p, n]) => `${n} « ${p} »`).join(", ")}.`);
      resume(f, `${f.feuille.lignes.filter((r) => parMatricule.has(v(r, f.col.matricule).toLowerCase())).length} sont déjà dans l'application : leur nom n'est ni comparé ni modifié.`);
    }
    for (const f of roles.remarques) for (const r of f.feuille.lignes) resume(f, `Police ${v(r, f.col.police)} : ${v(r, f.col.motif)}`);
    for (const f of roles.autres) resume(f, "Aucune règle automatique : colonnes et rapprochement avec la base indiqués ci-dessus, rien n'est importé depuis cette feuille.");
    const feuillesAnalysees = roles.toutes.map((f, i) => ({ ...analyses[i], resume: resumes.get(f) ?? [] }));

    const plan: Plan = { id: randomUUID(), societeId: TenantContext.getSocieteId(), creeLe: Date.now(), nomFichier, assures, contrats: actionsContrats };
    this.purger();
    this.plans.set(plan.id, plan);

    const echant = (liste: ActionAssure[], detail: (a: ActionAssure) => string): LigneEchantillon[] =>
      liste.slice(0, 25).map((a) => ({ matricule: a.matricule, nom: `${a.nom} ${a.prenom}`.trim(), detail: detail(a) }));
    const suspensions = assures.filter((a) => a.statutVers === "Suspendu");
    const reactivations = assures.filter((a) => a.statutVers === "Actif");
    const avecTel = assures.filter((a) => a.telephone && !a.creer);
    const typesCorriges = assures.filter((a) => a.typeVers);
    const alignements = assures.filter((a) => a.ancienMatricule);

    return {
      typeDetecte: "classeur", planId: plan.id, nomFichier,
      feuilles: feuillesAnalysees,
      totaux: {
        lignesParticipants: feuille.lignes.length,
        assuresTrouves: assures.filter((a) => a.assureId).length + inchanges,
        inchanges, suspensions: suspensions.length, reactivations: reactivations.length,
        deplacements: deplacements.length, membresSuivent, telephonesAjoutes: avecTel.length,
        absents: assures.filter((a) => a.creer).length, prestationsSuivent,
        naissancesAjoutees: assures.filter((a) => a.naissance && !a.creer).length, sexesAjoutes: assures.filter((a) => a.sexe && !a.creer).length,
        typesCorriges: typesCorriges.length, rattachements: typesCorriges.filter((a) => a.racineAssureId).length, alignements: alignements.length,
        contratsProduitVide: actionsContrats.filter((c) => !c.produitActuel && c.produitFichier).length,
        contratsProduitEcart: actionsContrats.filter((c) => c.produitActuel && c.produitFichier && normaliserCle(c.produitActuel) !== normaliserCle(c.produitFichier)).length,
        contratsSouscripteurEcart: actionsContrats.filter((c) => c.ecartSouscripteur).length,
      },
      echantillons: {
        suspensions: echant(suspensions, (a) => `${a.statutActuel} → Suspendu (police ${a.policeCible})`),
        reactivations: echant(reactivations, (a) => `${a.statutActuel} → Actif (police ${a.policeCible})`),
        deplacements: echant(deplacements, (a) => `police ${a.policeActuelle} → ${a.policeCible}${a.membresIds?.length ? ` (+${a.membresIds.length} ayant(s) droit)` : ""}`),
        telephones: echant(avecTel, (a) => a.telephone ?? ""),
        absents: echant(assures.filter((a) => a.creer), (a) => `${a.typeCreation} à créer sur la police ${a.policeCible}`),
        types: echant(typesCorriges, (a) => `${a.typeActuel} → ${a.typeVers}${a.racineAssureId ? " + rattaché à son assuré principal" : ""}`),
        alignements: echant(alignements, (a) => `${a.ancienMatricule} → ${a.matricule}`),
      },
      contrats: actionsContrats.map(({ police, produitActuel, produitFichier, souscripteurBase, souscripteurFichier, ecartSouscripteur }) => ({ police, produitActuel, produitFichier, souscripteurBase, souscripteurFichier, ecartSouscripteur })),
      ecarts: [...ecartsMap.values()].sort((a, b) => b.nombre - a.nombre),
      anomalies: [...anomalies.values()].sort((a, b) => b.nombre - a.nombre),
      constats,
      options: OPTIONS_CLASSEUR_PAR_DEFAUT,
    };
  }

  // Profil d'une feuille : pour chaque colonne, ce qu'elle contient, son taux de remplissage et, pour les
  // colonnes matricule / contrat, la part des valeurs retrouvées dans la base. Une colonne dont l'en-tête est
  // inconnu est reconnue à son contenu (valeurs présentes dans la base, téléphones, dates, listes courtes).
  private analyserFeuille(f: FeuilleReconnue, matriculesBase: Set<string>, policesBase: Set<string>, resume: string[]): AnalyseFeuille {
    const { feuille, col } = f;
    const sens: Record<number, string> = {};
    const noms: [keyof ColonnesClasseur, string][] = [
      ["police", "n° de contrat"], ["matricule", "matricule"], ["telephone", "téléphone"], ["prenom", "prénom"], ["nom", "nom"],
      ["souscripteur", "souscripteur"], ["produit", "produit"], ["statut", "statut de la personne"], ["statutContrat", "statut du contrat"],
      ["type", "type (AS / CJ / EF)"], ["dateNaissance", "date de naissance"], ["sexe", "sexe"], ["dateDebut", "date de début"], ["dateFin", "date de fin"],
      ["nbPersonnes", "effectif"], ["motif", "point à vérifier / remarque"], ["supprime", "matricule supprimé"], ["conserve", "matricule conservé"],
    ];
    for (const [k, libelle] of noms) if (col[k] >= 0) sens[col[k]] = libelle;
    const colonnes = feuille.entetes.map((entete, i) => {
      const valeurs = feuille.lignes.map((r) => (r[i] ?? "").trim());
      const pleines = valeurs.filter(Boolean);
      const remplies = valeurs.length ? Math.round((pleines.length / valeurs.length) * 100) : 0;
      const echantillon = pleines.slice(0, 500);
      const part = (pred: (s: string) => boolean) => (echantillon.length ? echantillon.filter(pred).length / echantillon.length : 0);
      let libelle = sens[i];
      let rapprochees: number | undefined;
      if (libelle === "matricule" || libelle === "matricule supprimé" || libelle === "matricule conservé") rapprochees = Math.round(part((s) => matriculesBase.has(s.toLowerCase())) * 100);
      else if (libelle === "n° de contrat") rapprochees = Math.round(part((s) => policesBase.has(clePolice(s))) * 100);
      else if (!libelle && echantillon.length > 0) {
        if (part((s) => matriculesBase.has(s.toLowerCase())) >= 0.5) { libelle = "matricule (reconnu par son contenu)"; rapprochees = Math.round(part((s) => matriculesBase.has(s.toLowerCase())) * 100); }
        else if (part((s) => policesBase.has(clePolice(s))) >= 0.5) { libelle = "n° de contrat (reconnu par son contenu)"; rapprochees = Math.round(part((s) => policesBase.has(clePolice(s))) * 100); }
        else if (part((s) => /^\+?[\d ]{7,}$/.test(s)) >= 0.7) libelle = "téléphone (par son contenu)";
        else if (part((s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) >= 0.7) libelle = "date";
        else if (part((s) => /^-?\d+([.,]\d+)?$/.test(s)) >= 0.9) libelle = "nombre";
        else {
          const distincts = [...new Set(pleines)];
          libelle = distincts.length <= 8 ? `liste de valeurs (${distincts.slice(0, 6).join(", ")})` : "texte";
        }
      }
      return { entete: entete || `(colonne ${i + 1})`, sens: libelle ?? "texte", remplies, rapprochees };
    });
    return { nom: feuille.nom, role: LIBELLE_ROLE[f.role], lignes: feuille.lignes.length, colonnes, resume };
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
      telephonesAjoutes: 0, crees: 0, produitsMisAJour: 0, naissancesAjoutees: 0, sexesAjoutes: 0, typesCorriges: 0, rattaches: 0, alignes: 0,
      ignores: 0, erreurs: [],
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

    // 0. Alignement sur le matricule conservé (l'ancien reste recherchable)
    if (opt.matricules) {
      for (const a of plan.assures.filter((x) => x.ancienMatricule && x.assureId)) {
        try {
          const pris = await this.prisma.assureSante.findFirst({ where: { matricule: a.matricule, contratId: a.contratActuelId!, id: { not: a.assureId } }, select: { id: true } });
          if (pris) { bilan.ignores++; bilan.erreurs.push(`Matricule ${a.matricule} déjà présent sur la police ${a.policeActuelle} : alignement de ${a.ancienMatricule} impossible.`); continue; }
          await this.prisma.assureSante.update({ where: { id: a.assureId! }, data: { matricule: a.matricule } });
          if (a.identiteId) {
            const ancien = await this.prisma.matriculeAssuree.findFirst({ where: { matricule: a.ancienMatricule, identiteId: a.identiteId }, select: { id: true } });
            if (ancien) await this.prisma.matriculeAssuree.update({ where: { id: ancien.id }, data: { statut: "Ancien" } });
            const nouveau = await this.prisma.matriculeAssuree.findFirst({ where: { matricule: a.matricule }, select: { id: true, identiteId: true } });
            if (!nouveau) await this.prisma.matriculeAssuree.create({ data: { matricule: a.matricule, identiteId: a.identiteId, statut: "Actuel" } });
            else if (nouveau.identiteId === a.identiteId) await this.prisma.matriculeAssuree.update({ where: { id: nouveau.id }, data: { statut: "Actuel" } });
            const identiteLibre = !(await this.prisma.identiteAssuree.findFirst({ where: { matricule: a.matricule, id: { not: a.identiteId } }, select: { id: true } }));
            if (identiteLibre) await this.prisma.identiteAssuree.update({ where: { id: a.identiteId }, data: { matricule: a.matricule } });
          }
          bilan.alignes++;
        } catch (e) { bilan.ignores++; bilan.erreurs.push(`Alignement de ${a.ancienMatricule} impossible : ${e instanceof Error ? e.message : "erreur"}`); }
      }
    }

    // 1. Rattachement aux contrats (avant les statuts : la règle d'activité dépend du contrat cible)
    if (opt.contrats) {
      const groupes = new Map<string, { ancien: string; cible: string; ids: string[]; membres: string[] }>();
      for (const a of plan.assures.filter((x) => x.deplacer && x.assureId)) {
        const k = `${a.contratActuelId}>${a.contratCibleId}`;
        const g = groupes.get(k) ?? groupes.set(k, { ancien: a.contratActuelId!, cible: a.contratCibleId, ids: [], membres: [] }).get(k)!;
        g.ids.push(a.assureId!); g.membres.push(...(a.membresIds ?? []));
      }
      for (const g of groupes.values()) {
        bilan.deplaces += await majAssures(g.ids, { contratId: g.cible }, g.ancien);
        bilan.membresDeplaces += await majAssures(g.membres, { contratId: g.cible }, g.ancien);
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

    // 2. Type AS/CJ/EF et rattachement des ayants droit à leur assuré principal
    if (opt.types) {
      const parType = new Map<string, string[]>();
      for (const a of plan.assures.filter((x) => x.typeVers && x.assureId && !x.racineAssureId)) (parType.get(a.typeVers!) ?? parType.set(a.typeVers!, []).get(a.typeVers!)!).push(a.assureId!);
      for (const [type, ids] of parType) { bilan.typesCorriges += await majAssures(ids, { typeAssure: type }); for (const a of plan.assures) if (a.typeVers === type) touches.add(a.contratCibleId); }
      for (const a of plan.assures.filter((x) => x.typeVers && x.assureId && x.racineAssureId)) {
        try {
          const [membre, racine, aDesMembres] = await Promise.all([
            this.prisma.assureSante.findFirst({ where: { id: a.assureId! }, select: { contratId: true, familleId: true } }),
            this.prisma.assureSante.findFirst({ where: { id: a.racineAssureId! }, select: { contratId: true, familleId: true } }),
            this.prisma.assureSante.count({ where: { familleId: a.assureId! } }),
          ]);
          if (!membre || !racine || racine.familleId !== null || membre.familleId !== null || aDesMembres > 0 || membre.contratId !== racine.contratId) { bilan.ignores++; continue; }
          // Un ayant droit porte le téléphone de sa racine : le sien est retiré (un numéro = une famille).
          await this.prisma.assureSante.update({ where: { id: a.assureId! }, data: { typeAssure: a.typeVers, familleId: a.racineAssureId, telephone: null } });
          bilan.typesCorriges++; bilan.rattaches++; touches.add(a.contratCibleId);
        } catch { bilan.ignores++; }
      }
    }

    // 3. Statuts
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

    // 4. Date de naissance et sexe manquants (jamais d'écrasement)
    if (opt.identite) {
      for (const a of plan.assures.filter((x) => x.assureId && !x.creer && (x.naissance || x.sexe))) {
        if (a.naissance) bilan.naissancesAjoutees += (await this.prisma.assureSante.updateMany({ where: { id: a.assureId!, dateNaissance: null }, data: { dateNaissance: a.naissance } })).count;
        if (a.sexe) bilan.sexesAjoutes += (await this.prisma.assureSante.updateMany({ where: { id: a.assureId!, sexe: null }, data: { sexe: a.sexe } })).count;
      }
    }

    // 5. Téléphones (assuré principal uniquement, un numéro = une famille)
    if (opt.telephones) {
      for (const a of plan.assures.filter((x) => x.telephone && x.assureId)) {
        try {
          bilan.telephonesAjoutes += (await this.prisma.assureSante.updateMany({ where: { id: a.assureId!, telephone: null, familleId: null }, data: { telephone: a.telephone } })).count;
        } catch { bilan.ignores++; bilan.erreurs.push(`Téléphone ${a.telephone} (matricule ${a.matricule}) : numéro déjà utilisé par une autre famille.`); }
      }
    }

    // 6. Création des personnes absentes — par le point d'entrée unique des mouvements (identité, compteurs, avenant d'incorporation).
    //    Assurés principaux d'abord, puis leurs ayants droit rattachés à la fiche créée ou existante.
    if (opt.creerAbsents) {
      const aujourdhui = new Date();
      const dateEffet = `${String(aujourdhui.getDate()).padStart(2, "0")}/${String(aujourdhui.getMonth() + 1).padStart(2, "0")}/${aujourdhui.getFullYear()}`;
      const idParMatricule = new Map<string, string>();
      const creer = async (contratId: string, liste: ActionAssure[], libelle: string) => {
        const ajout = (a: ActionAssure) => ({
          nom: a.nom || a.matricule, prenom: a.prenom || undefined, matricule: a.matricule, beneficiaires: 1, cotisation: 0,
          typeAssure: a.typeCreation ?? "AS", dateNaissance: a.naissance, sexe: a.sexe, telephone: a.telephone,
          familleId: a.racineAssureId ?? (a.racineMatricule ? idParMatricule.get(a.racineMatricule.toLowerCase()) : undefined),
        });
        const OPTS = { ignorerAge: true };
        for (const lot of parLots(liste, 50)) {
          try {
            const r = await this.mouvements.appliquerMouvement(contratId, dateEffet, lot.map(ajout), [], OPTS);
            for (const c of r.crees) idParMatricule.set(c.matricule.toLowerCase(), c.id);
            bilan.crees += r.crees.length; touches.add(contratId);
          } catch {
            // Un lot refusé ne bloque pas les autres : reprise une personne à la fois.
            for (const a of lot) {
              const data = ajout(a);
              try {
                const r = await this.mouvements.appliquerMouvement(contratId, dateEffet, [data], [], OPTS);
                for (const c of r.crees) idParMatricule.set(c.matricule.toLowerCase(), c.id);
                bilan.crees += r.crees.length; touches.add(contratId);
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                // Téléphone déjà utilisé : on réessaie sans (un numéro = une famille).
                if (data.telephone && /telephone|unique/i.test(msg)) {
                  try {
                    const r = await this.mouvements.appliquerMouvement(contratId, dateEffet, [{ ...data, telephone: undefined }], [], OPTS);
                    for (const c of r.crees) idParMatricule.set(c.matricule.toLowerCase(), c.id);
                    bilan.crees += r.crees.length; touches.add(contratId);
                  } catch (e2) { bilan.ignores++; bilan.erreurs.push(`${libelle} ${a.matricule} (police ${a.policeCible}) : ${e2 instanceof Error ? e2.message : "création impossible"}`); }
                } else { bilan.ignores++; bilan.erreurs.push(`${libelle} ${a.matricule} (police ${a.policeCible}) : ${msg}`); }
              }
            }
          }
        }
      };
      const parContrat = new Map<string, ActionAssure[]>();
      for (const a of plan.assures.filter((x) => x.creer)) (parContrat.get(a.contratCibleId) ?? parContrat.set(a.contratCibleId, []).get(a.contratCibleId)!).push(a);
      for (const [contratId, liste] of parContrat) {
        await creer(contratId, liste.filter((a) => (a.typeCreation ?? "AS") === "AS"), "Assuré principal");
        await creer(contratId, liste.filter((a) => (a.typeCreation ?? "AS") !== "AS"), "Ayant droit");
      }
      // Suspension a posteriori : les créés dont le fichier indique "Terminé" naissent "Actif" (mouvements)
      const aSuspendre = plan.assures
        .filter((x) => x.creer && x.statutVers === "Suspendu")
        .map((x) => idParMatricule.get(x.matricule.toLowerCase()))
        .filter((id): id is string => !!id);
      if (aSuspendre.length > 0)
        await this.prisma.assureSante.updateMany({ where: { id: { in: aSuspendre } }, data: { statut: "Suspendu" } });
    }

    // 7. Libellé produit des contrats (feuille de synthèse)
    if (opt.produits !== "aucun") {
      for (const c of plan.contrats) {
        if (!c.produitFichier) continue;
        const ecart = c.produitActuel && normaliserCle(c.produitActuel) !== normaliserCle(c.produitFichier);
        if (c.produitActuel && !(opt.produits === "tous" && ecart)) continue;
        await this.prisma.contrat.update({ where: { id: c.contratId }, data: { produit: c.produitFichier } });
        bilan.produitsMisAJour++;
      }
    }

    // 8. Primes recalculées d'après la population réelle des contrats touchés (jamais bloquant)
    if (touches.size > 0) {
      try { await recalculerPrimeSelonPopulation(this.prisma, [...touches]); }
      catch (e) { bilan.erreurs.push(`Recalcul des primes incomplet : ${e instanceof Error ? e.message : "erreur"}`); }
    }

    this.plans.delete(planId);
    return bilan;
  }
}
