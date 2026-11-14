import { http } from "./http";

// Suivi de santé (2026-11) — miroir de src/services/suiviSante.service.ts
// (web) : rendez-vous, accès au dossier médical, contrôles de santé,
// conversion d'un document papier du carnet en bon électronique.

export type TypeRendezVous = "Consultation" | "Contrôle" | "Examen";
export type StatutRendezVous = "Demandé" | "Confirmé" | "Refusé" | "Annulé" | "Honoré" | "Absent";

export interface RendezVous {
  id: string; type: TypeRendezVous; specialite: string | null; motif: string | null; dateHeure: string; dureeMinutes: number; statut: StatutRendezVous; reponse: string | null;
  assure: { id: string; nom: string; prenom: string | null; matricule: string; telephone: string | null };
  medecin: { id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null; telephone: string | null } | null;
  prestataire: { id: string; nom: string; type: string | null; ville: string | null; adresse: string | null; telephone: string | null } | null;
}
export interface Professionnel {
  id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null; telephone: string | null; distanceKm: number | null;
  structures: { id: string; nom: string; type: string | null; ville: string | null; adresse: string | null; telephone: string | null; latitude: number | null; longitude: number | null; distanceKm: number | null }[];
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
export interface MesureSante { id: string; assureId: string; type: string; valeur: string; unite: string | null; dateMesure: string; note: string | null; medecinId: string | null }

export const TYPES_MESURE = ["Tension", "Glycémie", "Poids", "Température", "Fréquence cardiaque", "Saturation", "Autre"];
export const UNITE_MESURE: Record<string, string> = { Tension: "cmHg", Glycémie: "g/L", Poids: "kg", Température: "°C", "Fréquence cardiaque": "bpm", Saturation: "%" };
export const nomMedecin = (m: { nom: string; prenom: string | null; titre?: string | null }) => `${m.titre === "Professeur" ? "Pr" : "Dr"} ${`${m.prenom ?? ""} ${m.nom}`.trim()}`;
export const dateHeureFr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// Assuré
export const getMesRendezVous = () => http.get<RendezVous[]>("/portail-membre/suivi/rendez-vous");
export const prendreRendezVous = (dto: { assureId: string; medecinId?: string; prestataireId?: string; type: TypeRendezVous; specialite?: string; motif?: string; dateHeure: string }) => http.post<RendezVous>("/portail-membre/suivi/rendez-vous", dto);
export const annulerRendezVous = (id: string) => http.patch<RendezVous>(`/portail-membre/suivi/rendez-vous/${id}/annuler`);
const requete = (params: Record<string, string | number | undefined>) => {
  const qs = Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
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
export const ajouterMesure = (dto: { assureId: string; type: string; valeur: string; unite?: string; note?: string }) => http.post<MesureSante>("/portail-membre/suivi/mesures", dto);
export const supprimerMesure = (id: string) => http.delete(`/portail-membre/suivi/mesures/${id}`);

// Carnet : conversion d'un document papier en bon électronique
export interface LigneLue { type: "Medicament" | "Examen"; libelle: string; quantite: number; posologie: string; acteMedicalId: string | null; acteLibelle: string | null }
export interface LectureBon { assureId: string; lisible: boolean; typeDocument: string; prescripteur: string; titrePrescripteur: string; codePraticien: string; structure: string; codeEtablissement: string; date: string; codeAffection: string; remarques: string; lignes: LigneLue[]; cachetVisible?: boolean; cachetX?: number; cachetY?: number; cachetW?: number; cachetH?: number; }
export const lireBonPapier = (documentId: string) => http.post<LectureBon>(`/portail-membre/carnet-sante/${documentId}/lire`);
export const convertirBonPapier = (documentId: string, dto: { assureId: string; prescripteurNom?: string; titrePrescripteur?: string; codePraticien?: string; structureNom?: string; codeEtablissement?: string; dateOrdonnance?: string; codeAffection?: string; indicationsLibres?: string; cachetVisible?: boolean; cachetX?: number; cachetY?: number; cachetW?: number; cachetH?: number; lignes: { type: string; libelle: string; quantite: number; posologie?: string; acteMedicalId?: string }[] }) =>
  http.post<{ numeroOrdonnance: string | null; numeroBonExamen: string | null; prescriptionId: string }>(`/portail-membre/carnet-sante/${documentId}/convertir`, dto);

// Médecin
export interface PatientPartage { id: string; nom: string; prenom: string | null; matricule: string; dateNaissance: string | null; sexe: string | null; accesDepuis: string }
export interface DossierPatient {
  assure: { id: string; nom: string; prenom: string | null; matricule: string; dateNaissance: string | null; sexe: string | null; groupeSanguin: string | null; allergies: string[]; antecedentsMedicaux: string[]; traitementsEnCours: string[] };
  consultations: { id: string; date: string; type: string; codeAffection: string | null; structure: string | null; acte: string | null }[];
  prescriptions: { id: string; origine: string; date: string; prescripteur: string; codeAffection: string | null; lignes: { type: string; libelle: string; quantite: number; posologie: string | null }[] }[];
  documents: { id: string; rubrique: string; libelle: string | null; dateAjout: string }[];
  mesures: MesureSante[];
}
export const getRendezVousMedecin = () => http.get<RendezVous[]>("/portail-medecin/suivi/rendez-vous");
export const repondreRendezVousMedecin = (id: string, dto: { statut: "Confirmé" | "Refusé" | "Honoré" | "Absent"; reponse?: string; dateHeure?: string }) => http.patch<RendezVous>(`/portail-medecin/suivi/rendez-vous/${id}`, dto);
export const getPatientsPartages = () => http.get<PatientPartage[]>("/portail-medecin/suivi/patients");
export const getDossierPatient = (assureId: string) => http.get<DossierPatient>(`/portail-medecin/suivi/patients/${assureId}`);
export const ajouterMesurePatient = (assureId: string, dto: { type: string; valeur: string; unite?: string }) => http.post<MesureSante>(`/portail-medecin/suivi/patients/${assureId}/mesures`, dto);
export const cheminDocumentPatient = (assureId: string, documentId: string) => `/portail-medecin/suivi/patients/${assureId}/documents/${documentId}`;
export const cheminFeuilleExamenPrescriptionMedecin = (assureId: string, prescriptionId: string) => `/portail-medecin/suivi/patients/${assureId}/prescriptions/${prescriptionId}/feuille-examen`;

// "JJ/MM/AAAA" + "HH:MM" (heure du téléphone) → ISO ; null si invalide.
export function versIso(jour: string, heure: string): string | null {
  const j = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(jour.trim()), h = /^(\d{1,2})[:h](\d{2})$/.exec(heure.trim());
  if (!j || !h) return null;
  const d = new Date(Number(j[3]), Number(j[2]) - 1, Number(j[1]), Number(h[1]), Number(h[2]));
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(j[1]) ? null : d.toISOString();
}
