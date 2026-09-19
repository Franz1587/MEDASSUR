ALTER TABLE "AccordPrealable" ADD COLUMN "prescriptionRef" TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "montantDevis" DECIMAL(18,2);
ALTER TABLE "AccordPrealable" ADD COLUMN "origine" TEXT NOT NULL DEFAULT 'Agent';
