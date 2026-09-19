import { IsNumber, IsOptional, Min } from "class-validator";

export class UpdateParametresFacturationDto {
  // Voir demande utilisateur : "C'est un montant minimum de 5000 pour
  // assuré y compris les ayants droit" — un vrai plancher, jamais
  // contournable même par ce formulaire.
  @IsOptional()
  @IsNumber()
  @Min(5000)
  licenceAnnuellePersonne?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carteParPersonne?: number;
}
