-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_compagnieId_fkey";

-- DropTable
DROP TABLE "Commission";

-- CreateTable
CREATE TABLE "CommissionReversement" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Reversé',
    "dateReversement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionReversement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionReversement_compagnieId_periode_key" ON "CommissionReversement"("compagnieId", "periode");

-- AddForeignKey
ALTER TABLE "CommissionReversement" ADD CONSTRAINT "CommissionReversement_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
