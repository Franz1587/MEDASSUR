import { IsIn, IsNumber, IsString } from "class-validator";

export class CreateResiliationDto {
  @IsString()
  contratId: string;

  @IsString()
  motif: string;

  @IsString()
  dateEffet: string;

  @IsNumber()
  ristourne: number;

  @IsString()
  initiateur: string;

  @IsIn(["Demandée", "Validée", "Effective"])
  statut: string;
}
