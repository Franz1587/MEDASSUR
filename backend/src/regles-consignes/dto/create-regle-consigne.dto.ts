import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRegleConsigneDto {
  @IsString()
  @MinLength(1)
  titre!: string;

  @IsString()
  @MinLength(1)
  contenu!: string;

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
