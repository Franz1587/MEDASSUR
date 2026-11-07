import type { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";

// Ligne de journal d'audit écrite depuis un service métier (table AuditLog
// existante, voir AuditLogService.log) — complète le journal HTTP générique
// de AuditInterceptor par le détail de ce qui a été supprimé/annulé (après
// suppression, l'enregistrement n'existe plus). Ne fait jamais échouer
// l'opération métier appelante.
export async function ecrireTraceAudit(
  prisma: PrismaService, entite: string, entiteId: string, action: string, details?: Record<string, unknown>,
): Promise<void> {
  try {
    const userId = TenantContext.getUserId();
    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;
    await prisma.auditLog.create({
      data: { entite, entiteId, action, utilisateur: user?.email ?? "système", details: details ? JSON.stringify(details) : undefined },
    });
  } catch {
    // Traçabilité best-effort : voir commentaire de tête.
  }
}
