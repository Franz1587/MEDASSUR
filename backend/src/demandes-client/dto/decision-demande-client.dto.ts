import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

// Paramètres de tarification que le gestionnaire fixe à la décision, PAR
// bénéficiaire de la demande (2026-08) — volontairement absents côté
// client (voir CreateDemandeClientDto), une demande pouvant incorporer
// plusieurs personnes (assuré principal + ayants droit) qui n'ont pas
// forcément la même cotisation.
export class CotisationBeneficiaireDto {
  @IsString()
  beneficiaireId: string;

  @IsNumber() @Min(0) beneficiaires: number;
  @IsNumber() @Min(0) cotisation: number;
}

export class DecisionDemandeClientDto {
  @IsIn(["Accordée", "Refusée"])
  decision: string;

  @IsOptional() @IsString() motifRefus?: string;

  // Requis seulement pour accorder — date d'effet du mouvement réel (voir
  // MouvementsService.appliquerMouvement).
  @IsOptional() @IsString() dateEffet?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CotisationBeneficiaireDto)
  cotisations?: CotisationBeneficiaireDto[];
}
