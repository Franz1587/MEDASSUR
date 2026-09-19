import { IsOptional, IsString } from "class-validator";

// Reprise d'antériorité — assurés et ayants droit (2026-08) — voir demande
// utilisateur : "il faut également prévoir l'import des... assurés et
// ayants droits. Harmonise les modèles existants pour ces rubriques."
// Harmonise l'ancien import "Population" (Contrat > onglet Population,
// fichier .csv point-virgule Windows-1252, voir sante.service.ts côté
// frontend) sur le MÊME patron .xlsx modèle → aperçu → confirmation que le
// reste de cet onglet Import : mêmes noms de colonnes clairs, plus de
// colonne "Photo" (déjà couverte par l'import Photos séparé). Le résultat
// de l'aperçu est ensuite confirmé via l'endpoint RÉEL déjà existant
// (POST /sante/assures/import, SanteService.importPopulation) — mêmes
// règles métier (rattachement familial AS→CJ/EF par l'ordre des lignes,
// dédoublonnage de matricule, vérification d'âge...), jamais réinventées
// ici.
export class ImportAssureRowDto {
  @IsOptional()
  @IsString()
  matricule?: string;

  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  sexe?: string;

  // AS (Assuré Principal) | CJ (Conjoint) | EF (Enfant) — facultatif,
  // déduit sinon de la position de la ligne (voir SanteService.importPopulation).
  @IsOptional()
  @IsString()
  typeAssure?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  // Actif | Inactif (2026-09) — voir demande utilisateur : "le jour où on
  // va importer la liste des participants et ayants droit, l'application
  // ajoutera simplement ceux qui ne sont pas là et mettra à jour le
  // statut." Facultatif ; vide ou non reconnu = ne touche jamais le statut
  // existant (voir SanteService.normaliserStatutImport).
  @IsOptional()
  @IsString()
  statut?: string;
}
