import { ArrayUnique, IsArray, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { CYCLES_FACTURATION, TYPES_SOCIETE } from "./create-societe.dto";

export class UpdateSocieteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nom?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  pays?: string;

  @IsOptional()
  @IsIn(TYPES_SOCIETE)
  type?: string;

  // Abonnement (2026-09) — voir CreateSocieteDto. planAbonnementId=null
  // détache explicitement le plan (abonnement "sur mesure") sans effacer
  // `modules`. Voir SocietesService.update.
  @IsOptional()
  @IsString()
  planAbonnementId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  modules?: string[];

  @IsOptional()
  @IsIn(CYCLES_FACTURATION)
  cycleFacturation?: string;

  @IsOptional()
  @IsNumber()
  prixAbonnement?: number;

  @IsOptional()
  @IsNumber()
  fraisInstallation?: number;
}
