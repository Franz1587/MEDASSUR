import { ArrayMinSize, IsArray, IsOptional, IsString } from "class-validator";

// Génère une LettreCheque à partir de bordereaux "Validé" déjà choisis à
// l'écran de recherche (voir ReglementComptableService.findEligibles) —
// bordereauIds vient de cette sélection, jamais recalculé côté backend.
export class GenererLettreChequeDto {
  @IsString()
  banqueId: string;

  @IsString()
  prestataireId: string;

  @IsOptional()
  @IsString()
  compagnieId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  bordereauIds: string[];
}
