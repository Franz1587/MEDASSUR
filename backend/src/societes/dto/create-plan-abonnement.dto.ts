import { ArrayUnique, IsArray, IsInt, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePlanAbonnementDto {
  @IsString()
  @MinLength(2)
  nom: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  modules: string[];

  @IsOptional()
  @IsInt()
  ordre?: number;

  // Tarif de référence mensuel — voir demande utilisateur : "le paiement de
  // licence d'utilisation par mois, trimestre, semestre, années".
  @IsOptional()
  @IsNumber()
  prixMensuel?: number;
}
