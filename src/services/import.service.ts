import { http, downloadFile, uploadFile, getAccessToken, API_URL } from "@/lib/http";
import { importPopulation } from "@/services/sante.service";

// Onglet Import (Système) — 2026-08 — voir demande utilisateur : "pour
// permettre aux sociétés d'assurance qui voudraient changer de logiciel
// mais commencer à utiliser MedAssur... importer les factures saisies, les
// règlements qui ont été faits, importer même les photos dans un dossier en
// une fois... les prises en charge." Même patron que Contrats/Souscripteurs
// (modèle .xlsx téléchargeable → aperçu → confirmation, voir
// ImportEnMasseModal) pour les 3 imports structurés ; les photos ont leur
// propre mécanisme (fichiers multiples, appariés par matricule — voir
// uploaderPhotosEnMasse).

type Rejet = { ligne: number; motif: string };

// ── Factures ─────────────────────────────────────────────────────────
// Rattachées à UN contrat (2026-08 — voir demande utilisateur : "rendre
// l'import des factures... possible pour un contrat... les factures
// doivent s'importer par numéro matricule ou le nom de l'assuré ou
// l'ayant droit... soit le nom ou le matricule, pas les deux") — le
// MODÈLE reste léger (deux exemples, matricule OU nom — jamais rempli
// avec toute la population, voir demande utilisateur) ; c'est
// l'aperçu/la confirmation qui sont rattachés au contrat choisi,
// matricule/nom résolus dans SA population uniquement côté serveur (voir
// ImportService.resoudreAssureDuContrat).
export interface ImportFactureRow {
  matricule?: string; nom?: string; prenom?: string; prestataire: string; referenceFacture: string; dateReception: string;
  typePrestation: string; datePrestation: string; acteMedical?: string; montant: string;
  quantite?: string; statut?: string; motifRejet?: string;
}
export function telechargerModeleImportFactures(): Promise<void> {
  return downloadFile("/import/modele-factures", "modele-import-factures.xlsx");
}
export function apercuImportFactures(contratId: string, file: File): Promise<{ lignes: ImportFactureRow[]; rejets: Rejet[] }> {
  return uploadFile(`/import/factures/apercu?contratId=${encodeURIComponent(contratId)}`, file);
}
export function confirmerImportFactures(contratId: string, rows: ImportFactureRow[]): Promise<{ crees: number; rejets: Rejet[] }> {
  return http.post("/import/factures", { contratId, rows });
}

// ── Factures — import GLOBAL "tous contrats confondus" (2026-08) — voir
// demande utilisateur : "il faut aussi une option de fichier d'import de
// tous les contrats confondus. Dans celui-ci il faut juste faire remonter
// le numéro matricule... l'application seulement faire remonter les
// factures des matricules trouvés et mettre les autres en attente...
// gérer de façon optimum plus de 50000 lignes en une fois." Pas d'aperçu
// ligne à ligne (un tableau de 50 000 lignes gèlerait le navigateur) —
// upload direct, résultat en résumé.
export interface ResultatImportFacturesGlobal { total: number; crees: number; enAttente: number; rejets: Rejet[] }
export function telechargerModeleImportFacturesGlobal(): Promise<void> {
  return downloadFile("/import/modele-factures-global", "modele-import-factures-tous-contrats.xlsx");
}
export function importerFacturesGlobal(file: File): Promise<ResultatImportFacturesGlobal> {
  return uploadFile("/import/factures-global", file);
}

// File d'attente (2026-08 — voir demande utilisateur : "l'application
// devra systématiquement synchroniser [et] charger les factures sur les
// bons contrats") — rejoue les lignes dont le matricule est désormais
// connu (population chargée entre-temps). Appelé automatiquement après
// tout ajout de population (voir import-donnees/index.tsx), avec un
// bouton manuel en repli.
export function compterFacturesEnAttente(): Promise<{ nombre: number }> {
  return http.get("/import/factures-en-attente/nombre");
}
export function synchroniserFacturesEnAttente(): Promise<{ synchronisees: number; restantes: number; rejets: Rejet[] }> {
  return http.post("/import/factures-en-attente/synchroniser");
}

// ── Règlements ───────────────────────────────────────────────────────
export interface ImportReglementRow {
  prestataire: string; periode: string; montantTotal: string; montantValide?: string;
  nbPrisesEnCharge?: string; statut?: string; dateReception: string; datePaiement?: string; referenceVirement?: string;
}
export function telechargerModeleImportReglements(): Promise<void> {
  return downloadFile("/import/modele-reglements", "modele-import-reglements.xlsx");
}
export function apercuImportReglements(file: File): Promise<{ lignes: ImportReglementRow[]; rejets: Rejet[] }> {
  return uploadFile("/import/reglements/apercu", file);
}
export function confirmerImportReglements(rows: ImportReglementRow[]): Promise<{ crees: number; rejets: Rejet[] }> {
  return http.post("/import/reglements", { rows });
}

// ── Prises en charge ─────────────────────────────────────────────────
// Rattachées à UN contrat — même principe que Factures ci-dessus.
export interface ImportAccordPrealableRow {
  matricule?: string; nom?: string; prenom?: string; type: string; description?: string; dateDemande: string; prestataire: string;
  montantDevis?: string; decision?: string; montantAutorise?: string; dateDecision?: string;
}
export function telechargerModeleImportAccordsPrealables(): Promise<void> {
  return downloadFile("/import/modele-accords-prealables", "modele-import-prises-en-charge.xlsx");
}
export function apercuImportAccordsPrealables(contratId: string, file: File): Promise<{ lignes: ImportAccordPrealableRow[]; rejets: Rejet[] }> {
  return uploadFile(`/import/accords-prealables/apercu?contratId=${encodeURIComponent(contratId)}`, file);
}
export function confirmerImportAccordsPrealables(contratId: string, rows: ImportAccordPrealableRow[]): Promise<{ crees: number; rejets: Rejet[] }> {
  return http.post("/import/accords-prealables", { contratId, rows });
}

// ── Assurés et ayants droit ─────────────────────────────────────────
// Harmonise l'ancien import "Population" (Contrat > onglet Population,
// fichier .csv, voir demande utilisateur : "harmonise les modèles
// existants") sur le même patron .xlsx que le reste de cet onglet. Rattaché
// à UN contrat (choisi dans l'écran avant l'aperçu, voir ImportDonneesView)
// — la confirmation réutilise l'endpoint RÉEL déjà existant
// (SanteService.importPopulation), jamais une logique dupliquée ici.
export interface ImportAssureRow {
  matricule?: string; nom: string; prenom?: string; dateNaissance?: string; sexe?: string; typeAssure?: string; telephone?: string;
  // Actif | Inactif (2026-09) — facultatif, ne touche pas le statut
  // existant si vide/non reconnu (voir SanteService.normaliserStatutImport).
  statut?: string;
}
export function telechargerModeleImportAssures(): Promise<void> {
  return downloadFile("/import/modele-assures", "modele-import-assures.xlsx");
}
export function apercuImportAssures(file: File): Promise<{ lignes: ImportAssureRow[]; rejets: Rejet[] }> {
  return uploadFile("/import/assures/apercu", file);
}
export async function confirmerImportAssures(contratId: string, rows: ImportAssureRow[]): Promise<{ crees: number; rejets: Rejet[] }> {
  const res = await importPopulation(contratId, rows.map((r) => ({
    matricule: r.matricule ?? "", nom: r.nom, prenom: r.prenom ?? "", sexe: r.sexe ?? "",
    dateNaissance: r.dateNaissance ?? "", typeAssure: r.typeAssure ?? "", telephone: r.telephone ?? "",
    statut: r.statut ?? "",
  })));
  return { crees: res.imported + res.updated + res.basculees, rejets: res.rejected.map((rej) => ({ ligne: rej.ligne, motif: rej.motif })) };
}

// ── Photos en masse (2026-08) — voir demande utilisateur : "importer même
// les photos dans un dossier en une fois (mais il faudra juste que la photo
// soit renommée par les matricules de bénéficiaire de la photo)". Un
// dossier entier sélectionné en une fois (webkitdirectory côté écran) —
// chaque fichier est envoyé sous son propre nom, apparié côté serveur par
// son nom (sans extension) = matricule.
export async function importerPhotosEnMasse(fichiers: File[]): Promise<{ importees: number; rejets: { fichier: string; motif: string }[] }> {
  const token = getAccessToken();
  const form = new FormData();
  for (const f of fichiers) form.append("fichiers", f, f.name);
  const res = await fetch(`${API_URL}/import/photos`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /import/photos failed (${res.status}): ${await res.text()}`);
  return res.json();
}
