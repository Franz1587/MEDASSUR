-- Traçabilité du Règlement (2026-09) — voir demande utilisateur : "il faut
-- que le système puisse retracer qui fait quoi dans l'application".
ALTER TABLE "BordereauReglement" ADD COLUMN     "creeParId" TEXT;
CREATE INDEX "BordereauReglement_creeParId_idx" ON "BordereauReglement"("creeParId");
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extension GED (2026-09, chantier en pause) — import factures/courriers
-- prestataires, archivage entrant/sortant, lecture IA (objet/résumé),
-- rapprochement facture prestataire. Purement additive : GedService
-- n'utilise pas encore ces colonnes, aucune requête existante n'est
-- affectée.
ALTER TABLE "GedDocument" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "demandeurId" TEXT,
ADD COLUMN     "factureId" TEXT,
ADD COLUMN     "fichier" TEXT,
ADD COLUMN     "montantExtrait" DECIMAL(18,2),
ADD COLUMN     "objet" TEXT,
ADD COLUMN     "prestataireId" TEXT,
ADD COLUMN     "referenceExtraite" TEXT,
ADD COLUMN     "resume" TEXT,
ADD COLUMN     "sens" TEXT NOT NULL DEFAULT 'Entrant',
ADD COLUMN     "statutTraitement" TEXT NOT NULL DEFAULT 'Sans objet';

CREATE INDEX "GedDocument_prestataireId_idx" ON "GedDocument"("prestataireId");
CREATE INDEX "GedDocument_factureId_idx" ON "GedDocument"("factureId");
CREATE INDEX "GedDocument_statutTraitement_idx" ON "GedDocument"("statutTraitement");

ALTER TABLE "GedDocument" ADD CONSTRAINT "GedDocument_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GedDocument" ADD CONSTRAINT "GedDocument_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GedDocument" ADD CONSTRAINT "GedDocument_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
