import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateRemboursementDto {
  @IsOptional()
  @IsString()
  dateDeclaration?: string;

  @IsOptional()
  @IsIn(["En saisie", "Soumise"])
  statut?: string;
}
