// Backfill (2026-09) — recalcule BordereauReglement.montantTotal/
// montantValide vers le montant NET (base remboursement - TPS) au lieu des
// frais réels bruts, pour tout bordereau déjà en base — voir demande
// utilisateur : "les informations du règlement maladie ne sont pas en
// harmonie avec les autres données de la chaîne de traitement et règlement
// d'une facture". Même règle que backend/src/lib/montant-net.util.ts,
// désormais utilisée par ReglementPrestataireService à la création.
//
// Les bordereaux SANS aucune ligne rattachée (import en masse depuis Excel,
// voir import.service.ts importerReglements — créés sans `prisesEnCharge:
// { connect: ... }`) sont délibérément IGNORÉS : recalculer depuis 0 ligne
// écraserait à 0 un montant réel saisi manuellement lors de l'import, sans
// aucune donnée pour le reconstituer. Listés en sortie pour visibilité.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function montantNet(lignes) {
  return lignes.reduce((s, l) => {
    const base = l.baseRemboursement != null ? Number(l.baseRemboursement) : 0;
    const tps = l.montantTps != null ? Number(l.montantTps) : 0;
    return s + (base - tps);
  }, 0);
}

async function main() {
  const bordereaux = await prisma.bordereauReglement.findMany({
    include: { prisesEnCharge: { select: { baseRemboursement: true, montantTps: true } } },
  });

  let maj = 0, ignores = 0;
  for (const b of bordereaux) {
    if (b.prisesEnCharge.length === 0) {
      ignores++;
      console.log(`IGNORÉ (aucune ligne rattachée) — ${b.numero} (${b.id}) statut=${b.statut} : montantTotal=${b.montantTotal} montantValide=${b.montantValide ?? "—"}`);
      continue;
    }
    const net = Math.round(montantNet(b.prisesEnCharge) * 100) / 100;
    const ancienTotal = Number(b.montantTotal);
    const ancienValide = b.montantValide != null ? Number(b.montantValide) : null;
    await prisma.bordereauReglement.update({
      where: { id: b.id },
      data: {
        montantTotal: net,
        montantValide: b.montantValide != null ? net : null,
      },
    });
    maj++;
    console.log(`OK — ${b.numero} (${b.id}) statut=${b.statut} : montantTotal ${ancienTotal} -> ${net}${ancienValide != null ? `, montantValide ${ancienValide} -> ${net}` : ""}`);
  }
  console.log(`\nTerminé : ${maj} bordereau(x) recalculé(s), ${ignores} ignoré(s) (aucune ligne rattachée, laissés inchangés).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
