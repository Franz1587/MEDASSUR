import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreateMedecinDto {
  @IsString()
  @MinLength(1)
  nom: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsString()
  specialite?: string;

  // Numéro à l'ordre des médecins (2026-08) — voir demande utilisateur.
  @IsOptional()
  @IsString()
  codePraticien?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Structures liées à la création (2026-08) — voir demande utilisateur :
  // "puis les lier à une clinique, hôpital..." — facultatif, des liens
  // peuvent aussi s'ajouter/se retirer ensuite (voir MedecinsController
  // lierStructure/delierStructure).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prestataireIds?: string[];
}
