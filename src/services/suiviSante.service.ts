import { http, API_URL, getAccessToken } from "@/lib/http";
import { afficherPdf } from "@/lib/pdfViewerBridge";

// Suivi de santé (2026-11) : rendez-vous, accès au dossier médical,
// contrôles de santé — portails assuré, médecin et prestataire.

export type TypeRendezVous = "Consultation" | "Contrôle" | "Examen";
export type StatutRendezVous = "Demandé" | "Confirmé" | "Refusé" | "Annulé" | "Honoré" | "Absent";

export interface RendezVous {
  id: string;
  type: TypeRendezVous;
  specialite: string | null;
  motif: string | null;
  dateHeure: string;
  dureeMinutes: number;
  statut: StatutRendezVous;
  reponse: string | null;
  assure: { id: string; nom: string; prenom: string | null; matricule: string; telephone: string | null };
  medecin: { id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null; telephone: string | null } | null;
  prestataire: { id: string; nom: string; type: string | null; ville: string | null; adresse: string | null; telephone: string | null } | null;
}

export interface StructureProfessionnel {
  id: string; nom: string; type: string | null; ville: string | null; adresse: string | null; telephone: string | null;
  latitude: number | null; longitude: number | null; distanceKm: number | null;
}

export interface Professionnel {
  id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null; telephone: string | null;
  structures: StructureProfessionnel[]; distanceKm: number | null;
}

// Établissement de soins avec les spécialités de ses médecins enregistrés.
export interface StructureMedicale {
  id: string; nom: string; type: string | null; ville: string | null; adresse: string | null; telephone: string | null;
  latitude: number | null; longitude: number | null; distanceKm: number | null; nbMedecins: number; specialites: string[];
}

export interface AccesDossier {
  id: string; assureId: string; medecinId: string; actif: boolean; ouvertLe: string; fermeLe: string | null;
  medecin: { id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null };
  assure: { id: string; nom: string; prenom: string | null };
}

export interface MesureSante {
  id: string; assureId: string; type: string; valeur: string; unite: string | null; dateMesure: string; note: string | null; medecinId: string | null;
}

export const TYPES_MESURE = ["Tension", "Glycémie", "Poids", "Température", "Fréquence cardiaque", "Saturation", "Autre"] as const;
export const UNITE_MESURE: Record<string, string> = { Tension: "cmHg", Glycémie: "g/L", Poids: "kg", Température: "°C", "Fréquence cardiaque": "bpm", Saturation: "%" };

export const nomMedecin = (m: { nom: string; prenom: string | null; titre?: string | null }) => `${m.titre === "Professeur" ? "Pr" : "Dr"} ${`${m.prenom ?? ""} ${m.nom}`.trim()}`;
export const dateHeureFr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Assuré ──────────────────────────────────────────────────────────────
export const getMesRendezVous = () => http.get<RendezVous[]>("/portail-membre/suivi/rendez-vous");
export const prendreRendezVous = (dto: { assureId: string; medecinId?: string; prestataireId?: string; type: TypeRendezVous; specialite?: string; motif?: string; dateHeure: string }) =>
  http.post<RendezVous>("/portail-membre/suivi/rendez-vous", dto);
export const annulerRendezVous = (id: string) => http.patch<RendezVous>(`/portail-membre/suivi/rendez-vous/${id}/annuler`);
const requete = (params: Record<string, string | number | undefined>) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return qs ? `?${qs}` : "";
};
export const getProfessionnels = (params: { lat?: number; lng?: number; q?: string; prestataireId?: string; specialite?: string } = {}) =>
  http.get<Professionnel[]>(`/portail-membre/suivi/professionnels${requete(params)}`);
export const getStructuresMedicales = (params: { lat?: number; lng?: number } = {}) =>
  http.get<StructureMedicale[]>(`/portail-membre/suivi/structures${requete(params)}`);
export const getAccesDossier = () => http.get<AccesDossier[]>("/portail-membre/suivi/acces");
export const ouvrirAccesDossier = (assureId: string, medecinId: string) => http.post("/portail-membre/suivi/acces/ouvrir", { assureId, medecinId });
export const fermerAccesDossier = (assureId: string, medecinId: string) => http.post("/portail-membre/suivi/acces/fermer", { assureId, medecinId });
export const getMesMesures = () => http.get<MesureSante[]>("/portail-membre/suivi/mesures");
export const ajouterMesure = (dto: { assureId: string; type: string; valeur: string; unite?: string; dateMesure?: string; note?: string }) => http.post<MesureSante>("/portail-membre/suivi/mesures", dto);
export const supprimerMesure = (id: string) => http.delete(`/portail-membre/suivi/mesures/${id}`);

// ── Médecin / établissement ─────────────────────────────────────────────
export type Espace = "medecin" | "prestataire";
const racine = (e: Espace) => (e === "medecin" ? "/portail-medecin/suivi" : "/portail-prestataire/suivi");
export const getRendezVousPro = (e: Espace) => http.get<RendezVous[]>(`${racine(e)}/rendez-vous`);
export const repondreRendezVous = (e: Espace, id: string, dto: { statut: "Confirmé" | "Refusé" | "Honoré" | "Absent"; reponse?: string; dateHeure?: string; medecinId?: string }) =>
  http.patch<RendezVous>(`${racine(e)}/rendez-vous/${id}`, dto);

export interface PatientPartage { id: string; nom: string; prenom: string | null; matricule: string; dateNaissance: string | null; sexe: string | null; accesDepuis: string }
export interface DossierPatient {
  assure: { id: string; nom: string; prenom: string | null; matricule: string; dateNaissance: string | null; sexe: string | null; groupeSanguin: string | null; allergies: string[]; antecedentsMedicaux: string[]; traitementsEnCours: string[] };
  consultations: { id: string; date: string; type: string; codeAffection: string | null; structure: string | null; acte: string | null }[];
  prescriptions: { id: string; origine: string; date: string; prescripteur: string; numeroOrdonnance: string | null; numeroBonExamen: string | null; codeAffection: string | null; motifs: string[]; lignes: { type: string; libelle: string; quantite: number; posologie: string | null; statut: string }[] }[];
  documents: { id: string; rubrique: string; libelle: string | null; dateAjout: string }[];
  mesures: MesureSante[];
  rendezVous: RendezVous[];
}
export const getPatientsPartages = () => http.get<PatientPartage[]>("/portail-medecin/suivi/patients");
export const getDossierPatient = (assureId: string) => http.get<DossierPatient>(`/portail-medecin/suivi/patients/${assureId}`);
export const ajouterMesurePatient = (assureId: string, dto: { type: string; valeur: string; unite?: string; note?: string }) => http.post<MesureSante>(`/portail-medecin/suivi/patients/${assureId}/mesures`, dto);
export async function ouvrirDocumentPatient(assureId: string, documentId: string, nom: string) {
  const res = await fetch(`${API_URL}/portail-medecin/suivi/patients/${assureId}/documents/${documentId}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) throw new Error(res.status === 403 ? "Le patient a fermé l'accès à son dossier." : "Document indisponible.");
  afficherPdf({ blob: await res.blob(), nomFichier: `${nom}.pdf` });
}

// ── Carnet : conversion d'un document papier en bon électronique ───────
export interface LigneLue { type: "Medicament" | "Examen"; libelle: string; quantite: number; posologie: string; acteMedicalId: string | null; acteLibelle: string | null }
export interface LectureBon { assureId: string; lisible: boolean; typeDocument: string; prescripteur: string; titrePrescripteur: string; codePraticien: string; structure: string; codeEtablissement: string; date: string; patient: string; codeAffection: string; remarques: string; lignes: LigneLue[] }
export const lireBonPapier = (documentId: string) => http.post<LectureBon>(`/portail-membre/carnet-sante/${documentId}/lire`);
export const convertirBonPapier = (documentId: string, dto: { assureId: string; prescripteurNom?: string; titrePrescripteur?: string; codePraticien?: string; structureNom?: string; codeEtablissement?: string; dateOrdonnance?: string; codeAffection?: string; lignes: { type: string; libelle: string; quantite: number; posologie?: string; acteMedicalId?: string }[] }) =>
  http.post<{ numeroOrdonnance: string | null; numeroBonExamen: string | null }>(`/portail-membre/carnet-sante/${documentId}/convertir`, dto);
