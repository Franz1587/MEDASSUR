import { IsIn, IsNumber, IsString, Min } from "class-validator";

export class CreateFluxDto {
  @IsString()
  date: string;

  @IsString()
  libelle: string;

  @IsIn(["Encaissement", "Décaissement"])
  type: string;

  @IsNumber()
  @Min(0.01)
  montant: number;

  @IsString()
  compteId: string;
}
