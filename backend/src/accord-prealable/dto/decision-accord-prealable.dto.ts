import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class DecisionAccordPrealableDto {
  @IsOptional()
  @IsIn(["En cours", "Validée", "Rejetée"])
  statutAnalyseMedicale?: string;

  @IsOptional()
  @IsIn(["En cours", "Validée", "Rejetée"])
  statutValidationFinanciere?: string;

  @IsOptional()
  @IsIn(["Accordé", "Refusé", "En attente"])
  decision?: string;

  @IsOptional()
  @IsNumber()
  montantAutorise?: number;

  @IsOptional()
  @IsString()
  dateDecision?: string;
}
