import { PrismaService } from "../prisma/prisma.service";

// Référence numérique séquentielle (2026-08) — voir demande utilisateur :
// "Est-ce que tu ne peux pas simplement référencer les clients avec un
// code numérique. Exemple : 260145." AA (2 derniers chiffres de l'année)
// + compteur séquentiel sur 4 chiffres (846605-style, voir
// prochainNumeroQuittance dans documents.service.ts), jamais remis à
// zéro. Un compteur DÉDIÉ par entité (`cle` — "client", "contrat"…) dans
// CompteurDocument pour que chaque série reste indépendante, jamais
// partagée entre deux types de référence différents.
export async function genererIdNumerique(prisma: PrismaService, cle: string): Promise<string> {
  const compteur = await prisma.compteurDocument.upsert({
    where: { id: cle },
    update: { valeur: { increment: 1 } },
    create: { id: cle, valeur: 1 },
  });
  const aa = String(new Date().getFullYear()).slice(-2);
  return `${aa}${String(compteur.valeur).padStart(4, "0")}`;
}
