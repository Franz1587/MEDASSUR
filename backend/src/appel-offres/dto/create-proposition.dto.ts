import { IsIn, IsNumber, IsPositive, IsString } from "class-validator";

export class CreatePropositionDto {
  @IsIn(["Essentiel", "Confort", "Premium"])
  niveau: string;

  @IsNumber()
  @IsPositive()
  primeProposee: number;

  @IsString()
  descriptionGaranties: string;
}
