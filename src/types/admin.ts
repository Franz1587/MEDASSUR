import type { RoleId } from "@/auth/roles";

// Droits par utilisateur (2026-08) — voir demande utilisateur : "c'est
// l'administrateur qui donne les droits aux fonctionnalités". `modules`
// est la liste des View (voir src/layout/navConfig.ts) réellement
// accordées à CET utilisateur — source d'autorité pour AdminShell.tsx,
// distincte du modèle par défaut du rôle (roles.ts `allowedModules`).
export interface UserAccount {
  id: string;
  nom: string;
  email: string;
  initiales: string;
  roleId: RoleId;
  modules: string[];
  createdAt: string;
  // Coordonnées personnelles + photo de profil (2026-08, voir demande
  // utilisateur : "ajouter les coordonnées personnels, y compris la photo
  // de profil").
  telephone?: string | null;
  adresse?: string | null;
  photo?: string | null;
  // Signature électronique (2026-09) — voir src/services/maSignature.service.ts.
  signature?: string | null;
  // Société de rattachement (2026-09) — absente (null) pour un compte
  // Super Admin, qui n'appartient à aucune société — voir écran Super
  // Admin "Utilisateurs" (src/features/super-admin/Utilisateurs.tsx).
  societeId?: string | null;
  societe?: { nom: string } | null;
  // Agence de rattachement (2026-09) — voir demande utilisateur : "lier un
  // agent de saisie à une agence... afin que ce soit cette agence qui
  // remonte sur le décompte" (src/features/agences/index.tsx).
  agenceId?: string | null;
  agence?: { id: string; nom: string } | null;
}

export interface RoleSummary {
  id: RoleId;
  label: string;
  nombreUtilisateurs: number;
}
