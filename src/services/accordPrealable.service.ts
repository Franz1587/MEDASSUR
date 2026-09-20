import { http, API_URL, getAccessToken, ecritureHorsLigne } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { AccordPrealable, AccordPrealableLigne } from "@/types/accordPrealable";

interface ApiAccordPrealableLigne {
  id: string;
  acteMedicalId?: string | null;
  lettreCleCode?: string | null;
  coefficient?: string | number | null;
  description: string;
  plafondReference: string | number;
  montantDevis: string | number;
  categorieGarantie?: string | null;
}

interface ApiAccordPrealable {
  id: string;
  assureId: string;
  contratId: string;
  prestataire: string;
  type: string;
  description: string;
  dateDemande: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  decision: string;
  montantAutorise?: string | number;
  montantAutoriseSuggere?: string | number | null;
  dateDecision?: string;
  motifDecision?: string;
  dateValidite?: string;
  prescriptionRef?: string;
  montantDevis?: string | number;
  origine?: string;
  ordonnanceFichier?: string;
  devisFichier?: string;
  facture?: boolean;
  montantFacture?: string | number;
  assure: { nom: string };
  lignes?: ApiAccordPrealableLigne[];
  assigneAId?: string | null;
}

function mapLigne(l: ApiAccordPrealableLigne): AccordPrealableLigne {
  return {
    id: l.id,
    acteMedicalId: l.acteMedicalId ?? undefined,
    lettreCleCode: l.lettreCleCode ?? undefined,
    coefficient: l.coefficient != null ? toNumber(l.coefficient) : undefined,
    description: l.description,
    plafondReference: toNumber(l.plafondReference),
    montantDevis: toNumber(l.montantDevis),
    categorieGarantie: l.categorieGarantie ?? undefined,
  };
}

function mapAccord(a: ApiAccordPrealable): AccordPrealable {
  return {
    id: a.id,
    assureId: a.assureId,
    contratId: a.contratId,
    assureNom: a.assure.nom,
    prestataire: a.prestataire,
    type: a.type,
    description: a.description,
    dateDemande: a.dateDemande,
    statutAnalyseMedicale: a.statutAnalyseMedicale,
    statutValidationFinanciere: a.statutValidationFinanciere,
    decision: a.decision,
    montantAutorise: a.montantAutorise !== undefined && a.montantAutorise !== null ? toNumber(a.montantAutorise) : undefined,
    montantAutoriseSuggere: a.montantAutoriseSuggere !== undefined && a.montantAutoriseSuggere !== null ? toNumber(a.montantAutoriseSuggere) : null,
    dateDecision: a.dateDecision,
    motifDecision: a.motifDecision,
    dateValidite: a.dateValidite,
    prescriptionRef: a.prescriptionRef,
    montantDevis: a.montantDevis !== undefined && a.montantDevis !== null ? toNumber(a.montantDevis) : undefined,
    origine: a.origine,
    ordonnanceFichier: a.ordonnanceFichier ?? undefined,
    devisFichier: a.devisFichier ?? undefined,
    facture: a.facture,
    montantFacture: a.montantFacture !== undefined && a.montantFacture !== null ? toNumber(a.montantFacture) : undefined,
    lignes: (a.lignes ?? []).map(mapLigne),
    assigneAId: a.assigneAId ?? null,
  };
}

// URL directe vers un document joint (ordonnance/devis) — voir
// AccordPrealableService.uploadDocument, même principe que
// sante.service.ts urlPhotoAssure.
export function urlDocumentAccordPrealable(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/accords-prealables/${fichier}`;
}

async function uploadDocument(id: string, type: "ordonnance" | "devis", file: File): Promise<AccordPrealable> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("fichier", file);
  const res = await fetch(`${API_URL}/accord-prealable/${id}/${type}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /accord-prealable/${id}/${type} failed (${res.status}): ${await res.text()}`);
  return mapAccord(await res.json());
}

export const uploadOrdonnanceAccordPrealable = (id: string, file: File) => uploadDocument(id, "ordonnance", file);
export const uploadDevisAccordPrealable = (id: string, file: File) => uploadDocument(id, "devis", file);

export interface AccordsPrealablesFiltres {
  prestataireId?: string; type?: string; decision?: string; origine?: string;
  du?: string; au?: string; reference?: string;
}

export async function getAccordsPrealables(filtres?: AccordsPrealablesFiltres): Promise<AccordPrealable[]> {
  const params = new URLSearchParams();
  if (filtres?.prestataireId) params.set("prestataireId", filtres.prestataireId);
  if (filtres?.type) params.set("type", filtres.type);
  if (filtres?.decision) params.set("decision", filtres.decision);
  if (filtres?.origine) params.set("origine", filtres.origine);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  if (filtres?.reference) params.set("reference", filtres.reference);
  const qs = params.toString();
  const data = await http.get<ApiAccordPrealable[]>(`/accord-prealable${qs ? `?${qs}` : ""}`);
  return data.map(mapAccord);
}

// Dossiers Prises en Charge (Entente Préalable) d'UN contrat — voir onglet
// PrisesEnChargeTab de la fiche contrat.
export async function getAccordsPrealablesContrat(contratId: string): Promise<AccordPrealable[]> {
  const data = await http.get<ApiAccordPrealable[]>(`/accord-prealable?contratId=${contratId}`);
  return data.map(mapAccord);
}

export interface AccordPrealableUpsertInput {
  assureId: string;
  // Rubrique de garantie (2026-08) — voir demande utilisateur : "tu ne fais
  // toujours pas remonter toutes les rubriques de garanties". Texte libre,
  // toujours issu du VRAI tableau de garanties du contrat de l'assuré
  // choisi (même principe que le Portail Assuré, CreateAccordPrealableMembreDto)
  // — jamais une liste figée à 3 valeurs qui désynchronise dès qu'un
  // produit ajoute/renomme une rubrique.
  type: string;
  description: string;
  dateDemande: string;
  prestataire: string;
  prestataireId?: string;
  prescriptionRef?: string;
  montantDevis?: number;
  origine?: "Portail Prestataire" | "Portail Assuré" | "Agent";
  // Lignes d'actes (2026-08) — quand fournies, remplacent intégralement
  // montantDevis/description ci-dessus (dérivés côté serveur : somme et
  // résumé) — voir AccordPrealableService.create/update.
  lignes?: { acteMedicalId?: string; lettreCleCode?: string; coefficient?: number; description: string; plafondReference: number; montantDevis: number; categorieGarantie?: string }[];
}

// Mode hors-ligne (2026-09) — voir demande utilisateur : les agents
// (compagnie/courtier/mutuelle) saisissent les demandes de prise en charge
// physiques au guichet et doivent pouvoir continuer même sans réseau. Seule
// la CRÉATION passe par ecritureHorsLigne (voir lib/http.ts) — decider()/
// updateAccordPrealable()/annulerAccordPrealable() ci-dessous restent
// strictement synchrones : la création est une simple insertion (le
// contrôle anti-doublon, lui, se rejoue naturellement au retour du réseau et
// rejette proprement si un dossier concurrent a entre-temps été ouvert —
// voir AccordPrealableService.create côté serveur), alors qu'une décision
// déjà en cours pourrait être écrasée ou notifiée deux fois si rejouée en
// différé. Sans réseau, lève QueuedOfflineError au lieu de renvoyer le
// dossier créé.
export async function createAccordPrealable(payload: AccordPrealableUpsertInput): Promise<AccordPrealable> {
  const data = await ecritureHorsLigne<ApiAccordPrealable>("/accord-prealable", payload, `Prise en charge — ${payload.prestataire}`);
  return mapAccord(data);
}

// Correction d'une demande déjà saisie — erreur de saisie ou actualisation
// des délais de validité (voir demande utilisateur).
export async function updateAccordPrealable(id: string, payload: Partial<AccordPrealableUpsertInput> & { dateValidite?: string }): Promise<AccordPrealable> {
  const data = await http.patch<ApiAccordPrealable>(`/accord-prealable/${id}`, payload);
  return mapAccord(data);
}

// Prise en main d'un dossier (2026-09) — voir demande utilisateur :
// "étendre le fait de prendre en main un dossier aux agents de saisie,
// gestionnaire sinistre et gestionnaires production".
export async function prendreAccordPrealable(id: string): Promise<AccordPrealable> {
  const data = await http.patch<ApiAccordPrealable>(`/accord-prealable/${id}/prendre`);
  return mapAccord(data);
}

export async function decider(
  id: string,
  dto: { statutAnalyseMedicale?: string; statutValidationFinanciere?: string; decision?: string; montantAutorise?: number; dateDecision?: string },
): Promise<AccordPrealable> {
  const data = await http.patch<ApiAccordPrealable>(`/accord-prealable/${id}/decision`, dto);
  return mapAccord(data);
}

// Contrôleur de demande/saisie (2026-08) — voir demande utilisateur :
// annule un dossier "En attente" détecté en doublon, pour laisser la place
// à une nouvelle saisie.
export async function annulerAccordPrealable(id: string, motif?: string): Promise<AccordPrealable> {
  const data = await http.patch<ApiAccordPrealable>(`/accord-prealable/${id}/annuler`, { motif });
  return mapAccord(data);
}

// Corps structuré d'une erreur 409 "doublon en cours" (voir
// AccordPrealableService.create côté backend) — extrait depuis l'erreur
// levée par http.post (voir messageErreur/lib/http.ts, err.body).
export interface DoublonEnCoursDossier {
  id: string; type: string; description: string; prestataire: string; dateDemande: string;
  statutAnalyseMedicale: string; statutValidationFinanciere: string; origine: string;
}
interface DoublonEnCoursInfo {
  code: "DOUBLON_EN_COURS";
  message: string;
  dossier: DoublonEnCoursDossier;
}
export function doublonEnCoursDe(err: unknown): DoublonEnCoursDossier | null {
  if (!err || typeof err !== "object" || !("body" in err)) return null;
  const body = (err as { body?: unknown }).body;
  if (body && typeof body === "object" && (body as { code?: unknown }).code === "DOUBLON_EN_COURS") {
    return (body as DoublonEnCoursInfo).dossier;
  }
  return null;
}
