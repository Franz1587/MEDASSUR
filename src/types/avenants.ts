import type { mockAvenants } from "@/data/mock/avenants.mock";

// Traçabilité structurée personne par personne d'un avenant Incorporation ou
// Retrait — voir backend/prisma/schema.prisma AvenantAssure. Absent (ou
// vide) pour les autres types d'avenant (Ajustement de Prime, etc.), qui
// n'ont pas de mouvement de population associé.
export interface AvenantPersonne {
  id: string;
  assureId: string;
  nom: string;
  prenom?: string | null;
  matricule?: string | null;
  typeAssure?: string | null;
  action: "Incorporation" | "Retrait";
}

export type Avenant = (typeof mockAvenants)[number] & { personnes?: AvenantPersonne[] };
