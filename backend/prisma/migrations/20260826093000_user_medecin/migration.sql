-- Compte du portail médecin (2026-08) — voir demande utilisateur : "le
-- médecin doit avoir ses accès différents de ceux de la clinique ou
-- l'hôpital... il faut donc créer un compte demo pour le médecin".

ALTER TABLE "User" ADD COLUMN "medecinId" TEXT;
CREATE UNIQUE INDEX "User_medecinId_key" ON "User"("medecinId");
ALTER TABLE "User" ADD CONSTRAINT "User_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
