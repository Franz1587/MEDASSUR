import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class TrancheQuittanceLibreDto {
  @IsNumber()
  @Min(1)
  montant: number;

  @IsString()
  dateEcheance: string;

  // Saisie manuelle (2026-08, mode "Personnalisée") — voir demande
  // utilisateur : "on doit pouvoir saisir librement, manuellement la prime
  // nette et les accessoires. Le calcul de la taxe de 8% et la prime TTC
  // doit se faire automatiquement." Quand ces deux champs sont fournis, le
  // backend les prend pour argent comptant et RECALCULE taxe/montant à
  // partir d'eux (jamais l'inverse — voir QuittancesLibresService.create) ;
  // sinon (mode "Égales"), primeNette/accessoires/taxe sont dérivés au
  // prorata des vraies valeurs du Contrat.
  @IsOptional()
  @IsNumber()
  @Min(0)
  primeNette?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accessoires?: number;
}

export class CreateQuittanceLibreDto {
  @IsString()
  contratId: string;

  @IsNumber()
  @Min(1)
  montantTotal: number;

  @IsString()
  dateCreation: string;

  // Tranches déjà calculées côté client (répartition égale par
  // trimestre/semestre, ou montants personnalisés) — voir demande
  // utilisateur : "échelonner le paiement... égale par le nombre de
  // trimestre, de semestre, ou n'importe quel montant selon la capacité
  // financière du client". Le backend valide juste que la somme est
  // cohérente (voir QuittancesLibresService.create), il ne recalcule rien.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TrancheQuittanceLibreDto)
  tranches: TrancheQuittanceLibreDto[];
}
