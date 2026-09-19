import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Reprise d'antériorité — règlements prestataires (2026-08) — voir demande
// utilisateur : "importer... les règlements qui ont été faits." Crée des
// BordereauReglement d'ANTÉRIORITÉ (en-tête seul, sans rattachement à des
// PriseEnCharge — la reconciliation ligne à ligne avec un ancien logiciel
// n'a pas de sens, deux systèmes n'ont jamais les mêmes identifiants
// internes) : voir ImportService.importerReglements. Le statut par défaut
// est "Payé" (donnée déjà soldée dans l'ancien système), pas "Reçu" comme
// pour un règlement créé en direct par ReglementPrestataireService.
export class ImportReglementRowDto {
  @IsString()
  prestataire: string;

  @IsString()
  periode: string;

  @IsString()
  montantTotal: string;

  @IsOptional()
  @IsString()
  montantValide?: string;

  @IsOptional()
  @IsString()
  nbPrisesEnCharge?: string;

  // Reçu | En validation | Validé | Payé | Rejeté (défaut Payé).
  @IsOptional()
  @IsString()
  statut?: string;

  @IsString()
  dateReception: string;

  @IsOptional()
  @IsString()
  datePaiement?: string;

  @IsOptional()
  @IsString()
  referenceVirement?: string;
}

export class ImportReglementsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportReglementRowDto)
  rows: ImportReglementRowDto[];
}
