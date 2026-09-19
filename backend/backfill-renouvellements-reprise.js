// Backfill (2026-09) — voir demande utilisateur : "puisqu'il y a
// récupération des données, le premier exercice doit être l'affaire
// nouvelle et le reste des exercices sont des renouvellements à ces
// périodes." Les contrats déjà importés (reprise de données, intervalle >
// 12 mois découpé en plusieurs Exercice d'un coup) n'avaient reçu AUCUN
// avenant "Renouvellement" pour leurs exercices 2+ — invisibles de
// l'Historique des mouvements et hors de portée de la synchronisation de
// prime (ContratsService.mettreAJourPrimeExercice, qui cherche l'avenant
// portant le même exerciceNumero). Ce script crée, pour chaque contrat
// ayant plusieurs Exercice, un avenant "Renouvellement" pour chaque
// exercice numero >= 2 qui n'en a PAS DÉJÀ un (ne touche jamais un
// exercice qui a déjà son avenant — renouvellement réel passé par
// AvenantsService.appliquer, à ne surtout pas dupliquer).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const contrats = await prisma.contrat.findMany({
    select: { id: true, prime: true },
  });

  let contratsTouches = 0, avenantsCrees = 0;
  for (const contrat of contrats) {
    const exercices = await prisma.exercice.findMany({ where: { contratId: contrat.id }, orderBy: { numero: "asc" } });
    if (exercices.length <= 1) continue;

    const avenantsExistants = await prisma.avenant.findMany({
      where: { contratId: contrat.id, exerciceNumero: { in: exercices.map((e) => e.numero) } },
      select: { exerciceNumero: true },
    });
    const numerosAvecAvenant = new Set(avenantsExistants.map((a) => a.exerciceNumero));

    const aCreer = exercices.filter((e) => e.numero >= 2 && !numerosAvecAvenant.has(e.numero));
    if (aCreer.length === 0) continue;

    const primeParNumero = new Map(exercices.map((e) => [e.numero, Number(e.prime)]));
    await prisma.avenant.createMany({
      data: aCreer.map((e) => {
        const primeAvant = primeParNumero.get(e.numero - 1) ?? Number(contrat.prime);
        const primeApres = Number(e.prime);
        return {
          id: `AVN-${new Date().getFullYear()}-${require("crypto").randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
          contratId: contrat.id, type: "Renouvellement",
          description: `Renouvellement (reprise de données) — période ${e.dateDebut} au ${e.dateFin}`,
          primeAvant, primeApres,
          dateEffet: e.dateDebut, statut: "Appliqué", exerciceNumero: e.numero,
        };
      }),
    });
    contratsTouches++;
    avenantsCrees += aCreer.length;
    console.log(`OK — contrat ${contrat.id} : ${aCreer.length} avenant(s) Renouvellement créé(s) pour exercice(s) ${aCreer.map((e) => e.numero).join(", ")}`);
  }

  console.log(`\nTerminé : ${contratsTouches} contrat(s) touché(s), ${avenantsCrees} avenant(s) "Renouvellement" créé(s) au total.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
