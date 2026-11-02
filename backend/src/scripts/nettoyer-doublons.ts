// Nettoyage des doublons d'import sur TOUTES les sociétés.
// Usage dans le container :
//   npx ts-node -T src/scripts/nettoyer-doublons.ts          → aperçu
//   SUPPRIMER=1 npx ts-node -T src/scripts/nettoyer-doublons.ts → suppression
import { PrismaClient } from "@prisma/client";
import { TenantContext } from "../tenant/tenant-context";
import { NettoyageDoublonsService } from "../import/nettoyage-doublons.service";

async function main() {
  const prisma = new PrismaClient();
  // PrismaService étend PrismaClient et ajoute le middleware tenant.
  // Ce script utilise PrismaClient brut : pas de middleware, mais les candidats
  // sont filtrés par societeId dans le SQL brut de candidates(), et les
  // deleteMany filtrent par IDs déjà corrects. Pas de risque inter-société.
  const service = new NettoyageDoublonsService(prisma as any);
  const supprimer = process.env.SUPPRIMER === "1";

  const societes = await prisma.societeAssurance.findMany({
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });

  console.log(`\n=== Doublons — mode ${supprimer ? "SUPPRESSION" : "APERÇU"} ===`);
  console.log(`${societes.length} société(s)\n`);

  let totalLignes = 0, totalFactures = 0, totalBloquees = 0;

  for (const s of societes) {
    try {
      const bilan = await TenantContext.run(s.id, () => service.analyser(supprimer));
      if (bilan.groupes === 0) {
        console.log(`[${s.nom}] aucun doublon`);
      } else if (supprimer) {
        console.log(`[${s.nom}] ${bilan.lignesSupprimees} lignes supprimées, ${bilan.facturesSupprimees} factures vidées (${bilan.lignesBloquees} bloquées)`);
        totalLignes += bilan.lignesSupprimees;
        totalFactures += bilan.facturesSupprimees;
        totalBloquees += bilan.lignesBloquees;
      } else {
        console.log(`[${s.nom}] ${bilan.lignesASupprimer} lignes à supprimer, ${bilan.facturesVidees} factures à vider, ${bilan.lignesBloquees} bloquées`);
        for (const ex of bilan.exemples.slice(0, 3)) {
          console.log(`   → ${ex.prestataire} / réf ${ex.reference} : ${ex.exemplaires} ex. (${ex.gardees} gardé)`);
        }
        totalLignes += bilan.lignesASupprimer;
        totalFactures += bilan.facturesVidees;
        totalBloquees += bilan.lignesBloquees;
      }
    } catch (e: unknown) {
      console.error(`[${s.nom}] ERREUR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n--- TOTAL ---`);
  console.log(`${totalLignes} lignes, ${totalFactures} factures, ${totalBloquees} bloquées`);
  if (!supprimer) console.log(`\nRelancer avec  SUPPRIMER=1 npx ts-node -T src/scripts/nettoyer-doublons.ts`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
