-- CreateTable
CREATE TABLE "RapportConversationIA" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "conversationId" TEXT NOT NULL,
    "demandeurNom" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "resume" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportConversationIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RapportConversationIA_conversationId_key" ON "RapportConversationIA"("conversationId");

-- CreateIndex
CREATE INDEX "RapportConversationIA_societeId_idx" ON "RapportConversationIA"("societeId");

-- CreateIndex
CREATE INDEX "RapportConversationIA_lu_idx" ON "RapportConversationIA"("lu");

-- AddForeignKey
ALTER TABLE "RapportConversationIA" ADD CONSTRAINT "RapportConversationIA_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportConversationIA" ADD CONSTRAINT "RapportConversationIA_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
