import * as FileSystem from "expo-file-system/legacy";

// Fondation du mode hors-ligne mobile (2026-09) — voir demande utilisateur :
// "je veux que l'application puisse... travailler en off-line... une fois la
// connexion rétablie, les données saisie en off-ligne pourront migrer vers
// le serveur". Stockage sur disque via expo-file-system (déjà une
// dépendance du projet — aucun nouveau module natif nécessaire, donc ce
// mécanisme est livrable par mise à jour OTA). Deux usages :
//  1. Cache de lecture : dernière réponse connue de chaque GET, pour pouvoir
//     afficher les données déjà chargées sans connexion.
//  2. File d'attente d'écriture : actions (POST/PATCH/PUT) qui n'ont pas pu
//     partir faute de réseau, rejouées automatiquement au retour de la
//     connexion (voir syncManager.ts). Chaque action porte une clé
//     d'idempotence générée UNE SEULE FOIS à la mise en file — voir
//     backend/src/idempotence : si l'action a en fait déjà réussi côté
//     serveur (réponse perdue avant la coupure), le rejeu ne la duplique pas.

const DOSSIER_CACHE = `${FileSystem.documentDirectory}medassur-cache-api/`;
const FICHIER_FILE_ATTENTE = `${FileSystem.documentDirectory}medassur-file-attente.json`;

function cleVersFichier(cle: string): string {
  const sur = cle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 180);
  return `${DOSSIER_CACHE}${sur}.json`;
}

let dossierPret: Promise<void> | null = null;
async function assurerDossierCache(): Promise<void> {
  if (!dossierPret) {
    dossierPret = FileSystem.makeDirectoryAsync(DOSSIER_CACHE, { intermediates: true }).catch(() => undefined);
  }
  await dossierPret;
}

export async function lireCache<T>(cle: string): Promise<{ data: T; horodatage: number } | null> {
  try {
    await assurerDossierCache();
    const chemin = cleVersFichier(cle);
    const info = await FileSystem.getInfoAsync(chemin);
    if (!info.exists) return null;
    const brut = await FileSystem.readAsStringAsync(chemin);
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export async function ecrireCache(cle: string, data: unknown): Promise<void> {
  try {
    await assurerDossierCache();
    const chemin = cleVersFichier(cle);
    await FileSystem.writeAsStringAsync(chemin, JSON.stringify({ data, horodatage: Date.now() }));
  } catch {
    // jamais bloquant — un échec d'écriture cache ne doit jamais casser l'appel réseau qui a réussi
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

async function lireFileAttente(): Promise<ActionEnAttente[]> {
  try {
    const info = await FileSystem.getInfoAsync(FICHIER_FILE_ATTENTE);
    if (!info.exists) return [];
    const brut = await FileSystem.readAsStringAsync(FICHIER_FILE_ATTENTE);
    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

async function ecrireFileAttente(liste: ActionEnAttente[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FICHIER_FILE_ATTENTE, JSON.stringify(liste));
  } catch {
    // jamais bloquant
  }
}

export async function ajouterActionEnAttente(action: Omit<ActionEnAttente, "id" | "creeLe">): Promise<ActionEnAttente> {
  const liste = await lireFileAttente();
  const item: ActionEnAttente = { ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, creeLe: Date.now() };
  liste.push(item);
  await ecrireFileAttente(liste);
  return item;
}

export async function listerActionsEnAttente(): Promise<ActionEnAttente[]> {
  return lireFileAttente();
}

export async function retirerActionEnAttente(id: string): Promise<void> {
  const liste = await lireFileAttente();
  await ecrireFileAttente(liste.filter((a) => a.id !== id));
}

export function genererCleIdempotence(): string {
  return `mob-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
