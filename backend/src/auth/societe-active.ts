import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Refuse l'accès si la société du compte est suspendue. Un compte sans société
 * (super_admin) n'est jamais concerné. Utilisé à la connexion et à chaque
 * requête authentifiée (JwtStrategy), pour qu'une suspension coupe aussi les
 * sessions déjà ouvertes.
 */
export async function verifierSocieteNonSuspendue(prisma: PrismaService, societeId: string | null | undefined) {
  if (!societeId) return null;
  const societe = await prisma.societeAssurance.findUnique({ where: { id: societeId } });
  if (societe?.statut === "Suspendu") {
    throw new UnauthorizedException(`Accès suspendu pour votre société${societe.motifSuspension ? ` (${societe.motifSuspension})` : ""} — contactez l'administrateur de la plateforme.`);
  }
  return societe;
}
