-- Signature électronique (image) par utilisateur + capture par QR code
ALTER TABLE "User" ADD COLUMN "signature" TEXT;

CREATE TABLE "SignatureToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignatureToken_token_key" ON "SignatureToken"("token");

CREATE INDEX "SignatureToken_userId_idx" ON "SignatureToken"("userId");

ALTER TABLE "SignatureToken" ADD CONSTRAINT "SignatureToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
