import type { BadgeVariant } from "@/components/shared/Badge";

// Statut d'un bon (Ordonnance/Examen) — Non traité / Partiellement traité /
// Traité (2026-08) — voir demande utilisateur : "le statut du bon (Non
// traité, Partiellement traité, Traité)... les mêmes informations doivent
// apparaître prestataire." Libellés et couleurs partagés entre le E-carnet
// Santé (assuré) et les écrans médecin/prestataire qui listent des bons.
export type StatutBon = "NonTraite" | "PartiellementTraite" | "Traite";

export const LABEL_STATUT_BON: Record<StatutBon, string> = {
  NonTraite: "Non traité",
  PartiellementTraite: "Partiellement traité",
  Traite: "Traité",
};

export const VARIANT_STATUT_BON: Record<StatutBon, BadgeVariant> = {
  NonTraite: "neutral",
  PartiellementTraite: "warning",
  Traite: "success",
};

export function statutBonDe(lignes: { statut: string }[]): StatutBon {
  if (lignes.every((l) => l.statut === "EnAttente")) return "NonTraite";
  if (lignes.every((l) => l.statut === "Traite")) return "Traite";
  return "PartiellementTraite";
}
