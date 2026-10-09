import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { RnFilePart } from "../api/http";

// Sélection d'une ou plusieurs pièces jointes (2026-10) — voir demande
// utilisateur : "il faut que l'application permette dans un échange de
// message ou pour toute autre raison la sélection de plusieurs pièces
// jointes (de tout format de document et d'image). Actuellement on ne peut
// sélectionner qu'une seule pièce et non plusieurs." Remplace les 4 copies
// quasi identiques de `choisirFichier()` (messagerie, entente préalable ×2,
// remboursement), qui ne proposaient qu'un seul fichier à la fois.
//
// "Prendre une photo" reste à l'unité (l'appareil photo ne capture qu'un
// cliché par appel — rien n'empêche l'utilisateur de rappeler ce bouton
// plusieurs fois) ; "Choisir des photos" (galerie) et "Choisir des
// documents" acceptent une sélection multiple native de l'appareil.
export function choisirFichiers(): Promise<RnFilePart[]> {
  return new Promise((resolve) => {
    Alert.alert(
      "Ajouter des documents",
      "Photo prise sur le champ, photos de la galerie, ou fichiers existants (PDF, image…) — plusieurs à la fois si besoin.",
      [
        {
          text: "Prendre une photo",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { resolve([]); return; }
            const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (res.canceled || !res.assets?.[0]) { resolve([]); return; }
            const a = res.assets[0];
            resolve([{ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" }]);
          },
        },
        {
          text: "Choisir des photos",
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { resolve([]); return; }
            const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
            if (res.canceled || !res.assets?.length) { resolve([]); return; }
            resolve(res.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`, type: a.mimeType ?? "image/jpeg" })));
          },
        },
        {
          text: "Choisir des documents",
          onPress: async () => {
            const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: true });
            if (res.canceled || !res.assets?.length) { resolve([]); return; }
            resolve(res.assets.map((a, i) => ({ uri: a.uri, name: a.name ?? `document-${Date.now()}-${i}`, type: a.mimeType ?? "application/octet-stream" })));
          },
        },
        { text: "Annuler", style: "cancel", onPress: () => resolve([]) },
      ],
      { cancelable: true, onDismiss: () => resolve([]) },
    );
  });
}
