import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Import global de factures — "tous contrats confondus" (2026-08) — voir
// demande utilisateur : "il faut aussi une option de fichier d'import de
// tous les contrats confondus. Dans celui-ci il faut juste faire remonter
// le numéro matricule et l'application fera un matching avec les
// matricules de la population globale de tous les contrats." Contrairement
// à l'import scopé à un contrat (voir import-facture.dto.ts), le matricule
// est ICI le SEUL identifiant — jamais de repli par nom (une recherche par
// nom sur toute la base, sans le périmètre d'un contrat, serait bien trop
// ambiguë). Une ligne dont le matricule ne correspond à AUCUN assuré n'est
// jamais rejetée : elle est mise en file d'attente (voir
// ImportService.importerFacturesGlobal / FactureEnAttente) pour être
// rejouée automatiquement dès que sa population est chargée.
export class ImportFactureGlobalRowDto {
  @IsString()
  matricule: string;

  @IsString()
  prestataire: string;

  @IsString()
  referenceFacture: string;

  @IsString()
  dateReception: string;

  @IsString()
  typePrestation: string;

  @IsString()
  datePrestation: string;

  @IsString()
  acteMedical: string;

  @IsString()
  montant: string;

  @IsOptional() @IsString() quantite?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() motifRejet?: string;
}

export class ImportFacturesGlobalDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportFactureGlobalRowDto)
  rows: ImportFactureGlobalRowDto[];
}
