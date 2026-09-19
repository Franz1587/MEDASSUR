ALTER TABLE "AccordPrealable" ADD COLUMN "demandeurId" TEXT;
ALTER TABLE "AccordPrealable" ADD CONSTRAINT "AccordPrealable_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
