import type { PrismaService } from "../prisma/prisma.service";

// Famille étendue d'un assuré (2026-08) : lui-même, ses ayants droit et
// leurs affiliations sur d'autres polices (même identité). Partagé par le
// portail assuré et le suivi de santé (rendez-vous, accès au dossier).
export async function idsFamilleDe(prisma: PrismaService, assureSanteId: string): Promise<string[]> {
  const selection = await prisma.assureSante.findMany({
    where: { OR: [{ id: assureSanteId }, { familleId: assureSanteId }] },
    select: { id: true, familleId: true, identiteId: true },
  });
  const identiteIds = selection.map((a) => a.identiteId).filter((id): id is string => !!id);
  const affiliations = identiteIds.length > 0
    ? await prisma.assureSante.findMany({ where: { identiteId: { in: identiteIds } }, select: { id: true, familleId: true } })
    : selection;
  const racineIds = [...new Set(affiliations.map((a) => a.familleId ?? a.id))];
  const familleEtendue = await prisma.assureSante.findMany({
    where: { OR: [{ id: { in: racineIds } }, { familleId: { in: racineIds } }] },
    select: { id: true },
  });
  return [...new Set(familleEtendue.map((a) => a.id))];
}
