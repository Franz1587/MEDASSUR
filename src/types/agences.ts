// Agence — succursale du courtier/compagnie/mutuelle exploitant
// l'application (voir backend/prisma/schema.prisma Agence). Un agent de
// saisie (User.agenceId) y est rattaché pour que cette agence remonte sur
// le Décompte/Règlement — voir demande utilisateur : "lier un agent de
// saisie à une agence du client... afin que ce soit cette agence qui
// remonte sur le décompte." Entièrement paramétrée depuis l'écran Agences
// (2026-09 — "rendre paramétrable la création des agences au lieu de
// laisser juste le code le décider"), y compris les mentions qui
// rattachent automatiquement un contrat importé à l'agence.
export type StatutAgence = "Actif" | "Inactif";

export interface Agence {
  id: string;
  nom: string;
  code?: string | null;
  ville?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  responsable?: string | null;
  statut: StatutAgence;
  mentionsImport: string[];
  createdAt: string;
  _count?: { contrats: number; agents: number };
}

export interface AgenceUpsertInput {
  nom: string;
  code?: string;
  ville?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  responsable?: string;
  statut?: StatutAgence;
  mentionsImport?: string[];
}
