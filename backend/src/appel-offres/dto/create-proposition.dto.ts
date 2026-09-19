import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class CreatePropositionDto {
  // Libellé libre (ex. "Essentiel", "Confort", "Premium", ou un nom
  // composé) — une proposition n'est plus limitée aux 3 formules figées
  // puisqu'elle peut désormais combiner librement plusieurs cotations.
  @IsString()
  niveau: string;

  @IsNumber()
  @IsPositive()
  primeProposee: number;

  @IsString()
  descriptionGaranties: string;

  // Cotations (offres compagnies) regroupées dans cette proposition — une
  // proposition peut combiner les offres d'une ou plusieurs compagnies.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cotationIds?: string[];
}
