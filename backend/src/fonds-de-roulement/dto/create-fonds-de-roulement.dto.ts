import { IsNumber, IsString, Min } from "class-validator";

export class CreateFondsDeRoulementDto {
  @IsString()
  contratId: string;

  @IsNumber()
  @Min(0)
  montantInitial: number;

  @IsNumber()
  @Min(0)
  seuilAlerte: number;

  @IsString()
  dateAlimentation: string;
}
