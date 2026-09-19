import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateHonorairesDto {
  @IsString()
  contratId: string;

  @IsString()
  periode: string;

  @IsNumber()
  @Min(0)
  montantSinistres: number;

  @IsNumber()
  @Min(0)
  tauxHonoraires: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plafond?: number;
}
