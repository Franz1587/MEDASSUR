import { API_URL, getAccessToken, http } from "@/lib/http";
import { afficherPdf } from "@/lib/pdfViewerBridge";
import type {
  Societe, SocieteDetail, CreerSocieteInput, CreerSocieteResultat, ModifierSocieteInput,
  PlanAbonnement, CreerPlanAbonnementInput, ModifierPlanAbonnementInput, MonAbonnement,
  AssistanceResultat, FactureAbonnement, GenererFactureAbonnementInput, LigneFactureInput, PayerFactureAbonnementInput, ResumeFacturation,
  PerformanceGlobale, PerformanceSociete, SocieteUser, CreerSocieteUserInput,
  BalanceAgee, EtatTaxes, GrandLivre, ModulePrix, TauxChange, Devise,
  JournalOhada, BalanceOhada, CompteDeResultat, Bilan, LettrageSociete,
  ParametresFacturationPlateforme, UpdateParametresFacturationInput,
  RubriqueFacturation, CreerRubriqueFacturationInput, ModifierRubriqueFacturationInput,
} from "@/types/societes";

export function getSocietes(): Promise<Societe[]> {
  return http.get("/societes");
}

export function getSociete(id: string): Promise<SocieteDetail> {
  return http.get(`/societes/${id}`);
}

export function creerSociete(payload: CreerSocieteInput): Promise<CreerSocieteResultat> {
  return http.post("/societes", payload);
}

export function modifierSociete(id: string, payload: ModifierSocieteInput): Promise<SocieteDetail> {
  return http.patch(`/societes/${id}`, payload);
}

export function suspendreSociete(id: string, motif?: string): Promise<SocieteDetail> {
  return http.patch(`/societes/${id}/suspendre`, { motif });
}

export function reactiverSociete(id: string): Promise<SocieteDetail> {
  return http.patch(`/societes/${id}/reactiver`, {});
}

export function supprimerSociete(id: string): Promise<{ id: string }> {
  return http.delete(`/societes/${id}`);
}

// Mode assistance (2026-09) — voir demande utilisateur : "le Super Admin
// doit pouvoir accéder dans chaque interface dédiée aux société en mode
// assistance."
export function demarrerAssistance(societeId: string): Promise<AssistanceResultat> {
  return http.post(`/societes/${societeId}/assistance`, {});
}

// Plans d'abonnement (2026-09) — catalogue géré par le Super Admin.
export function getPlansAbonnement(): Promise<PlanAbonnement[]> {
  return http.get("/plans-abonnement");
}

export function creerPlanAbonnement(payload: CreerPlanAbonnementInput): Promise<PlanAbonnement> {
  return http.post("/plans-abonnement", payload);
}

export function modifierPlanAbonnement(id: string, payload: ModifierPlanAbonnementInput): Promise<PlanAbonnement> {
  return http.patch(`/plans-abonnement/${id}`, payload);
}

export function supprimerPlanAbonnement(id: string): Promise<{ id: string }> {
  return http.delete(`/plans-abonnement/${id}`);
}

// Abonnement de la société courante — accessible à tout compte connecté
// (voir backend/src/abonnement/), pas seulement au Super Admin.
export function getMonAbonnement(): Promise<MonAbonnement> {
  return http.get("/abonnement/moi");
}

// Facturation / comptabilité plateforme (2026-09).
export function getFacturesAbonnement(filtres?: { societeId?: string; statut?: string; type?: string }): Promise<FactureAbonnement[]> {
  const params = new URLSearchParams();
  if (filtres?.societeId) params.set("societeId", filtres.societeId);
  if (filtres?.statut) params.set("statut", filtres.statut);
  if (filtres?.type) params.set("type", filtres.type);
  const qs = params.toString();
  return http.get(`/facturation/factures${qs ? `?${qs}` : ""}`);
}

export function getResumeFacturation(): Promise<ResumeFacturation> {
  return http.get("/facturation/resume");
}

export function getFactureAbonnement(id: string): Promise<FactureAbonnement> {
  return http.get(`/facturation/factures/${id}`);
}

// Formulaire de facturation complet (2026-09) — voir demande utilisateur :
// "revoir le formulaire de facturation... l'enrichir comme un vrai
// formulaire dédié... plusieurs lignes." `lignes` omis = le serveur compose
// une ligne par défaut selon `type` (frais d'installation / abonnement
// dérivé de l'abonnement de la société).
export function genererFactureAbonnement(societeId: string, payload: GenererFactureAbonnementInput): Promise<FactureAbonnement> {
  return http.post(`/facturation/societes/${societeId}/factures`, payload);
}

// Insertion rapide (2026-09) — voir demande utilisateur : "le formulaire de
// facturation... ne fonctionne toujours pas comme une facturation dédiée."
// Calcule les lignes (abonnement/installation/cartes) SANS créer de
// facture, pour les insérer dans l'éditeur multi-lignes toujours visible
// du formulaire — jamais un "mode" qui verrouille l'écran.
export function suggererLignesFacturation(societeId: string, type: "Abonnement" | "Installation" | "Cartes", nombrePersonnes?: number): Promise<LigneFactureInput[]> {
  const qs = nombrePersonnes ? `&nombrePersonnes=${nombrePersonnes}` : "";
  return http.get(`/facturation/societes/${societeId}/lignes-suggerees?type=${type}${qs}`);
}

export function payerFactureAbonnement(id: string, payload: PayerFactureAbonnementInput): Promise<FactureAbonnement> {
  return http.patch(`/facturation/factures/${id}/payer`, payload);
}

export function annulerFactureAbonnement(id: string): Promise<FactureAbonnement> {
  return http.patch(`/facturation/factures/${id}/annuler`, {});
}

// États comptables (2026-09) — voir demande utilisateur : "un module
// complet de comptabilité avec tous les états."
export function getBalanceAgee(): Promise<BalanceAgee> {
  return http.get("/facturation/etats/balance-agee");
}

export function getEtatTaxes(du?: string, au?: string): Promise<EtatTaxes> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  const qs = params.toString();
  return http.get(`/facturation/etats/taxes${qs ? `?${qs}` : ""}`);
}

export function getGrandLivre(societeId: string): Promise<GrandLivre> {
  return http.get(`/facturation/societes/${societeId}/grand-livre`);
}

// États SYSCOHADA (2026-09) — voir demande utilisateur : "au Gabon...
// c'est le SYSCOHADA qui est en vigueur... il faut tous les états
// comptable, bilan, compte de résultat, résultat net de l'exercice."
export function getJournalOhada(): Promise<JournalOhada> {
  return http.get("/facturation/etats/journal");
}

export function getBalanceOhada(): Promise<BalanceOhada> {
  return http.get("/facturation/etats/balance-generale");
}

// Lettrage du compte 411 (2026-09) — moteur partagé, voir backend/src/
// lettrage/lettrage.util.ts.
export function getLettrageClients(): Promise<LettrageSociete[]> {
  return http.get("/facturation/etats/lettrage-clients");
}

export function getCompteDeResultat(): Promise<CompteDeResultat> {
  return http.get("/facturation/etats/compte-de-resultat");
}

export function getBilan(): Promise<Bilan> {
  return http.get("/facturation/etats/bilan");
}

// Tarification par module + taux de change (2026-09) — voir demande
// utilisateur : "évaluer un coût pour chaque fonctionnalité (rendre
// paramétrable)... convertir en FCFA (XAF)".
export function getModulesPrix(): Promise<ModulePrix[]> {
  return http.get("/tarification/modules");
}

export function upsertModulePrix(module: string, prix: number, devise: Devise): Promise<ModulePrix> {
  return http.post("/tarification/modules", { module, prix, devise });
}

export function getTauxChange(): Promise<TauxChange[]> {
  return http.get("/tarification/taux-change");
}

export function upsertTauxChange(devise: Devise, tauxVersXaf: number): Promise<TauxChange> {
  return http.post("/tarification/taux-change", { devise, tauxVersXaf });
}

export function getEstimationPrixModules(modules: string[]): Promise<{ prixMensuelXaf: number }> {
  return http.get(`/tarification/estimation?modules=${encodeURIComponent(modules.join(","))}`);
}

// Performance / usage (2026-09).
export function getPerformanceGlobale(): Promise<PerformanceGlobale> {
  return http.get("/performance/global");
}

export function getPerformanceParSociete(): Promise<PerformanceSociete[]> {
  return http.get("/performance/societes");
}

// Utilisateurs par société, gérés par le Super Admin (2026-09).
export function getSocieteUsers(societeId: string): Promise<SocieteUser[]> {
  return http.get(`/societes/${societeId}/users`);
}

export function creerSocieteUser(societeId: string, payload: CreerSocieteUserInput): Promise<SocieteUser> {
  return http.post(`/societes/${societeId}/users`, payload);
}

export function modifierSocieteUser(societeId: string, userId: string, payload: Partial<CreerSocieteUserInput>): Promise<SocieteUser> {
  return http.patch(`/societes/${societeId}/users/${userId}`, payload);
}

export function modifierSocieteUserModules(societeId: string, userId: string, modules: string[]): Promise<SocieteUser> {
  return http.patch(`/societes/${societeId}/users/${userId}/modules`, { modules });
}

export function reinitialiserMotDePasseSocieteUser(societeId: string, userId: string): Promise<{ motDePasse: string; smsEnvoye: boolean }> {
  return http.patch(`/societes/${societeId}/users/${userId}/reinitialiser-mot-de-passe`, {});
}

export function supprimerSocieteUser(societeId: string, userId: string): Promise<{ id: string }> {
  return http.delete(`/societes/${societeId}/users/${userId}`);
}

// Tarification par personne assurée (2026-09) — voir demande utilisateur :
// "la licence annuelle par assuré... on facture la carte par assuré et
// ayant droit."
export function getParametresFacturation(): Promise<ParametresFacturationPlateforme> {
  return http.get("/tarification/parametres");
}

export function updateParametresFacturation(payload: UpdateParametresFacturationInput): Promise<ParametresFacturationPlateforme> {
  return http.patch("/tarification/parametres", payload);
}

// Rubriques de facturation (2026-09) — voir demande utilisateur : "le type
// de facture n'est pas les rubriques de facture. les rubriques font
// référence aux différentes lignes de facturation (installation, licence,
// carte, récupération de données...)."
export function getRubriquesFacturation(): Promise<RubriqueFacturation[]> {
  return http.get("/rubriques-facturation");
}

export function creerRubriqueFacturation(payload: CreerRubriqueFacturationInput): Promise<RubriqueFacturation> {
  return http.post("/rubriques-facturation", payload);
}

export function modifierRubriqueFacturation(code: string, payload: ModifierRubriqueFacturationInput): Promise<RubriqueFacturation> {
  return http.patch(`/rubriques-facturation/${code}`, payload);
}

export function supprimerRubriqueFacturation(code: string): Promise<{ code: string }> {
  return http.delete(`/rubriques-facturation/${code}`);
}

// Document PDF de la facture (2026-09) — voir demande utilisateur :
// "l'application doit générer une facture conforme aux normes comptable
// et de facturation." Endpoint protégé par JWT — fetch authentifié puis
// ouverture du Blob obtenu (même patron que src/services/documents.service.ts
// openDocument, window.open() seul n'enverrait pas l'en-tête Authorization).
// Route via <PdfViewerHost /> (2026-09, correctif réel — même bug que
// documents.service.ts : "les documents ne s'ouvrent pas dans la
// visionneuse... téléchargés sous un nom [UUID opaque]").
export async function ouvrirFacturePdf(id: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/facturation/factures/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Génération du PDF impossible (${res.status})`);
  const blob = await res.blob();
  const nomFichier = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/i)?.[1] ?? `facture-${id}.pdf`;
  afficherPdf({ blob, nomFichier });
}

// Logo — sur UNE société ciblée par le Super Admin (2026-09) — voir
// demande utilisateur : "dans le formulaire de création... on doit
// pouvoir mettre le logo." Upload DIFFÉRÉ : la société doit déjà exister
// (creerSociete() reste un JSON simple, sans fichier).
export async function uploadLogoSociete(societeId: string, file: File): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/societes/${societeId}/parametres-entreprise/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /societes/${societeId}/parametres-entreprise/logo failed (${res.status}): ${await res.text()}`);
}

export function supprimerLogoSociete(societeId: string): Promise<unknown> {
  return http.delete(`/societes/${societeId}/parametres-entreprise/logo`);
}
