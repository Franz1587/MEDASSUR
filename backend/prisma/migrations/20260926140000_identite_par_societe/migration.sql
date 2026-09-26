-- Identité assurée cloisonnée par société (2026-09-26) — voir demande utilisateur :
-- "Chaque société gère ses données. En aucun moment l'application ne doit mélanger
-- les données... en aucun moment l'application doit les considérer comme étant les
-- mêmes données ou les données se rapportant à la même personne."
-- Les identités partagées entre plusieurs sociétés sont SÉPARÉES : la société qui a le
-- plus de fiches garde l'identité d'origine, chaque autre société reçoit sa propre
-- copie (id déterministe). Aucune fiche, aucun contrat, aucune prestation ne change.

ALTER TABLE "IdentiteAssuree" ADD COLUMN "societeId" TEXT;
ALTER TABLE "MatriculeAssuree" ADD COLUMN "societeId" TEXT;

-- Le matricule n'est plus unique globalement (la même valeur peut exister dans deux
-- sociétés pour deux personnes sans aucun lien) : unicité par société, posée à la fin.
DROP INDEX IF EXISTS "IdentiteAssuree_matricule_key";
DROP INDEX IF EXISTS "MatriculeAssuree_matricule_key";

CREATE TEMP TABLE _identite_societe AS
SELECT "identiteId", "societeId",
       row_number() OVER (PARTITION BY "identiteId" ORDER BY count(*) DESC, "societeId") AS rang
FROM "AssureSante"
WHERE "identiteId" IS NOT NULL
GROUP BY "identiteId", "societeId";

-- 1. Société propriétaire de l'identité d'origine.
UPDATE "IdentiteAssuree" i SET "societeId" = s."societeId"
FROM _identite_societe s WHERE s."identiteId" = i.id AND s.rang = 1;

-- 2. Une copie de l'identité pour chaque autre société.
INSERT INTO "IdentiteAssuree" (id, matricule, nom, prenom, "createdAt", "societeId")
SELECT 'ID-' || md5(i.id || ':' || coalesce(s."societeId", '')), i.matricule, i.nom, i.prenom, i."createdAt", s."societeId"
FROM _identite_societe s JOIN "IdentiteAssuree" i ON i.id = s."identiteId"
WHERE s.rang > 1;

-- 3. Les fiches de ces autres sociétés pointent vers leur propre copie.
UPDATE "AssureSante" a SET "identiteId" = 'ID-' || md5(a."identiteId" || ':' || coalesce(a."societeId", ''))
FROM _identite_societe s
WHERE s."identiteId" = a."identiteId" AND s."societeId" IS NOT DISTINCT FROM a."societeId" AND s.rang > 1;

-- 4. Matricules historiques rattachés à la société de leur identité...
UPDATE "MatriculeAssuree" m SET "societeId" = i."societeId"
FROM "IdentiteAssuree" i WHERE i.id = m."identiteId";

-- ... et tout matricule réellement porté par une fiche est connu dans SA société.
INSERT INTO "MatriculeAssuree" (id, matricule, "identiteId", statut, "createdAt", "societeId")
SELECT DISTINCT ON (a."societeId", trim(a.matricule))
       'MA-' || md5(coalesce(a."societeId", '') || ':' || trim(a.matricule)), trim(a.matricule), a."identiteId", 'Actuel', now(), a."societeId"
FROM "AssureSante" a
WHERE a."identiteId" IS NOT NULL AND trim(a.matricule) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "MatriculeAssuree" m
    WHERE m.matricule = trim(a.matricule) AND m."societeId" IS NOT DISTINCT FROM a."societeId"
  )
ORDER BY a."societeId", trim(a.matricule), a.id;

-- 5. Unicité du matricule PAR SOCIÉTÉ.
CREATE UNIQUE INDEX "IdentiteAssuree_societeId_matricule_key" ON "IdentiteAssuree"("societeId", "matricule");
CREATE UNIQUE INDEX "MatriculeAssuree_societeId_matricule_key" ON "MatriculeAssuree"("societeId", "matricule");
CREATE INDEX "IdentiteAssuree_societeId_idx" ON "IdentiteAssuree"("societeId");
CREATE INDEX "MatriculeAssuree_societeId_idx" ON "MatriculeAssuree"("societeId");

DROP TABLE _identite_societe;
