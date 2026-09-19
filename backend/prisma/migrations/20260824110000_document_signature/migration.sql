-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentRef" TEXT NOT NULL,
    "acteurId" TEXT,
    "acteurNom" TEXT NOT NULL,
    "acteurRole" TEXT NOT NULL,
    "origine" TEXT NOT NULL,
    "dateSignature" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentSignature_documentType_documentRef_idx" ON "DocumentSignature"("documentType", "documentRef");

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
