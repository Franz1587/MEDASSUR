import { AppState, Alert } from "react-native";
import { API_URL, getAccessToken } from "../api/http";
import { listerActionsEnAttente, retirerActionEnAttente, type ActionEnAttente } from "./offlineStore";

// Rejoue la file d'attente hors-ligne (voir offlineStore.ts) dès que le
// réseau revient — "une fois la connexion rétablie, les données saisie en
// off-ligne pourront migrer vers le serveur" (demande utilisateur). Aucune
// dépendance native ajoutée (ni NetInfo) : on tente simplement de vider la
// file à chaque retour au premier plan et à intervalle régulier pendant que
// l'app est active — une tentative qui échoue par erreur réseau laisse la
// file intacte pour la prochaine tentative, sans jamais alerter l'utilisateur
// d'une "erreur".
type Ecouteur = (enAttente: number) => void;
const ecouteurs = new Set<Ecouteur>();
export function onFileAttenteChangee(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

let enCours = false;

export async function synchroniser(): Promise<void> {
  if (enCours) return;
  enCours = true;
  try {
    const actions = await listerActionsEnAttente();
    ecouteurs.forEach((e) => e(actions.length));
    if (actions.length === 0) return;

    const token = await getAccessToken();
    for (const action of actions as ActionEnAttente[]) {
      const resultat = await rejouer(action, token);
      if (resultat.statut === "reseau") break; // toujours hors-ligne (ou serveur indisponible) — on arrête, on réessaiera plus tard
      await retirerActionEnAttente(action.id);
      if (resultat.statut === "rejete") {
        // L'action a bien été transmise mais REFUSÉE — l'utilisateur doit le
        // savoir au lieu qu'elle disparaisse silencieusement de la file.
        Alert.alert("Non envoyé", `${action.descriptionCourte} : ${resultat.message}`);
      }
    }
    const restantes = await listerActionsEnAttente();
    ecouteurs.forEach((e) => e(restantes.length));
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
  // Rejet métier (4xx/5xx) — transmise et traitée par le serveur (acceptée
  // ou refusée) : jamais rejouée indéfiniment, mais à signaler.
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
  AppState.addEventListener("change", (etat) => {
    if (etat === "active") synchroniser().catch(() => undefined);
  });
  setInterval(() => synchroniser().catch(() => undefined), 30000);
}
