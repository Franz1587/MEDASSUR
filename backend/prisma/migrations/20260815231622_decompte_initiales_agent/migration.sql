-- Initiales de l'agent de saisie, figées à la création du décompte (voir
-- schema.prisma Decompte.initialesAgent, DocumentsService.obtenirOuCreerDecompte).
ALTER TABLE "Decompte" ADD COLUMN "initialesAgent" TEXT;
