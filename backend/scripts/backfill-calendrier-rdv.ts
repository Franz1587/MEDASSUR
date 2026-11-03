/**
 * Backfill : ajoute "prestataireCalendrier" aux modules de tous les comptes
 * prestataire_sante existants (ceux dont les modules sont figés à la création).
 *
 * Le PortalShell filtre ensuite à l'affichage :
 *   - médecin@ / pharmacien@ → gardent prestataireRendezVous, perdent prestataireCalendrier
 *   - accueil@ / facturation@ / vendeur@ → gardent prestataireCalendrier, perdent prestataireRendezVous
 *
 * Usage (depuis le dossier backend/) :
 *   npx ts-node scripts/backfill-calendrier-rdv.ts
 * Ou dans Docker :
 *   node -e "require('./dist/src/backfill-calendrier-rdv')" (après build)
 */

import { PrismaClient } from "@prisma/client";

const MODULE_NOUVEAU = "prestataireCalendrier";

async function main() {
  const prisma = new PrismaClient();
  try {
    const utilisateurs = await prisma.user.findMany({
      where: { roleId: "prestataire_sante" },
      select: { id: true, email: true, modules: true },
    });

    console.log(`${utilisateurs.length} comptes prestataire_sante trouvés.`);

    let mis = 0;
    for (const u of utilisateurs) {
      const modules = u.modules as string[];
      if (modules.includes(MODULE_NOUVEAU)) continue;

      // Insérer prestataireCalendrier juste avant prestataireRendezVous (ou en fin de liste)
      const idx = modules.indexOf("prestataireRendezVous");
      const maj = [...modules];
      if (idx !== -1) maj.splice(idx, 0, MODULE_NOUVEAU);
      else maj.push(MODULE_NOUVEAU);

      await prisma.user.update({ where: { id: u.id }, data: { modules: maj } });
      mis++;
      console.log(`  ✓ ${u.email} — modules mis à jour`);
    }

    console.log(`\nTerminé : ${mis} compte(s) mis à jour, ${utilisateurs.length - mis} déjà à jour.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
