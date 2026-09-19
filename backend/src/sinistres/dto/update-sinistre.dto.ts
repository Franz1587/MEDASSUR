import { IsIn, IsOptional } from "class-validator";

export class UpdateSinistreDto {
  @IsOptional()
  @IsIn(["Déclaré", "Expert. en cours", "Expertise", "Recours", "Remboursé", "Clôturé"])
  statut?: string;
}
