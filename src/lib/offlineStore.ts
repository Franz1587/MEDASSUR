// Fondation du mode hors-ligne — portails web externes (2026-09). Voir
// demande utilisateur : "je veux que l'application puisse... travailler en
// off-line... une fois la connexion rétablie, les données saisie en
// off-ligne pourront migrer vers le serveur" + mobile/src/utils/offlineStore.ts
// (même principe, adapté au navigateur : localStorage au lieu du système de
// fichiers RN). Volontairement limité aux PORTAILS EXTERNES (voir
// PREFIXES_HORS_LIGNE dans http.ts) — l'ERP interne (facturation,
// règlements, sinistres) reste en ligne uniquement pour l'instant, chantier
// séparé plus sensible sur des données financières.
//
// Comme côté mobile : chaque action mise en file porte une clé
// d'idempotence générée UNE SEULE FOIS à la création, conservée à travers
// les tentatives — voir backend/src/idempotence (RequeteIdempotente) : si
// l'action a réellement déjà réussi côté serveur, un rejeu ne la duplique
// jamais.

const PREFIXE_CACHE = "medassur-cache-api::";
const CLE_FILE_ATTENTE = "medassur-file-attente-api";

export function lireCache<T>(cle: string): { data: T; horodatage: number } | null {
  try {
    const brut = localStorage.getItem(PREFIXE_CACHE + cle);
    if (!brut) return null;
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export function ecrireCache(cle: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIXE_CACHE + cle, JSON.stringify({ data, horodatage: Date.now() }));
  } catch {
    // Quota localStorage dépassé ou navigation privée — jamais bloquant,
    // un échec d'écriture cache ne doit jamais casser l'appel réseau réussi.
  }
}

export interface ActionEnAttente {
  id: string;
  cleIdempotence: string;
  path: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body: unknown;
  descriptionCourte: string;
  creeLe: number;
}

function lireFileAttente(): ActionEnAttente[] {
  try {
    const brut = localStorage.getItem(CLE_FILE_ATTENTE);
    if (!brut) return [];
    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrireFileAttente(liste: ActionEnAttente[]): void {
  try {
    localStorage.setItem(CLE_FILE_ATTENTE, JSON.stringify(liste));
  } catch {
    // jamais bloquant
  }
}

export function ajouterActionEnAttente(action: Omit<ActionEnAttente, "id" | "creeLe">): ActionEnAttente {
  const liste = lireFileAttente();
  const item: ActionEnAttente = { ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, creeLe: Date.now() };
  liste.push(item);
  ecrireFileAttente(liste);
  return item;
}

export function listerActionsEnAttente(): ActionEnAttente[] {
  return lireFileAttente();
}

export function retirerActionEnAttente(id: string): void {
  ecrireFileAttente(lireFileAttente().filter((a) => a.id !== id));
}

export function genererCleIdempotence(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
