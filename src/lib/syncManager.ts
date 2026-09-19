import { toast } from "sonner";
import { API_URL, getAccessToken } from "./http";
import { listerActionsEnAttente, retirerActionEnAttente, type ActionEnAttente } from "./offlineStore";

// Rejoue la file d'attente des portails externes (voir offlineStore.ts) dès
// que le réseau revient — "une fois la connexion rétablie, les données
// saisie en off-ligne pourront migrer vers le serveur" (demande
// utilisateur). Le navigateur donne un signal réseau fiable
// (window "online"/"offline", navigator.onLine) contrairement à React
// Native — utilisé en priorité, complété par un intervalle de secours au
// cas où l'évènement serait manqué (onglet resté ouvert pendant une bascule
// réseau rapide).
type Ecouteur = (enAttente: number) => void;
const ecouteurs = new Set<Ecouteur>();
export function onFileAttenteChangee(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

let enCours = false;

export async function synchroniser(): Promise<void> {
  if (enCours || !navigator.onLine) return;
  enCours = true;
  try {
    const actions = listerActionsEnAttente();
    ecouteurs.forEach((e) => e(actions.length));
    if (actions.length === 0) return;

    const token = getAccessToken();
    for (const action of actions as ActionEnAttente[]) {
      const resultat = await rejouer(action, token);
      if (resultat.statut === "reseau") break; // toujours hors-ligne (ou serveur indisponible) — on réessaiera plus tard
      retirerActionEnAttente(action.id);
      if (resultat.statut === "rejete") {
        // L'action a bien été transmise mais REFUSÉE (ex. doublon détecté
        // entre-temps) — voir demande utilisateur sur la saisie hors-ligne
        // des prises en charge : l'agent doit savoir que sa saisie n'est PAS
        // passée, au lieu qu'elle disparaisse silencieusement de la file.
        toast.error(`Non envoyé — ${action.descriptionCourte} : ${resultat.message}`);
      }
    }
    ecouteurs.forEach((e) => e(listerActionsEnAttente().length));
  } finally {
    enCours = false;
  }
}

type ResultatRejeu = { statut: "ok" } | { statut: "reseau" } | { statut: "rejete"; message: string };

async function rejouer(action: ActionEnAttente, token: string | null): Promise<ResultatRejeu> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${action.path}`, {
      method: action.method,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": action.cleIdempotence,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: action.body !== undefined ? JSON.stringify(action.body) : undefined,
    });
  } catch {
    return { statut: "reseau" }; // toujours pas de réseau
  }
  if (res.ok) return { statut: "ok" };
  // Rejet métier (4xx/5xx) — l'action a bien été transmise et TRAITÉE par le
  // serveur (acceptée ou refusée) : on ne la rejoue jamais indéfiniment,
  // mais il faut le dire à l'utilisateur plutôt que de la faire disparaître.
  let message = `Erreur ${res.status}`;
  try {
    const corps = await res.json();
    if (corps && typeof corps === "object" && typeof corps.message === "string") message = corps.message;
  } catch {
    // corps non-JSON — on garde le message générique
  }
  return { statut: "rejete", message };
}

let demarre = false;
export function demarrerSynchronisationAutomatique(): void {
  if (demarre) return;
  demarre = true;
  synchroniser().catch(() => undefined);
  window.addEventListener("online", () => synchroniser().catch(() => undefined));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") synchroniser().catch(() => undefined);
  });
  setInterval(() => synchroniser().catch(() => undefined), 30000);
}
