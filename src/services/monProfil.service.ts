import { http } from "@/lib/http";
import type { UserAccount } from "@/types/admin";

// "Mon profil" en libre-service (2026-09) — voir demande utilisateur : "un
// vrai formulaire Mon profil... il pourra changer de mot de passe... un
// bouton pour enregistrer les modifications". Distinct de admin.service.ts
// (gestion du compte D'AUTRUI par un administrateur) : ici l'id vient
// toujours du token JWT côté backend (voir UsersMoiController), jamais
// transmis par le client.

export interface UpdateMonProfilInput {
  nom?: string;
  telephone?: string;
  adresse?: string;
}

export async function modifierMonProfil(payload: UpdateMonProfilInput): Promise<UserAccount> {
  return http.patch<UserAccount>("/users/moi", payload);
}

export async function changerMonMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string): Promise<{ ok: true }> {
  return http.patch<{ ok: true }>("/users/moi/mot-de-passe", { ancienMotDePasse, nouveauMotDePasse });
}
