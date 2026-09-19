-- Un établissement porte désormais plusieurs comptes portail génériques
-- (Accueil/Vendeur, Facturation, Médecin/Pharmacien) au lieu d'un seul.
DROP INDEX "User_prestataireId_key";
CREATE INDEX "User_prestataireId_idx" ON "User"("prestataireId");
