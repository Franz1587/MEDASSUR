-- AlterTable: nouveaux champs (photo, lien de famille auto-référencé)
ALTER TABLE "AssureSante" ADD COLUMN     "familleId" TEXT,
ADD COLUMN     "photo" TEXT;

-- Migration de données : chaque AyantDroit devient sa propre ligne
-- AssureSante (familleId = l'AS racine), pour supporter photo/téléphone/
-- carte individuelle sur les conjoints et enfants — voir plan.
INSERT INTO "AssureSante" (
  id, nom, prenom, telephone, matricule, "contratId", beneficiaires, cotisation,
  statut, "dateNaissance", "statutMatrimonial", "numeroAssure", "qrCode",
  "statutCarte", "dateAffiliation", "dateRadiation", "motifRadiation", photo,
  "familleId", nationalite, sexe, "typeAssure", "periodeCouverture",
  "referenceContratSource", produit, adresse
)
SELECT
  'ASS-' || upper(substr(md5(ad.id || random()::text || '1'), 1, 6)),
  ad.nom,
  NULL,
  NULL,
  'MAT-' || upper(substr(md5(ad.id || random()::text || '2'), 1, 6)),
  root."contratId",
  0,
  0,
  ad.statut,
  ad."dateNaissance",
  NULL,
  'MED-SAN-' || upper(substr(md5(ad.id || random()::text || '3'), 1, 6)),
  'QR-MED-' || upper(substr(md5(ad.id || random()::text || '4'), 1, 6)),
  'Active',
  root."dateAffiliation",
  NULL, NULL, NULL,
  ad."assureId",
  NULL, NULL,
  CASE WHEN ad."lienParente" = 'Conjoint' THEN 'CJ' ELSE 'EF' END,
  NULL, NULL, NULL, NULL
FROM "AyantDroit" ad
JOIN "AssureSante" root ON root.id = ad."assureId";

-- DropForeignKey
ALTER TABLE "AyantDroit" DROP CONSTRAINT "AyantDroit_assureId_fkey";

-- DropTable
DROP TABLE "AyantDroit";

-- CreateIndex : matricule unique par contrat (nécessaire pour l'import différé)
CREATE UNIQUE INDEX "AssureSante_contratId_matricule_key" ON "AssureSante"("contratId", "matricule");

-- AddForeignKey : lien de famille auto-référencé
ALTER TABLE "AssureSante" ADD CONSTRAINT "AssureSante_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "AssureSante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalise les téléphones vides en NULL — un champ "" n'est pas "absent"
-- pour une contrainte d'unicité SQL (plusieurs '' collisionneraient sinon).
UPDATE "AssureSante" SET telephone = NULL WHERE telephone = '';

-- CreateIndex (partiel, non exprimable dans le DSL Prisma) : un numéro de
-- téléphone ne peut être porté que par une seule racine de famille.
CREATE UNIQUE INDEX "assure_telephone_famille_unique" ON "AssureSante" ("telephone") WHERE "familleId" IS NULL AND "telephone" IS NOT NULL;
