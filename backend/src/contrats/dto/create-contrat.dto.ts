import { IsIn, IsNumber, IsString } from "class-validator";

export class CreateContratDto {
  @IsString()
  clientId: string;

  @IsString()
  compagnieId: string;

  @IsString()
  branche: string;

  @IsString()
  dateDebut: string;

  @IsString()
  dateFin: string;

  @IsNumber()
  prime: number;

  @IsIn(["Actif", "En renouvellement", "Expiré"])
  statut: string;
}
