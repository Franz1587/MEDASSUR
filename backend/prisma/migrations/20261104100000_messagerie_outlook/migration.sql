-- Messagerie type Outlook : corps riche, pièces jointes multiples, dossiers, signatures.
ALTER TABLE "Communication" ADD COLUMN "contenuHtml" TEXT;
ALTER TABLE "Communication" ADD COLUMN "piecesJointes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Communication" ADD COLUMN "cc" TEXT;
ALTER TABLE "Communication" ADD COLUMN "messageId" TEXT;
ALTER TABLE "Communication" ADD COLUMN "lu" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Communication" ADD COLUMN "archive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Communication" ADD COLUMN "supprime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Communication" ADD COLUMN "suivi" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Communication_messageId_idx" ON "Communication"("messageId");

-- Reprise : l'ancienne pièce jointe unique rejoint la liste.
UPDATE "Communication" SET "piecesJointes" = ARRAY["pieceJointe"] WHERE "pieceJointe" IS NOT NULL;

ALTER TABLE "User" ADD COLUMN "signatureEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "signatureSms" TEXT;
