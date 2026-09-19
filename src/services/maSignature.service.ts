import { http, uploadFile, API_URL } from "@/lib/http";
import type { UserAccount } from "@/types/admin";

// Signature électronique — libre-service (2026-09) — voir demande
// utilisateur : "le médecin puisse dans son compte mettre sa signature...
// elle pourra s'ajouter systématiquement dans tous les documents où sa
// signature sera nécessaire." Fonctionne pour N'IMPORTE QUEL rôle connecté
// (médecin, agent d'une société, assuré, souscripteur...) — l'API
// backend (/users/moi/...) résout toujours le compte depuis le token,
// jamais un id transmis par le client.

export function signatureUrl(signature?: string | null): string | undefined {
  if (!signature) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/signatures/${signature}`;
}

export async function getMoi(): Promise<UserAccount> {
  return http.get<UserAccount>("/users/moi");
}

export async function uploaderMaSignature(file: File): Promise<UserAccount> {
  return uploadFile<UserAccount>("/users/moi/signature", file, "signature");
}

export async function supprimerMaSignature(): Promise<UserAccount> {
  return http.delete<UserAccount>("/users/moi/signature");
}

export interface JetonSignatureQr {
  token: string;
  url: string;
  qrDataUrl: string;
  expiresAt: string;
}

export async function genererQrSignature(): Promise<JetonSignatureQr> {
  return http.post<JetonSignatureQr>("/users/moi/signature/qr", {});
}

export async function statutJetonSignature(token: string): Promise<{ signe: boolean }> {
  return http.get<{ signe: boolean }>(`/users/moi/signature/qr/${token}/statut`);
}

// ── Page publique de signature (scannée depuis le QR, jamais connectée) ──

export async function infoJetonSignaturePublique(token: string): Promise<{ nom: string }> {
  return http.get<{ nom: string }>(`/signer/${token}`);
}

export async function envoyerSignaturePublique(token: string, imageDataUrl: string): Promise<void> {
  await http.post(`/signer/${token}`, { imageDataUrl });
}
