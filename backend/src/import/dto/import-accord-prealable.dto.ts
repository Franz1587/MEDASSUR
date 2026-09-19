import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Reprise d'antériorité — prises en charge / ententes préalables (2026-08)
// — voir demande utilisateur : "importer... les prises en charge." Crée un
// AccordPrealable par ligne (voir ImportService.importerAccordsPrealables,
// qui délègue à AccordPrealableService.create — même moteur que la saisie
// Agent). Une décision déjà connue (Accordé/Refusé/Annulé) est appliquée
// directement après création, sans repasser par le workflow d'analyse
// (donnée déjà tranchée dans l'ancien système) — et si la colonne Décision
// est vide, la ligne passe AUTOMATIQUEMENT à Accordé (2026-08 — voir
// demande utilisateur : "pour les prises en charge récupérées, il faut
// passer automatiquement en Accordé") : une reprise d'antériorité
// représente par nature un dossier déjà traité, jamais laissé "En attente"
// d'une nouvelle analyse sauf mention explicite.
//
// Rattaché à UN contrat (2026-08 — voir demande utilisateur : import scopé
// à un contrat, matricule/nom résolus dans SA population uniquement — voir
// ImportService.resoudreAssureDuContrat).
export class ImportAccordPrealableRowDto {
  // Matricule OU nom (voir demande utilisateur : "les prises en charge
  // doivent s'importer par numéro matricule ou le nom de l'assuré ou
  // l'ayant droit") — au moins l'un des deux requis (vérifié en service).
  @IsOptional()
  @IsString()
  matricule?: string;

  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  // Rubrique de garantie — texte libre (voir CreateAccordPrealableDto).
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  dateDemande: string;

  @IsString()
  prestataire: string;

  @IsOptional()
  @IsString()
  montantDevis?: string;

  // En attente | Accordé | Refusé | Annulé (défaut En attente).
  @IsOptional()
  @IsString()
  decision?: string;

  @IsOptional()
  @IsString()
  montantAutorise?: string;

  @IsOptional()
  @IsString()
  dateDecision?: string;
}

export class ImportAccordsPrealablesDto {
  @IsString()
  contratId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportAccordPrealableRowDto)
  rows: ImportAccordPrealableRowDto[];
}
