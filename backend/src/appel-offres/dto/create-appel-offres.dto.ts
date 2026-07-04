import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateAppelOffresDto {
  @IsString()
  prospectId: string;

  @IsString()
  clientNom: string;

  @IsString()
  cahierCharges: string;

  @IsString()
  garantiesDemandees: string;

  @IsOptional()
  @IsString()
  historiqueSinistres?: string;

  @IsNumber()
  @Min(0)
  projectionSP: number;

  @IsNumber()
  @Min(0)
  estimationPepm: number;

  @IsNumber()
  @Min(0)
  estimationFondsRoulement: number;
}
