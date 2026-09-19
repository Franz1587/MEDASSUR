import { http } from "@/lib/http";
import type { StatutBon } from "@/lib/statutBon";

// Traiter un bon — côté structure (2026-08) — voir demande utilisateur :
// "en rentrant les coordonnées de l'assuré, renseigner le numéro du bon et
// la liste des examens/médicaments non traités sur le bon apparaîtra."
// Créer/gérer la prescription elle-même est désormais exclusif au portail
// médecin (voir src/services/portailMedecin.service.ts, User.medecinId) —
// ce fichier ne couvre plus que le TRAITEMENT d'un bon par un prestataire
// habilité (labo/clinique/hôpital pour les examens, pharmacie/dépôt
// pharmaceutique pour les ordonnances).
interface ApiMedecin { id: string; nom: string; prenom?: string | null; titre?: string | null }

// `acteMedicalId`/`prixDefaut` (2026-08) — voir demande utilisateur :
// "les produits sont également côté pharmacie, les montants des produits
// et les quantités doivent remonter" — pré-remplissage du montant/de la
// quantité à partir du prix de référence du catalogue, toujours modifiable
// manuellement ensuite (voir TraiterBon.tsx). `statut`/`quantiteTraitee`
// (2026-08) — voir demande utilisateur : "la deuxième pharmacie doit
// pouvoir [voir le] produit servi par la précédente... pourra voir la
// mention déjà servi" — une ligne prescrite peut être Traite/PartiellementTraite/
// EnAttente indépendamment des autres, le frontend désactive la sélection
// d'une ligne déjà entièrement traitée.
export interface LigneBon {
  id: string;
  libelle: string;
  quantite: number;
  quantiteTraitee: number;
  statut: StatutBon;
  posologie: string | null;
  acteLibelle?: string;
  acteMedicalId: string | null;
  prixDefaut: number | null;
}
// Identité du patient toujours renvoyée avec le bon (2026-08) — voir
// demande utilisateur : "on doit directement pouvoir renseigner la
// référence d'un bon depuis cette page" — le patient n'est plus forcément
// déjà identifié avant la recherche, c'est le bon qui le révèle.
export interface BonTrouve {
  prescriptionId: string;
  numero: string;
  date: string;
  medecinNom: string;
  lignes: LigneBon[];
  statut: StatutBon;
  assure: { id: string; nom: string; prenom: string | null; matricule: string };
}
interface ApiLigneBon {
  id: string; libelle: string; quantite: number; quantiteTraitee: number; statut: StatutBon;
  posologie: string | null; acteMedicalId: string | null;
  acteMedical?: { libelle: string; prixDefaut: string | number } | null;
}
interface ApiBonTrouve {
  prescriptionId: string; numero: string; date: string; medecin: ApiMedecin; lignes: ApiLigneBon[]; statut: StatutBon;
  assure: { id: string; nom: string; prenom: string | null; matricule: string };
}
function mapBon(data: ApiBonTrouve): BonTrouve {
  return {
    prescriptionId: data.prescriptionId, numero: data.numero, date: data.date,
    medecinNom: `${data.medecin.titre ? `${data.medecin.titre} ` : ""}${data.medecin.nom}${data.medecin.prenom ? ` ${data.medecin.prenom}` : ""}`,
    lignes: data.lignes.map((l) => ({
      id: l.id, libelle: l.libelle, quantite: l.quantite, quantiteTraitee: l.quantiteTraitee, statut: l.statut,
      posologie: l.posologie, acteLibelle: l.acteMedical?.libelle,
      acteMedicalId: l.acteMedicalId, prixDefaut: l.acteMedical?.prixDefaut != null ? Number(l.acteMedical.prixDefaut) : null,
    })),
    statut: data.statut, assure: data.assure,
  };
}

// `assureId` optionnel (2026-08) — recherche directe par le numéro du bon,
// sans identification préalable du patient (voir demande utilisateur).
export async function rechercherBon(type: "Examen" | "Ordonnance", numero: string, assureId?: string): Promise<BonTrouve> {
  const params = new URLSearchParams({ type, numero, ...(assureId ? { assureId } : {}) });
  const data = await http.get<ApiBonTrouve>(`/portail-prestataire/bons?${params.toString()}`);
  return mapBon(data);
}

// Liste des bons encore en attente pour un patient déjà identifié (2026-08)
// — voir demande utilisateur (correction) : "il faut que le prestataire
// recherche le patient et là le bon en attente peut s'afficher" — jamais
// listé sans recherche préalable (voir bonsTraitesPar pour la zone
// "historique" par défaut de l'écran).
export async function bonsEnAttente(type: "Examen" | "Ordonnance", assureId: string): Promise<BonTrouve[]> {
  const params = new URLSearchParams({ type, assureId });
  const data = await http.get<ApiBonTrouve[]>(`/portail-prestataire/bons/en-attente?${params.toString()}`);
  return data.map(mapBon);
}

// Historique des bons déjà traités PAR CE prestataire (2026-08) — voir
// demande utilisateur : "ne doivent apparaître ici que les bons qui ont
// déjà été traités par la pharmacie... ça ne doit [pas] directement
// apparaître comme ça chez tous les prestataires" — affiché par défaut à
// l'ouverture de l'écran "Traiter un bon", sans recherche préalable.
export async function bonsTraitesPar(type: "Examen" | "Ordonnance"): Promise<BonTrouve[]> {
  const params = new URLSearchParams({ type });
  const data = await http.get<ApiBonTrouve[]>(`/portail-prestataire/bons/historique?${params.toString()}`);
  return data.map(mapBon);
}

export async function traiterBon(payload: { assureId: string; date: string; lignes: { ligneId: string; montant: number; quantite?: number }[] }): Promise<{ id: string }> {
  const data = await http.post<{ id: string }>("/portail-prestataire/bons/traiter", payload);
  return { id: data.id };
}
