-- Codification des affections CNAMGS (2026-08) — voir demande utilisateur :
-- "implémenter dans la base de données les codes d'affection".

CREATE TABLE "CodeAffection" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "chapitre" TEXT NOT NULL,

    CONSTRAINT "CodeAffection_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "CodeAffection_chapitre_idx" ON "CodeAffection"("chapitre");

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_codeAffection_fkey" FOREIGN KEY ("codeAffection") REFERENCES "CodeAffection"("code") ON DELETE SET NULL ON UPDATE CASCADE;
