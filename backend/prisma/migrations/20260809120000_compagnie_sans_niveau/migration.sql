-- "Niveau" (Standard/Premium) n'a pas de sens en assurance — toutes les
-- compagnies se valent, ce n'est pas une donnée métier réelle.
ALTER TABLE "Compagnie" DROP COLUMN "niveau";
