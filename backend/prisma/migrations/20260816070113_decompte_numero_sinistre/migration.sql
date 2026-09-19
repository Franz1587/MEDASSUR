-- Compteur atomique pour "N° Sinistre" — auto-généré par l'application,
-- global sur une année, tous contrats confondus (voir DocumentsService.
-- obtenirOuCreerDecompte).
CREATE SEQUENCE "sinistre_numero_seq" START 1;

ALTER TABLE "Decompte" ADD COLUMN "numeroSinistre" TEXT;

UPDATE "Decompte"
SET "numeroSinistre" = lpad(nextval('sinistre_numero_seq')::text, 6, '0') || ' / ' || split_part("dateEmission", '/', 3)
WHERE "numeroSinistre" IS NULL;

ALTER TABLE "Decompte" ALTER COLUMN "numeroSinistre" SET NOT NULL;
