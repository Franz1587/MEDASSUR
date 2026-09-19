import { http } from "@/lib/http";
import { openDocument } from "@/services/documents.service";

// Portail médecin (2026-08) — voir demande utilisateur : "le médecin doit
// avoir ses accès différents de ceux de la clinique ou l'hôpital... il
// n'a pas besoin d'identifier un assuré, il doit voir la liste des
// assurés qu'il doit recevoir (une file d'attente)". Compte distinct
// (User.medecinId), jamais rattaché à un Prestataire.

export interface MedecinStructure { id: string; nom: string; type: string; ville: string }
export interface MedecinMoi {
  id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null;
  codePraticien: string | null; structures: MedecinStructure[];
}
interface ApiMedecinMoi extends Omit<MedecinMoi, "structures"> { structures: { prestataire: MedecinStructure }[] }

export async function getMoiMedecin(): Promise<MedecinMoi> {
  const data = await http.get<ApiMedecinMoi>("/portail-medecin/moi");
  return { ...data, structures: data.structures.map((s) => s.prestataire) };
}

// File d'attente (2026-08) — voir demande utilisateur ci-dessus : les
// consultations déjà facturées (écran "Nouvelle prestation" de la
// structure), dans n'importe laquelle des structures de ce médecin, sans
// prescription encore.
export interface PatientEnAttente {
  id: string; // priseEnChargeId
  type: string;
  date: string;
  createdAt: string;
  acteLibelle: string | null;
  assureId: string;
  assureNom: string;
  assureMatricule: string;
  prestataireNom: string;
}
interface ApiPatientEnAttente {
  id: string; type: string; date: string; createdAt: string;
  acteMedical?: { libelle: string } | null;
  assureId: string; assure: { nom: string; prenom?: string | null; matricule: string };
  prestataireRef?: { nom: string } | null;
}

export async function getFileAttente(): Promise<PatientEnAttente[]> {
  const data = await http.get<ApiPatientEnAttente[]>("/portail-medecin/file-attente");
  return data.map((c) => ({
    id: c.id, type: c.type, date: c.date, createdAt: c.createdAt,
    acteLibelle: c.acteMedical?.libelle ?? null,
    assureId: c.assureId, assureNom: `${c.assure.nom} ${c.assure.prenom ?? ""}`.trim(), assureMatricule: c.assure.matricule,
    prestataireNom: c.prestataireRef?.nom ?? "—",
  }));
}

// Prescription (2026-08) — mêmes formes que src/services/prescriptions.service.ts
// (côté structure), mais routées vers le portail médecin — `medecinId`
// n'est jamais transmis, c'est TOUJOURS le médecin authentifié.
export interface PrescriptionLigne {
  id: string;
  type: "Medicament" | "Examen";
  acteMedicalId: string | null;
  libelle: string;
  quantite: number;
  quantiteTraitee: number;
  posologie: string | null;
  // Traitement partiel multi-prestataire (2026-08) — voir demande
  // utilisateur : "si la première pharmacie avait servi une quantité
  // insuffisante... la deuxième pharmacie pourra servir le reste".
  statut: "EnAttente" | "PartiellementTraite" | "Traite";
}
export interface Prescription {
  id: string;
  priseEnChargeId: string;
  motifsConsultation: string[];
  codeAffection: string | null;
  numeroBonExamen: string | null;
  numeroFeuilleSoins: string | null;
  assureId: string;
  assureNom: string;
  assureMatricule: string;
  // Date de la consultation d'origine (jj/mm/aaaa) — voir demande
  // utilisateur : "dossier médical de chaque patient... classé par date,
  // par an" (Dossiers Patients/Historique des prestations, 2026-08).
  date: string;
  acteLibelle: string | null;
  prestataireNom: string;
  createdAt: string;
  lignes: PrescriptionLigne[];
}
interface ApiPrescription {
  id: string; priseEnChargeId: string; motifsConsultation: string[]; codeAffection: string | null;
  numeroBonExamen: string | null; createdAt: string;
  lignes: PrescriptionLigne[];
  priseEnCharge: {
    numeroFeuilleSoins: string | null; date: string;
    assure: { id: string; nom: string; prenom?: string | null; matricule: string };
    prestataireRef?: { nom: string } | null;
    acteMedical?: { libelle: string } | null;
  };
}
function mapPrescription(p: ApiPrescription): Prescription {
  return {
    id: p.id, priseEnChargeId: p.priseEnChargeId, motifsConsultation: p.motifsConsultation, codeAffection: p.codeAffection,
    numeroBonExamen: p.numeroBonExamen, numeroFeuilleSoins: p.priseEnCharge.numeroFeuilleSoins,
    assureId: p.priseEnCharge.assure.id,
    assureNom: `${p.priseEnCharge.assure.nom} ${p.priseEnCharge.assure.prenom ?? ""}`.trim(),
    assureMatricule: p.priseEnCharge.assure.matricule,
    date: p.priseEnCharge.date, acteLibelle: p.priseEnCharge.acteMedical?.libelle ?? null,
    prestataireNom: p.priseEnCharge.prestataireRef?.nom ?? "—",
    createdAt: p.createdAt, lignes: p.lignes,
  };
}

export interface CreatePrescriptionLigneInput {
  type: "Medicament" | "Examen";
  acteMedicalId?: string;
  libelle: string;
  quantite?: number;
  posologie?: string;
}
export interface CreatePrescriptionInput {
  priseEnChargeId: string;
  motifsConsultation: string[];
  codeAffection?: string;
  lignes: CreatePrescriptionLigneInput[];
}

export async function creerPrescription(payload: CreatePrescriptionInput): Promise<Prescription> {
  const data = await http.post<ApiPrescription>("/portail-medecin/prescriptions", payload);
  return mapPrescription(data);
}

export async function getMesPrescriptions(): Promise<Prescription[]> {
  const data = await http.get<ApiPrescription[]>("/portail-medecin/prescriptions");
  return data.map(mapPrescription);
}

// Feuille de Soins / Feuille d'Examen (2026-08) — voir demande utilisateur :
// "le médecin doit pouvoir lui aussi de son côté générer la feuille de
// soins et examens."
export function ouvrirFeuilleSoinsPrescription(prescriptionId: string): Promise<void> {
  return openDocument(`/portail-medecin/prescriptions/${prescriptionId}/feuille-soins`);
}

export function ouvrirFeuilleExamenPrescription(prescriptionId: string): Promise<void> {
  return openDocument(`/portail-medecin/prescriptions/${prescriptionId}/feuille-examen`);
}

// Suggestion de posologie par IA (2026-08) — voir demande utilisateur :
// "l'application grâce à l'IA doit connaître la logique de posologie d'un
// produit en fonction de l'âge et du sexe du patient... si le médecin veut
// faire un ajustement il pourra retoucher, mais au moins il gagnera en
// temps". Simple pré-remplissage : peut renvoyer `null` (clé API absente,
// médicament non reconnu...), jamais bloquant.
export async function suggererPosologie(libelle: string, assureId: string): Promise<string | null> {
  const data = await http.get<{ posologie: string | null }>(
    `/portail-medecin/posologie-suggestion?libelle=${encodeURIComponent(libelle)}&assureId=${encodeURIComponent(assureId)}`,
  );
  return data.posologie;
}
