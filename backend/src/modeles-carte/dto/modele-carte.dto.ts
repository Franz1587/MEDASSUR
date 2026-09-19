import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateModeleCarteDto {
  @IsString()
  @MinLength(2)
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateModeleCarteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nom?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
