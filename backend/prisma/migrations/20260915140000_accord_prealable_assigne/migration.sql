-- Prise en main d'un dossier de prise en charge (2026-09).
ALTER TABLE "AccordPrealable" ADD COLUMN "assigneAId" TEXT;
CREATE INDEX "AccordPrealable_assigneAId_idx" ON "AccordPrealable"("assigneAId");
