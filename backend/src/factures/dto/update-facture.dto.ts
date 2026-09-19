import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateFactureDto {
  @IsOptional()
  @IsString()
  dateReception?: string;

  @IsOptional()
  @IsString()
  referenceFacture?: string;

  @IsOptional()
  @IsIn(["En saisie", "Soumise"])
  statut?: string;
}
