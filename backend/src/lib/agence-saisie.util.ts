import type { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";

// Agence de SAISIE d'une facture/d'un remboursement (2026-09) — voir
// demande utilisateur : "faire remonter les sinistres... en fonction des
// prestataires d'une ville et surtout de l'agence dans laquelle les factures
// des prestataires médicaux ont été saisies." = agence de l'agent qui saisit
// (gestionnaire explicite, sinon utilisateur connecté — couvre aussi les
// imports). null : portail prestataire, agent sans agence (siège).
export async function agenceDeSaisie(prisma: PrismaService, gestionnaireId?: string | null): Promise<string | null> {
  const userId = gestionnaireId ?? TenantContext.getUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { agenceId: true } });
  return user?.agenceId ?? null;
}
