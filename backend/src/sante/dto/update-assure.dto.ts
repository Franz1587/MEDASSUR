import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class UpdateAssureDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  // N'a d'effet que si la ligne éditée est une racine de famille (voir
  // SanteService.updateAssure) — un CJ/EF n'a pas son propre téléphone, donc
  // pas de conflit "à confirmer" possible ici (toujours "block" ou "ok").
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephone?: string;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsIn(["Célibataire", "Marié", "Divorcé", "Veuf"])
  statutMatrimonial?: string;

  @IsOptional()
  @IsIn(["M", "F"])
  sexe?: string;

  // Enfant (EF) encore scolarisé — voir age-limite.util.ts.
  @IsOptional()
  @IsBoolean()
  scolarise?: boolean;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  nomJeuneFille?: string;

  @IsOptional()
  @IsString()
  lieuNaissance?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephoneFixe?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  autreNumero?: string;

  @IsOptional()
  @IsString()
  fax?: string;
}
