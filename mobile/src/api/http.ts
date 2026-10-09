import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import ReactNativeBlobUtil from "react-native-blob-util";
import { lireCache, ecrireCache, ajouterActionEnAttente, genererCleIdempotence } from "../utils/offlineStore";

// Client API MEDASSUR — appelle directement le backend de PRODUCTION
// (https://medassur.cloud/api), le MÊME backend que la version web déployée
// sur Hostinger. Aucune donnée mockée : chaque écran doit passer par ce
// client. Miroir volontaire de src/lib/http.ts côté web (même contrat
// d'erreurs .status/.body) pour qu'un futur lecteur des deux code bases
// reconnaisse immédiatement le même patron.
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://medassur.cloud/api";

const TOKEN_KEY = "medassur-access-token";

let cachedToken: string | null | undefined; // undefined = pas encore lu du SecureStore

// Écouteurs 401 (2026-09) — équivalent RN de window.dispatchEvent côté web
// (pas de `window` global fiable en React Native) : AuthContext s'y abonne
// pour déconnecter proprement dès qu'un appel échoue en 401 (token expiré).
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function setAccessToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  const stored = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedToken = stored;
  return stored;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Mode hors-ligne (2026-09) — voir mobile/src/utils/offlineStore.ts. Une
// lecture (GET) sans réseau sert la dernière réponse connue au lieu
// d'afficher une erreur ; une écriture reste normalement bloquante ici (voir
// postOffline ci-dessous pour les call sites qui acceptent explicitement la
// mise en file d'attente).
const methodeEstLecture = (init?: RequestInit) => !init?.method || init.method === "GET";

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Relance sur échec réseau transitoire (2026-09) — voir demande utilisateur :
// "les mise à jour ne remonte pas systématiquement vers la version mobile...
// sans désinstaller et réinstaller." Cause : une simple coupure passagère
// (réseau mobile instable, ou le backend qui redémarre le temps d'un
// déploiement) fait échouer `fetch` UNE fois — `request()` traitait ça
// exactement comme "hors-ligne" et servait le cache disque (voir
// lireCache), qui ne se met alors à jour QU'AU PROCHAIN appel réussi sur CE
// MÊME chemin. Si l'écran n'est pas revisité entre-temps, la donnée reste
// périmée indéfiniment — seule la réinstallation (qui vide le cache
// disque) "corrigeait" ça en forçant un nouvel appel réseau partout.
// Quelques tentatives rapprochées avant d'abandonner évitent qu'un simple
// aléa réseau soit confondu avec une vraie coupure.
async function fetchAvecRelance(url: string, init: RequestInit, tentatives: number): Promise<Response> {
  let derniereErreur: unknown;
  for (let i = 0; i <= tentatives; i++) {
    try {
      return await fetch(url, { ...init, ...(methodeEstLecture(init) ? { cache: "no-store" as const } : {}) });
    } catch (err) {
      derniereErreur = err;
      if (i < tentatives) await attendre(400 * (i + 1));
    }
  }
  throw derniereErreur;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const lecture = methodeEstLecture(init);
  let res: Response;
  try {
    res = await fetchAvecRelance(`${API_URL}${path}`, { ...init, headers }, lecture ? 2 : 1);
  } catch (err) {
    if (lecture) {
      const encache = await lireCache<T>(path);
      if (encache) return encache.data;
    }
    throw err;
  }
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") {
      unauthorizedListeners.forEach((l) => l());
    }
    const bodyText = await res.text();
    let corpsJson: unknown;
    try {
      corpsJson = JSON.parse(bodyText);
    } catch {
      /* réponse non-JSON */
    }
    throw new ApiError(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${bodyText}`, res.status, corpsJson);
  }
  if (res.status === 204) return undefined as T;
  const donnees = (await res.json()) as T;
  if (lecture) ecrireCache(path, donnees).catch(() => undefined);
  return donnees;
}

// Écriture "tolérante hors-ligne" — à utiliser explicitement là où une mise
// en file d'attente locale a du sens pour l'utilisateur (ex. envoyer un
// message). Sur un échec réseau (PAS un rejet métier 4xx/5xx, qui reste une
// vraie erreur), l'action est mise en file (voir offlineStore.ts) et
// QueuedOfflineError est levée pour que l'écran affiche un état "en attente
// d'envoi" au lieu d'une erreur — au lieu de http.post/patch/put classiques,
// qui continuent d'échouer normalement (zéro changement de comportement pour
// tous les autres appels existants).
export class QueuedOfflineError extends Error {
  constructor() {
    super("Aucune connexion — l'action a été mise en file d'attente et sera envoyée automatiquement.");
  }
}

export async function postOffline<T>(
  path: string,
  body: unknown,
  descriptionCourte: string,
  method: "POST" | "PATCH" | "PUT" = "POST",
): Promise<T> {
  try {
    return await request<T>(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (err) {
    const estErreurReseau = !(err instanceof ApiError);
    if (!estErreurReseau) throw err;
    await ajouterActionEnAttente({
      cleIdempotence: genererCleIdempotence(),
      path,
      method,
      body,
      descriptionCourte,
    });
    throw new QueuedOfflineError();
  }
}

// Message d'erreur lisible — même logique que messageErreur() côté web.
export function messageErreur(err: unknown, repli = "Une erreur est survenue."): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === "object" && "message" in body) {
      const m = (body as { message?: unknown }).message;
      if (typeof m === "string") return m;
      if (Array.isArray(m) && m.length > 0) return String(m[0]);
    }
  }
  return err instanceof Error ? err.message : repli;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Upload multipart — un ou plusieurs fichiers locaux (uri de la caméra, de
// la galerie ou du sélecteur de document).
export interface RnFilePart {
  uri: string;
  name: string;
  type: string;
}

// Transport PAR react-native-blob-util, jamais par fetch (2026-10) — voir
// demande utilisateur : "je ne parviens pas à importer les pièces jointes
// pour la demande de prise en charge". Depuis Expo SDK 57, le `fetch`
// global est remplacé par l'implémentation WinterCG d'Expo (voir
// expo/src/winter/runtime.native.ts), qui ne sait PAS construire la partie
// multipart d'un fichier décrit par { uri, name, type } (convention React
// Native classique) — elle lève "Unsupported FormDataPart implementation"
// pour CE cas précis (voir expo/src/winter/fetch/convertFormData.ts, et son
// propre test qui reproduit exactement cette erreur). C'est le même bug que
// celui déjà contourné pour l'envoi de la signature (voir profil.ts
// uploaderMaSignature, plus ancien) — généralisé ici à TOUS les envois de
// fichiers (ordonnance/devis d'entente préalable, pièces de remboursement,
// photo du carnet de santé), plutôt que de multiplier les contournements
// ponctuels. react-native-blob-util passe par le client HTTP natif
// Android/iOS, hors de portée du fetch d'Expo.
function cheminNatif(uri: string): string {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

async function requeteMultipart<T>(
  path: string, parts: { name: string; filename?: string; type?: string; data: string }[], method: "POST" | "PATCH",
): Promise<T> {
  const token = await getAccessToken();
  const res = await ReactNativeBlobUtil.fetch(
    method,
    `${API_URL}${path}`,
    { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "multipart/form-data" },
    parts,
  );
  const statut = res.respInfo.status;
  if (statut === 401) unauthorizedListeners.forEach((l) => l());
  if (statut < 200 || statut >= 300) {
    const bodyText = String(res.text());
    let corpsJson: unknown;
    try { corpsJson = JSON.parse(bodyText); } catch { /* réponse non-JSON */ }
    throw new ApiError(`${method} ${path} failed (${statut}): ${bodyText}`, statut, corpsJson);
  }
  return res.json() as T;
}

// Un seul fichier sous `champ` (compat historique — garde cette signature
// pour tous les appelants existants).
export async function uploadFile<T>(path: string, file: RnFilePart, champ = "fichier", extraFields?: Record<string, string>, method: "POST" | "PATCH" = "POST"): Promise<T> {
  return uploadFiles(path, [file], champ, extraFields, method);
}

// Plusieurs fichiers sous LE MÊME champ (2026-10) — voir demande
// utilisateur : "l'application permette... la sélection de plusieurs
// pièces jointes". Le serveur (voir backend/src/lib/pieces-jointes.util.ts)
// réunit les fichiers envoyés sous "fichiers" en un seul document ou en
// plusieurs messages selon l'écran.
export async function uploadFiles<T>(
  path: string, files: RnFilePart[], champ = "fichiers", extraFields?: Record<string, string>, method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const parts: { name: string; filename?: string; type?: string; data: string }[] =
    files.map((f) => ({ name: champ, filename: f.name, type: f.type, data: ReactNativeBlobUtil.wrap(cheminNatif(f.uri)) }));
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) parts.push({ name: k, data: v });
  }
  return requeteMultipart<T>(path, parts, method);
}

export function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}
