import { IsArray, IsString } from "class-validator";

// Bascule de tout ou partie de la population d'un contrat vers un autre —
// voir MouvementsService.basculerPopulationVersContrat, qui complète
// automatiquement toute famille sélectionnée partiellement.
export class BasculerPopulationDto {
  @IsString()
  contratDestinationId: string;

  @IsArray()
  @IsString({ each: true })
  assureIds: string[];

  @IsString()
  dateEffet: string;
}
