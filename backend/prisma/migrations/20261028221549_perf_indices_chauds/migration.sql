-- CreateIndex
CREATE INDEX "AssureSante_contratId_statut_idx" ON "AssureSante"("contratId", "statut");

-- CreateIndex
CREATE INDEX "AssureSante_nom_idx" ON "AssureSante"("nom");

-- CreateIndex
CREATE INDEX "AssureSante_prenom_idx" ON "AssureSante"("prenom");

-- CreateIndex
CREATE INDEX "Facture_statut_idx" ON "Facture"("statut");

-- CreateIndex
CREATE INDEX "Facture_dateReception_idx" ON "Facture"("dateReception");

-- CreateIndex
CREATE INDEX "Facture_gestionnaireId_idx" ON "Facture"("gestionnaireId");

-- CreateIndex
CREATE INDEX "Facture_releveId_idx" ON "Facture"("releveId");

-- CreateIndex
CREATE INDEX "Facture_createdAt_idx" ON "Facture"("createdAt");

-- CreateIndex
CREATE INDEX "PriseEnCharge_assureId_idx" ON "PriseEnCharge"("assureId");

-- CreateIndex
CREATE INDEX "PriseEnCharge_date_idx" ON "PriseEnCharge"("date");

-- CreateIndex
CREATE INDEX "PriseEnCharge_statut_idx" ON "PriseEnCharge"("statut");

-- CreateIndex
CREATE INDEX "PriseEnCharge_prestataireId_idx" ON "PriseEnCharge"("prestataireId");

-- CreateIndex
CREATE INDEX "Remboursement_statut_idx" ON "Remboursement"("statut");

-- CreateIndex
CREATE INDEX "Remboursement_gestionnaireId_idx" ON "Remboursement"("gestionnaireId");

-- CreateIndex
CREATE INDEX "Remboursement_createdAt_idx" ON "Remboursement"("createdAt");
