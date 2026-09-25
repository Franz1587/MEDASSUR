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

// Purge le cache de lecture API — jamais la source de vérité, juste un
// repli réseau (voir ecrireCache ci-dessous) — voir demande utilisateur :
// "Setting the value of 'medassur-current-user' exceeded the quota" —
// ce cache, mis en écriture pour TOUTE lecture de l'ERP sans plafond ni
// expiration, finissait par saturer le quota localStorage et empêcher
// même l'écriture de la session utilisateur (AuthContext).
export function viderCacheApi(): void {
  try {
    const clesASupprimer: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle?.startsWith(PREFIXE_CACHE)) clesASupprimer.push(cle);
    }
    clesASupprimer.forEach((cle) => localStorage.removeItem(cle));
  } catch {
    // jamais bloquant
  }
}

export function ecrireCache(cle: string, data: unknown): void {
  const valeur = JSON.stringify({ data, horodatage: Date.now() });
  try {
    localStorage.setItem(PREFIXE_CACHE + cle, valeur);
  } catch {
    // Quota dépassé (voir viderCacheApi ci-dessus) — on vide ce cache de
    // repli et on retente une fois avant d'abandonner silencieusement
    // (navigation privée ou quota structurel de l'appareil).
    viderCacheApi();
    try {
      localStorage.setItem(PREFIXE_CACHE + cle, valeur);
    } catch {
      // jamais bloquant
    }
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
