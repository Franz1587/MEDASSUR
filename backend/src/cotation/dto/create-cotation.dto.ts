import { IsIn, IsNumber, IsPositive, IsString, Min } from "class-validator";

export class CreateCotationDto {
  @IsString()
  clientNom: string;

  @IsNumber()
  @IsPositive()
  agePopulationMoyen: number;

  @IsString()
  sexeRatio: string;

  @IsNumber()
  @Min(0)
  historiqueSinistres: number; // ratio S/P historique, en %

  @IsIn(["Essentiel", "Confort", "Premium"])
  niveauGaranties: string;

  @IsString()
  territorialite: string;

  @IsNumber()
  @Min(0)
  stopLoss: number;

  @IsNumber()
  @IsPositive()
  primePure: number;

  @IsNumber()
  @IsPositive()
  effectifAssure: number;
}
