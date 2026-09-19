-- Assistance liée à la Maladie : un contrat Assistance peut référencer son
-- contrat Maladie (population partagée, jamais dupliquée — voir schema.prisma).
ALTER TABLE "Contrat" ADD COLUMN "contratMaladieLieId" TEXT;
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_contratMaladieLieId_fkey" FOREIGN KEY ("contratMaladieLieId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Historique de compagnie : un avenant "Changement de Compagnie" scinde
-- l'Exercice en cours (même numero, compagnieId différent) pour garder la
-- traçabilité "quelle compagnie à quelle période" sans écraser l'historique.
ALTER TABLE "Exercice" ADD COLUMN "compagnieId" TEXT;
ALTER TABLE "Exercice" ADD CONSTRAINT "Exercice_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Instantané avant/après compagnie sur l'avenant lui-même (comme
-- primeAvant/primeApres) — pas de contrainte FK stricte, cohérent avec le
-- reste de l'historique d'Avenant.
ALTER TABLE "Avenant" ADD COLUMN "compagnieAvantId" TEXT;
ALTER TABLE "Avenant" ADD COLUMN "compagnieApresId" TEXT;
