import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateRubriqueFacturationDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "Le code ne peut contenir que des minuscules, chiffres et tirets." })
  code: string;

  @IsString()
  @MinLength(1)
  libelle: string;

  @IsOptional()
  @IsNumber()
  prixDefaut?: number;

  @IsOptional()
  @IsInt()
  ordre?: number;
}

export class UpdateRubriqueFacturationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  libelle?: string;

  @IsOptional()
  @IsNumber()
  prixDefaut?: number;

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
