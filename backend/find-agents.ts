import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Cherche par numéro de police ou par nom client "RUCHE"
  // Cherche quel contrat contient le matricule 0346-00929
  const assures = await prisma.assureSante.findMany({
    where: { matricule: { in: ['0346-00929', 'LRX-73510T', '3169-08023'] } },
    select: { contratId: true, matricule: true, nom: true, contrat: { select: { numeroPolice: true, societeId: true } } }
  });
  console.log(JSON.stringify(assures, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
