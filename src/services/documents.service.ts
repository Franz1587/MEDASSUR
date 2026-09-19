import { API_URL, getAccessToken } from "@/lib/http";
import type { AnalyseNarrative } from "@/services/statistiques.service";
import { afficherPdf } from "@/lib/pdfViewerBridge";

// Les endpoints PDF sont protégés par JWT — une simple navigation
// window.open() n'enverrait pas l'en-tête Authorization. On récupère donc
// le PDF via fetch authentifié, puis on ouvre le Blob obtenu.
//
// Route via `afficherPdf` → <PdfViewerHost /> (2026-09, correctif réel) —
// voir demande utilisateur : "les document ne s'ouvrent pas dans la
// visioneuse... quand on télécharge les documents au lieu de porter le
// bon nom, ils sont sous cette forme: 108a8f6c-1f93-...". `PdfViewerHost`
// existait déjà (avec son bouton Télécharger qui nomme correctement le
// fichier) mais n'était en réalité JAMAIS utilisé par cette fonction —
// `window.open(url, "_blank")` ouvrait un nouvel onglet du navigateur qui
// ignore `doc.nomFichier` : son propre bouton "Enregistrer" ne connaît
// que l'URL blob: brute et propose donc l'identifiant opaque du blob
// (un UUID) comme nom de fichier. Le nom réel est lu depuis l'en-tête
// `Content-Disposition` que chaque endpoint pose déjà côté backend
// (`res.setHeader("Content-Disposition", 'inline; filename="..."')`,
// exposé via CORS `exposedHeaders` dans main.ts) — jamais consommé côté
// client jusqu'ici. Comportement universel, pour TOUTE société (voir
// demande utilisateur : "c'est la même application, tout doit fonctionner
// pareillement") : rien ici ne dépend de la société courante.
function nomFichierDepuisReponse(res: Response, repli: string): string {
  const entete = res.headers.get("Content-Disposition");
  const correspondance = entete?.match(/filename="?([^";]+)"?/i);
  return correspondance?.[1] ?? repli;
}

async function openBlobUrl(res: Response, nomRepli = "document.pdf") {
  if (!res.ok) {
    throw new Error(`Génération du document impossible (${res.status})`);
  }
  const blob = await res.blob();
  const nomFichier = nomFichierDepuisReponse(res, nomRepli);
  // Seul le PDF se prévisualise dans <PdfViewerHost /> (iframe) — un
  // classeur/document (xlsx/docx, toujours envoyés en pièce jointe forcée
  // "attachment" côté backend, jamais destinés à une prévisualisation
  // inline) se télécharge directement, avec le VRAI nom cette fois
  // (même correctif de fond : auparavant `window.open()` sur ce type de
  // blob ne rendait rien d'exploitable et proposait, là aussi, un nom
  // opaque au téléchargement).
  if (res.headers.get("Content-Type")?.includes("application/pdf")) {
    afficherPdf({ blob, nomFichier });
    return;
  }
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openDocument(path: string) {
  const token = getAccessToken();
  // cache: "no-store" (2026-09) — défense en profondeur en plus du
  // Cache-Control posé côté backend (voir main.ts) : jamais rejouer une
  // réponse mise en cache par le navigateur pour la même URL, même en cas
  // de proxy/cache intermédiaire mal configuré.
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  await openBlobUrl(res);
}

// Endpoint POST (2026-09) — voir openStatistiques ci-dessous : l'analyse
// narrative éditée est trop volumineuse/structurée pour une query string.
async function openPostDocument(path: string, body: unknown) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  await openBlobUrl(res);
}

// URL déjà absolue (fichier servi statiquement, voir backend/src/main.ts
// useStaticAssets) — pas de préfixe API_URL/token nécessaire. `filename`
// (2026-09, correctif réel) — un fichier statique servi par
// `useStaticAssets` ne porte pas d'en-tête Content-Disposition (juste le
// nom disque, souvent un identifiant technique) : le vrai nom d'origine,
// déjà transmis par CHAQUE appelant mais jusqu'ici silencieusement
// ignoré (préfixé "_" comme volontairement inutilisé), sert de repli.
export async function openStaticDocument(url: string, filename?: string): Promise<void> {
  const res = await fetch(url);
  await openBlobUrl(res, filename);
}

export type DocumentFormat = "pdf" | "xlsx" | "docx";

export function openQuittance(contratId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/quittance/${contratId}?format=${format}`);
}

export function openQuittanceAvenant(avenantId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/quittance-avenant/${avenantId}?format=${format}`);
}

export function openTableauGaranties(contratId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/tableau-garanties/${contratId}?format=${format}`);
}

export function openAvenantDocument(avenantId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/avenant/${avenantId}?format=${format}`);
}

export function openCarteAssurance(assureId: string): Promise<void> {
  return openDocument(`/documents/carte/${assureId}`);
}

export async function genererCartesEnMasse(payload: { contratId?: string; assureIds?: string[] }): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/documents/cartes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  await openBlobUrl(res);
}

// Rapport Statistiques (2026-08) — voir demande utilisateur : "sélectionner
// les rubriques que l'on veut voir apparaître sur le fichier à
// télécharger". `analyse` = version éditée à l'écran avant téléchargement
// (voir features/statistiques/index.tsx, `analyseEdite`) — undefined =
// utiliser celle fraîchement calculée côté serveur.
export function openStatistiques(
  contratId: string, du: string | undefined, au: string | undefined, format: "pdf" | "docx",
  analyse: AnalyseNarrative | undefined, rubriques?: string[],
): Promise<void> {
  return openPostDocument(`/documents/statistiques/${contratId}`, { du, au, format, analyse, rubriques });
}

// Feuille de Soins/Examen "la plus récente" pour un assuré (2026-09) — voir
// features/participants/index.tsx, bouton d'impression rapide depuis la
// fiche assuré (sans connaître la PriseEnCharge précise).
export function openFeuilleSoins(assureId: string): Promise<void> {
  return openDocument(`/documents/assures/${assureId}/feuille-soins`);
}

export function openFeuilleExamen(assureId: string): Promise<void> {
  return openDocument(`/documents/assures/${assureId}/feuille-examen`);
}

export function openCertificatPriseEnCharge(accordId: string): Promise<void> {
  return openDocument(`/documents/certificat-prise-en-charge/${accordId}`);
}

export function openDecompteFacture(factureId: string, assureId?: string): Promise<void> {
  return openDocument(`/documents/decompte/${factureId}${assureId ? `?assureId=${assureId}` : ""}`);
}

export function openRelevePrestataire(releveId: string, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  return openDocument(`/documents/releve-prestataire/${releveId}?format=${format}`);
}

export function openFactureProduction(id: string): Promise<void> {
  return openDocument(`/documents/facture-production/${id}`);
}

export function openPopulationExport(contratId: string, format: DocumentFormat, filtres: { statut?: string; du?: string; au?: string }): Promise<void> {
  const params = new URLSearchParams({ format });
  if (filtres.statut) params.set("statut", filtres.statut);
  return openDocument(`/documents/population/${contratId}?${params.toString()}`);
}

// Offre de cotation (2026-09) — un ou plusieurs produits du MÊME client
// regroupés en une seule proposition (voir schema.prisma Prospect.logo).
export function openCotationOffre(cotationIds: string[]): Promise<void> {
  return openPostDocument("/documents/cotation-offre", { cotationIds });
}

export function openReseauSoins(): Promise<void> {
  return openDocument("/documents/reseau-soins");
}

export function openFichePrestataire(id: string): Promise<void> {
  return openDocument(`/documents/fiche-prestataire/${id}`);
}

export function openCourrier(id: string): Promise<void> {
  return openDocument(`/documents/courrier/${id}`);
}

export function openTableauProspection(format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  return openDocument(`/documents/tableau-prospection?format=${format}`);
}

export function openEtatTps(filtres: { prestataireId?: string; annee?: string; du?: string; au?: string }): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtres)) if (v) params.set(k, v);
  return openDocument(`/documents/etat-tps?${params.toString()}`);
}

export function openListePrestatairesTps(): Promise<void> {
  return openDocument("/documents/liste-prestataires-tps");
}

export function openLettreCheque(id: string): Promise<void> {
  return openDocument(`/documents/lettre-cheque/${id}`);
}

export function openReglement(id: string): Promise<void> {
  return openDocument(`/documents/reglement/${id}`);
}

export function openHistoriqueReglements(filtres: {
  prestataireId?: string; du?: string; au?: string; numeroReglement?: string;
  referenceDecompte?: string; assure?: string; referenceReglementComptable?: string;
}, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  const params = new URLSearchParams({ format });
  for (const [k, v] of Object.entries(filtres)) if (v) params.set(k, v);
  return openDocument(`/documents/historique-reglements?${params.toString()}`);
}

export function openAvisEcheance(clientId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/avis-echeance/${clientId}?format=${format}`);
}

export function openAccordPrealableExport(contratId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/accords-prealables/${contratId}?format=${format}`);
}

export function openConsommationsExport(contratId: string, format: DocumentFormat = "pdf"): Promise<void> {
  return openDocument(`/documents/consommations/${contratId}?format=${format}`);
}

export function openQuittanceTranche(trancheId: string): Promise<void> {
  return openDocument(`/documents/quittance-tranche/${trancheId}`);
}

export function openBordereauSinistres(
  du: string | undefined, au: string | undefined, compagnieId: string | undefined, typeReglement: "maladie" | "comptable", format: "pdf" | "xlsx" = "pdf",
): Promise<void> {
  const params = new URLSearchParams({ typeReglement, format });
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  return openDocument(`/documents/bordereau-sinistres?${params.toString()}`);
}

export function openBordereauProduction(du: string | undefined, au: string | undefined, compagnieId: string | undefined, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  const params = new URLSearchParams({ format });
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  return openDocument(`/documents/bordereau-production?${params.toString()}`);
}

export function openBordereauEncaissement(du: string | undefined, au: string | undefined, compagnieId: string | undefined, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  const params = new URLSearchParams({ format });
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  return openDocument(`/documents/bordereau-encaissement?${params.toString()}`);
}
