import { lireCache, ecrireCache, ajouterActionEnAttente, genererCleIdempotence } from "./offlineStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
const TOKEN_KEY = "medassur-access-token";

// Mode hors-ligne (2026-09) — voir demande utilisateur : "je veux que
// l'application puisse... travailler en off-line". Étendu à la CRÉATION de
// prise en charge/entente préalable côté agent interne (compagnie, courtier,
// mutuelle) — voir demande utilisateur explicite : "ce sont eux qui gère
// quotidiennement quand les assurés viennent faire les demande physique...
// ils doivent pouvoir faire cette saisie même en cas de coupure d'internet."
// Reste volontairement le SEUL point d'entrée ERP interne ouvert à la mise
// en file : `/accord-prealable` sert aussi decider()/update()/annuler(),
// mais SEULE la création (voir accordPrealable.service.ts createAccordPrealable,
// via ecritureHorsLigne) passe par ce mécanisme — les autres continuent
// d'utiliser http.patch directement, donc restent strictement synchrones
// (ce préfixe dans cette liste ne fait qu'AUTORISER ecritureHorsLigne à
// fonctionner pour create, jamais activer la file pour un appel qui ne
// l'utilise pas explicitement). Le reste de l'ERP interne (facturation,
// règlements) reste hors de ce périmètre — données financières, chantier
// séparé traité au cas par cas avec la même fondation d'idempotence côté
// serveur (voir backend/src/idempotence).
const PREFIXES_HORS_LIGNE = ["/portail-membre", "/portail-client", "/portail-prestataire", "/portail-medecin", "/demandes-client", "/accord-prealable"];

function estRouteHorsLigne(path: string): boolean {
  return PREFIXES_HORS_LIGNE.some((p) => path.startsWith(p));
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const lecture = !init?.method || init.method === "GET";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    // Erreur RÉSEAU (pas de connexion) — distincte d'un rejet HTTP (4xx/5xx)
    // traité plus bas. Sert la dernière réponse connue pour TOUTE lecture
    // (ERP interne inclus — une lecture est sans risque, contrairement à une
    // écriture, restée elle strictement limitée aux portails externes via
    // ecritureHorsLigne/PREFIXES_HORS_LIGNE ci-dessous). Même principe que
    // mobile/src/api/http.ts, qui met déjà tout GET en cache sans distinction.
    if (lecture) {
      const encache = lireCache<T>(path);
      if (encache) return encache.data;
    }
    throw err;
  }
  if (!res.ok) {
    // Le token JWT expire (8h, voir auth.module.ts) sans qu'aucune requête
    // n'ait échoué entre-temps pour le signaler à l'utilisateur — sans ça,
    // l'app reste affichée avec des données déjà chargées pendant que
    // chaque nouvelle action échoue silencieusement en 401. On prévient
    // l'AuthContext (voir son écouteur "medassur:unauthorized") pour qu'il
    // déconnecte proprement et renvoie vers l'écran de connexion.
    if (res.status === 401 && path !== "/auth/login") {
      window.dispatchEvent(new Event("medassur:unauthorized"));
    }
    const bodyText = await res.text();
    // status/body attachés à l'erreur (2026-08) — voir demande utilisateur :
    // "contrôleur de demande et de saisie de prise en charge... bloquer et
    // signaler qu'il y a déjà une demande en cours." Un appelant qui a
    // besoin de RÉAGIR précisément à une erreur (409 doublon, ex.) ne peut
    // pas se contenter du message texte concaténé ci-dessous — il lui faut
    // le code HTTP et le corps JSON structurés. Reste rétro-compatible :
    // .message garde exactement le même format qu'avant pour tout le code
    // existant qui fait juste `toast.error(e.message)`.
    let corpsJson: unknown;
    try { corpsJson = JSON.parse(bodyText); } catch { /* réponse non-JSON, corpsJson reste undefined */ }
    const erreur = new Error(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${bodyText}`) as Error & { status?: number; body?: unknown };
    erreur.status = res.status;
    erreur.body = corpsJson;
    throw erreur;
  }
  if (res.status === 204) return undefined as T;
  const donnees = (await res.json()) as T;
  if (lecture) ecrireCache(path, donnees);
  return donnees;
}

// Écriture "tolérante hors-ligne" — voir mobile/src/api/http.ts (postOffline),
// même principe. À utiliser explicitement là où une mise en file locale a
// du sens pour l'utilisateur d'un portail externe (ex. soumettre une
// demande, mettre à jour ses informations). Sur un échec RÉSEAU (pas un
// rejet métier 4xx/5xx, qui reste une vraie erreur immédiate),
// QueuedOfflineError est levée pour que l'écran affiche un état "en
// attente d'envoi" au lieu d'une erreur.
export class QueuedOfflineError extends Error {
  constructor() {
    super("Aucune connexion — l'action a été mise en file d'attente et sera envoyée automatiquement.");
  }
}

export async function ecritureHorsLigne<T>(
  path: string,
  body: unknown,
  descriptionCourte: string,
  method: "POST" | "PATCH" | "PUT" = "POST",
): Promise<T> {
  if (!estRouteHorsLigne(path)) {
    // Garde-fou : un appel mal placé (hors du périmètre retenu) ne doit
    // jamais mettre discrètement en file une écriture ERP interne.
    return request<T>(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  }
  try {
    return await request<T>(path, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (err) {
    const estErreurHttp = err instanceof Error && "status" in err;
    if (estErreurHttp) throw err; // rejet métier — pas un problème réseau
    ajouterActionEnAttente({ cleIdempotence: genererCleIdempotence(), path, method, body, descriptionCourte });
    throw new QueuedOfflineError();
  }
}

// Message d'erreur lisible (2026-08) — voir demande utilisateur : "contrôleur
// de demande et de saisie de prise en charge... bloquer et signaler". Une
// erreur levée par `request()` porte désormais `.body` (corps JSON de la
// réponse, voir ci-dessus) — quand le backend renvoie un objet structuré
// {message: "..."} (ConflictException, BadRequestException...), c'est CE
// message propre qu'il faut afficher, pas la chaîne technique complète
// "POST /x failed (409): {...}" que fabrique `.message` par défaut.
export function messageErreur(err: unknown, repli = "Une erreur est survenue."): string {
  if (err && typeof err === "object" && "body" in err) {
    const body = (err as { body?: unknown }).body;
    if (body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string") {
      return (body as { message: string }).message;
    }
  }
  return err instanceof Error ? err.message : repli;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Télécharge un fichier binaire généré côté serveur (ex. modèle .xlsx
// d'import en masse) — même principe que uploadCompagnieLogo côté upload,
// mais en sens inverse : fetch authentifié + déclenchement du
// téléchargement navigateur via un lien objet éphémère.
export async function downloadFile(path: string, nomFichier: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

// Upload d'un fichier avec réponse JSON typée (ex. aperçu d'import en
// masse) — même principe que uploadCompagnieLogo, factorisé ici pour être
// réutilisé par plusieurs modules (clients, contrats).
export async function uploadFile<T>(path: string, file: File, champ = "fichier"): Promise<T> {
  const token = getAccessToken();
  const form = new FormData();
  form.append(champ, file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

export { API_URL };
