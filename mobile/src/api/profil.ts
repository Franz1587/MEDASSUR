import ReactNativeBlobUtil from "react-native-blob-util";
import { http, API_URL, getAccessToken, ApiError, type RnFilePart } from "./http";

// Miroir mobile de src/services/monProfil.service.ts +
// src/services/maSignature.service.ts (web) — "Mon profil" en libre-service
// (nom/téléphone/adresse, mot de passe, signature électronique). Voir aussi
// src/portals/MonProfilModal.tsx pour le comportement de référence.
export interface UserAccount {
  id: string;
  nom: string;
  email: string;
  roleId: string;
  telephone?: string | null;
  adresse?: string | null;
  signature?: string | null;
  modules: string[];
}

export interface UpdateMonProfilInput {
  nom?: string;
  telephone?: string;
  adresse?: string;
}

export async function getMoiCompte(): Promise<UserAccount> {
  return http.get<UserAccount>("/users/moi");
}

export async function modifierMonProfil(payload: UpdateMonProfilInput): Promise<UserAccount> {
  return http.patch<UserAccount>("/users/moi", payload);
}

export async function changerMonMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string): Promise<{ ok: true }> {
  return http.patch<{ ok: true }>("/users/moi/mot-de-passe", { ancienMotDePasse, nouveauMotDePasse });
}

export function signatureUrl(signature?: string | null): string | undefined {
  if (!signature) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/signatures/${signature}`;
}

// Envoi via react-native-blob-util (2026-09) — voir demande utilisateur :
// "l'enregistrement de la signature... il y a un message d'erreur" ("Unsupported
// FormDataPart implementation"). Le fetch natif de React Native échoue à
// construire correctement la partie fichier du multipart pour CE fichier
// précis (bug connu de la couche réseau de la Nouvelle Architecture RN sur
// certains appareils/versions Android) — react-native-blob-util contourne
// entièrement ce pont en passant par le client HTTP natif Android/iOS,
// déjà une dépendance du projet (react-native-pdf), jamais utilisée
// directement ici jusqu'à présent. uploadFile() (fetch natif) reste
// inchangé pour les autres envois (photos, documents), qui n'ont jamais
// posé ce problème.
export async function uploaderMaSignature(file: RnFilePart): Promise<UserAccount> {
  const token = await getAccessToken();
  const cheminNatif = file.uri.startsWith("file://") ? file.uri.slice("file://".length) : file.uri;
  const res = await ReactNativeBlobUtil.fetch(
    "POST",
    `${API_URL}/users/moi/signature`,
    { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "multipart/form-data" },
    [{ name: "signature", filename: file.name, type: file.type, data: ReactNativeBlobUtil.wrap(cheminNatif) }],
  );
  const statut = res.respInfo.status;
  if (statut < 200 || statut >= 300) {
    let corpsJson: unknown;
    try { corpsJson = res.json(); } catch { /* réponse non-JSON */ }
    throw new ApiError(`POST /users/moi/signature failed (${statut})`, statut, corpsJson);
  }
  return res.json() as UserAccount;
}

export async function supprimerMaSignature(): Promise<UserAccount> {
  return http.delete<UserAccount>("/users/moi/signature");
}
