import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Une ligne de population, telle que relue et éventuellement corrigée par
// l'utilisateur dans l'aperçu éditable (onglet Population) avant l'import
// définitif — matricule/nom/prénom/sexe/date de naissance/affiliation.
export class ImportedPersonRowDto {
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
  sexe?: string;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  typeAssure?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  // Statut (2026-09) — voir demande utilisateur : "le jour où on va
  // importer la liste des participants et ayants droit, l'application
  // ajoutera simplement ceux qui ne sont pas là et mettra à jour le statut
  // (ACTIF ou INACTIF)." Tolérant sur la valeur (voir
  // SanteService.normaliserStatutImport) — absent/non reconnu = ne touche
  // jamais le statut existant.
  @IsOptional()
  @IsString()
  statut?: string;

  // Nom de fichier photo (import différé) — résolu côté frontend contre les
  // fichiers du dossier sélectionné avec le tableur, puis uploadé après
  // import via POST /sante/assures/:id/photo.
  @IsOptional()
  @IsString()
  photo?: string;
}

export class ImportPopulationDto {
  @IsString()
  contratId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedPersonRowDto)
  rows: ImportedPersonRowDto[];
}
