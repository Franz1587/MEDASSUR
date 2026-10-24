-- AlterTable
ALTER TABLE "BordereauReglement" ADD COLUMN     "transactionEbillingId" TEXT;

-- CreateIndex
CREATE INDEX "BordereauReglement_transactionEbillingId_idx" ON "BordereauReglement"("transactionEbillingId");

-- AddForeignKey
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_transactionEbillingId_fkey" FOREIGN KEY ("transactionEbillingId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
