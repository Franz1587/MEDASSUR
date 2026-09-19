import { http } from "@/lib/http";
import { openDocument } from "@/services/documents.service";
import type { AuditLogEntry, DerniereModification, StatAgent } from "@/types/audit";

export interface AuditFiltres {
  entite?: string; entiteId?: string; utilisateur?: string; action?: string; du?: string; au?: string;
}

export async function getJournalOperations(filtres?: AuditFiltres): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filtres?.entite) params.set("entite", filtres.entite);
  if (filtres?.entiteId) params.set("entiteId", filtres.entiteId);
  if (filtres?.utilisateur) params.set("utilisateur", filtres.utilisateur);
  if (filtres?.action) params.set("action", filtres.action);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  const qs = params.toString();
  return http.get<AuditLogEntry[]>(`/audit${qs ? `?${qs}` : ""}`);
}

// Widget "dernière modification" sur une fiche (contrat/facture/prise en
// charge) — voir demande utilisateur.
export async function getDerniereModification(entite: string, entiteId: string): Promise<DerniereModification | null> {
  return http.get<DerniereModification | null>(`/audit/derniere-modification?entite=${encodeURIComponent(entite)}&entiteId=${encodeURIComponent(entiteId)}`);
}

export async function getStatsAgents(filtres?: { du?: string; au?: string }): Promise<StatAgent[]> {
  const params = new URLSearchParams();
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  const qs = params.toString();
  return http.get<StatAgent[]>(`/audit/stats-agents${qs ? `?${qs}` : ""}`);
}

// État global — édition/téléchargement/impression (2026-08) — voir demande
// utilisateur : "on doit pouvoir en éditer, télécharger et imprimer un état
// global, par type d'action, par date, mais aussi par agents." Mêmes
// filtres que la recherche à l'écran (voir getJournalOperations) ; pdf
// ouvre la visionneuse intégrée (impression/téléchargement déjà proposés
// par la visionneuse, voir openDocument), xlsx télécharge directement.
export function openEtatGlobalJournal(filtres: AuditFiltres, format: "pdf" | "xlsx" = "pdf"): Promise<void> {
  const params = new URLSearchParams({ format });
  if (filtres.entite) params.set("entite", filtres.entite);
  if (filtres.entiteId) params.set("entiteId", filtres.entiteId);
  if (filtres.utilisateur) params.set("utilisateur", filtres.utilisateur);
  if (filtres.action) params.set("action", filtres.action);
  if (filtres.du) params.set("du", filtres.du);
  if (filtres.au) params.set("au", filtres.au);
  return openDocument(`/audit/export?${params.toString()}`);
}
