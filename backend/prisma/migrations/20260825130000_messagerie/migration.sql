CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "demandeurRole" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Ouverte',
    "assigneAId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conversation_demandeurId_idx" ON "Conversation"("demandeurId");
CREATE INDEX "Conversation_assigneAId_idx" ON "Conversation"("assigneAId");

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "auteurId" TEXT,
    "auteurType" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "pieceJointe" TEXT,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
