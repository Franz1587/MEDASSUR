import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_URL, getAccessToken } from "./http";

// Ouverture de documents PDF protégés par JWT (2026-09) — équivalent mobile
// de src/services/documents.service.ts (openDocument → afficherPdf) côté
// web. Un lien direct ne fonctionne pas : l'endpoint exige l'en-tête
// Authorization. On télécharge donc le PDF vers le stockage local de
// l'appli (avec le token), puis on ouvre la feuille de partage native
// (Sharing.shareAsync) qui laisse l'utilisateur l'ouvrir dans n'importe
// quelle visionneuse PDF installée, l'enregistrer ou l'envoyer — pas de
// rendu PDF natif ré-implémenté ici (cf. mission : "pas besoin de le
// re-render nativement").
// Un "numéro" de document métier (ex. "FS-000021/2026") contient souvent un
// "/" — utilisé tel quel dans un chemin de fichier local, il crée un
// sous-dossier implicite qu'aucun code ne crée jamais, et
// FileSystem.downloadAsync refuse d'écrire dedans ("Directory ... doesn't
// exist"), crash constaté sur l'E-carnet Santé (feuille de soins/examen).
// Remplace tout caractère non sûr pour un nom de fichier par "-".
function nomFichierSur(nom: string): string {
  return nom.replace(/[/\\?%*:|"<>]/g, "-");
}

export async function ouvrirDocument(path: string, nomFichierRepli = "document.pdf"): Promise<void> {
  const token = await getAccessToken();
  // `path` est parfois déjà une URL absolue (fichier uploadé servi
  // publiquement, ex. urlCarnetSante()) plutôt qu'un chemin API relatif —
  // voir même distinction dans DocumentViewerScreen.tsx.
  const url = /^https?:\/\//i.test(path) ? path : `${API_URL}${path}`;
  const repliSur = nomFichierSur(nomFichierRepli);
  const dest = `${FileSystem.cacheDirectory}${Date.now()}-${repliSur}`;
  const result = await FileSystem.downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.status !== 200) {
    throw new Error(`Génération du document impossible (${result.status})`);
  }
  const nomFichier = nomFichierSur(nomFichierDepuisEntetes(result.headers, repliSur));
  let finalUri = result.uri;
  if (nomFichier !== repliSur) {
    // Renomme localement pour que la feuille de partage propose le vrai nom
    // (même besoin que côté web — Content-Disposition — voir documents.service.ts).
    const renamed = `${FileSystem.cacheDirectory}${nomFichier}`;
    try {
      await FileSystem.copyAsync({ from: result.uri, to: renamed });
      finalUri = renamed;
    } catch {
      // repli silencieux sur le nom temporaire si la copie échoue
    }
  }
  const disponible = await Sharing.isAvailableAsync();
  if (!disponible) throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  await Sharing.shareAsync(finalUri, { mimeType: "application/pdf", dialogTitle: nomFichier });
}

function nomFichierDepuisEntetes(headers: Record<string, string> | undefined, repli: string): string {
  const entete = headers?.["Content-Disposition"] ?? headers?.["content-disposition"];
  const correspondance = entete?.match(/filename="?([^";]+)"?/i);
  return correspondance?.[1] ?? repli;
}
