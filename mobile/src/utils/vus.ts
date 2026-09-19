import * as SecureStore from "expo-secure-store";

// Suivi "vu/non vu" côté appareil (2026-09) — voir demande utilisateur :
// "le symbole de notification... ne doit pas rester indéfiniment ainsi
// même quand il n'y a pas de retour... si on a déjà ouvert la rubrique et
// consulté, ça doit disparaître". Les bulles de compteur (Prise en charge,
// Remboursement, E-carnet, Réseau de soins...) reflétaient jusqu'ici un
// STATUT métier (ex. "en attente"), qui ne change pas juste parce que
// l'utilisateur a regardé — ce n'est pas la même chose qu'un indicateur
// "nouveau/non lu". Stocké en local (expo-secure-store, déjà une
// dépendance de l'app — pas de nouveau module natif, compatible mise à
// jour OTA) plutôt que côté serveur : c'est un confort d'affichage propre
// à CET appareil, pas une donnée métier à synchroniser.
const PREFIXE = "medassur_vus_";
const MAX_IDS_CONSERVES = 300;

async function lireEnsemble(categorie: string): Promise<Set<string>> {
  try {
    const brut = await SecureStore.getItemAsync(`${PREFIXE}${categorie}`);
    if (!brut) return new Set();
    return new Set(JSON.parse(brut) as string[]);
  } catch {
    return new Set();
  }
}

async function ecrireEnsemble(categorie: string, ids: Set<string>): Promise<void> {
  // Purge simple si la liste grossit trop (2026-09) — un utilisateur actif
  // depuis longtemps ne doit pas accumuler indéfiniment des ids obsolètes ;
  // on garde les plus récents (fin de tableau = ajoutés en dernier).
  const liste = [...ids];
  const bornee = liste.length > MAX_IDS_CONSERVES ? liste.slice(liste.length - MAX_IDS_CONSERVES) : liste;
  try {
    await SecureStore.setItemAsync(`${PREFIXE}${categorie}`, JSON.stringify(bornee));
  } catch {
    // Jamais bloquant — au pire la bulle reste affichée un peu plus longtemps.
  }
}

export async function marquerVu(categorie: string, id: string): Promise<void> {
  const ids = await lireEnsemble(categorie);
  if (ids.has(id)) return;
  ids.add(id);
  await ecrireEnsemble(categorie, ids);
}

export async function marquerPlusieursVus(categorie: string, idsAMarquer: string[]): Promise<void> {
  if (idsAMarquer.length === 0) return;
  const ids = await lireEnsemble(categorie);
  let modifie = false;
  for (const id of idsAMarquer) { if (!ids.has(id)) { ids.add(id); modifie = true; } }
  if (modifie) await ecrireEnsemble(categorie, ids);
}

// Nombre d'éléments de `idsActuels` qui n'ont PAS encore été vus — c'est la
// valeur à afficher sur une bulle de compteur.
export async function compterNonVus(categorie: string, idsActuels: string[]): Promise<number> {
  if (idsActuels.length === 0) return 0;
  const vus = await lireEnsemble(categorie);
  return idsActuels.filter((id) => !vus.has(id)).length;
}
