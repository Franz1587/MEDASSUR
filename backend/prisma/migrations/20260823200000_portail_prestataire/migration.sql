-- AlterTable
ALTER TABLE "User" ADD COLUMN "prestataireId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_prestataireId_key" ON "User"("prestataireId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
