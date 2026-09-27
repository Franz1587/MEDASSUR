-- Agence de saisie des factures et remboursements (bordereau sinistres par agence)
ALTER TABLE "Facture" ADD COLUMN "agenceId" TEXT;
ALTER TABLE "Remboursement" ADD COLUMN "agenceId" TEXT;
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_agenceId_fkey" FOREIGN KEY ("agenceId") REFERENCES "Agence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Remboursement" ADD CONSTRAINT "Remboursement_agenceId_fkey" FOREIGN KEY ("agenceId") REFERENCES "Agence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Facture_agenceId_idx" ON "Facture"("agenceId");
CREATE INDEX "Remboursement_agenceId_idx" ON "Remboursement"("agenceId");

-- Rattrapage : agence actuelle de l'agent qui a saisi (meilleure information disponible).
UPDATE "Facture" f SET "agenceId" = u."agenceId" FROM "User" u WHERE u.id = f."gestionnaireId" AND u."agenceId" IS NOT NULL AND f."agenceId" IS NULL;
UPDATE "Remboursement" r SET "agenceId" = u."agenceId" FROM "User" u WHERE u.id = r."gestionnaireId" AND u."agenceId" IS NOT NULL AND r."agenceId" IS NULL;
