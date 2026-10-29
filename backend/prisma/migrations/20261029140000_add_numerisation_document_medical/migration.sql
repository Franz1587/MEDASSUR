-- Numérisation intelligente (2026-10) — champs extraits par Ariana (vision Claude)
-- depuis le scan d'une Feuille de Soins ou Feuille d'Examens LA RUCHE.
ALTER TABLE "AccordPrealable" ADD COLUMN "medecinTraitant"    TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "texteCachetMedecin" TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "signaturePresente"  BOOLEAN;
ALTER TABLE "AccordPrealable" ADD COLUMN "casesCoches"        TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "documentNumerise"   TEXT;
