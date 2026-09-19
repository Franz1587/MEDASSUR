// Règles & Consignes (2026-08) — voir demande utilisateur : liste globale
// mise en place côté assurance (zone "Système"), lue en lecture seule côté
// portail client. Voir backend/prisma/schema.prisma RegleConsigne.
export interface RegleConsigne {
  id: string;
  titre: string;
  contenu: string;
  fichier?: string | null;
  ordre: number;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegleConsigneUpsertInput {
  titre: string;
  contenu: string;
  ordre?: number;
  actif?: boolean;
}
