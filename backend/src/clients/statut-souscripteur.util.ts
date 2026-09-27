import type { PrismaService } from "../prisma/prisma.service";

// Statut d'un souscripteur selon ses contrats (2026-09) — voir demande
// utilisateur : "on n'a jamais mis en place une fonctionnalité permettant de
// désactiver un souscripteur n'ayant plus de contrats actifs."
// Contrat actif = statut Actif ou En renouvellement (contrats de test
// exclus). Un souscripteur qui a des contrats mais plus aucun actif passe
// "Inactif" ; il redevient "Actif" dès qu'un contrat l'est. Un souscripteur
// SANS aucun contrat n'est jamais touché (fiche créée avant son contrat).
export const STATUTS_CONTRAT_ACTIFS = ["Actif", "En renouvellement"];

export async function statutAttenduSouscripteur(prisma: PrismaService, clientId: string): Promise<"Actif" | "Inactif" | null> {
  const contrats = await prisma.contrat.findMany({ where: { clientId, estTest: false }, select: { statut: true } });
  if (contrats.length === 0) return null;
  return contrats.some((c) => STATUTS_CONTRAT_ACTIFS.includes(c.statut)) ? "Actif" : "Inactif";
}

// Aligne le statut des souscripteurs donnés ; retourne ceux qui changent.
// Jamais bloquant pour l'opération sur le contrat qui l'a déclenché.
export async function synchroniserStatutSouscripteurs(
  prisma: PrismaService, clientIds: (string | null | undefined)[], simulation = false,
): Promise<{ clientId: string; nom: string; avant: string; apres: "Actif" | "Inactif" }[]> {
  const changements: { clientId: string; nom: string; avant: string; apres: "Actif" | "Inactif" }[] = [];
  for (const clientId of [...new Set(clientIds.filter((id): id is string => !!id))]) {
    try {
      const attendu = await statutAttenduSouscripteur(prisma, clientId);
      if (!attendu) continue;
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { nom: true, statut: true } });
      if (!client) continue;
      const avant = client.statut ?? "Actif";
      if (avant === attendu) continue;
      if (!simulation) await prisma.client.update({ where: { id: clientId }, data: { statut: attendu } });
      changements.push({ clientId, nom: client.nom, avant, apres: attendu });
    } catch (err) {
      console.error("Synchronisation du statut du souscripteur impossible", err);
    }
  }
  return changements;
}
