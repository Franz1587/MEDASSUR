import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class EnvoyerCommunicationDto {
  @IsIn(["Email", "SMS", "WhatsApp"])
  canal: string;

  @IsIn(["Prestataire", "Client", "AssureSante", "Prospect", "Libre"])
  destinataireType: string;

  @IsOptional()
  @IsString()
  destinataireId?: string;

  @IsString()
  destinataireNom: string;

  @IsString()
  @MinLength(3)
  destinataireContact: string;

  @IsOptional()
  @IsString()
  objet?: string;

  @IsString()
  @MinLength(1)
  contenu: string;
}
