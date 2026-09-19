import { ArrayUnique, IsArray, IsInt, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class UpdatePlanAbonnementDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nom?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsOptional()
  @IsNumber()
  prixMensuel?: number;
}
