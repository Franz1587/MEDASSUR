// Agence — succursale du courtier/compagnie/mutuelle exploitant
// l'application (voir backend/prisma/schema.prisma Agence). Un agent de
// saisie (User.agenceId) y est rattaché pour que cette agence remonte sur
// le Décompte/Règlement — voir demande utilisateur : "lier un agent de
// saisie à une agence du client... afin que ce soit cette agence qui
// remonte sur le décompte."
export interface Agence {
  id: string;
  nom: string;
  code?: string | null;
  createdAt: string;
}

export interface AgenceUpsertInput {
  nom: string;
  code?: string;
}
