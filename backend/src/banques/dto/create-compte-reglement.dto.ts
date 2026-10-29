import { IsOptional, IsString } from "class-validator";

export class CreateCompteReglementDto {
  @IsString()
  banqueId: string;

  @IsString()
  libelle: string;

  @IsOptional()
  @IsString()
  compteNumero?: string;
}
