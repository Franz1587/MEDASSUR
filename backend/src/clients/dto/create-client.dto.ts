import { IsEmail, IsIn, IsString } from "class-validator";

export class CreateClientDto {
  @IsString()
  nom: string;

  @IsIn(["Entreprise", "Particulier"])
  type: string;

  @IsString()
  pays: string;

  @IsString()
  contact: string;

  @IsString()
  tel: string;

  @IsEmail()
  email: string;

  @IsIn(["Actif", "Inactif"])
  statut: string;
}
