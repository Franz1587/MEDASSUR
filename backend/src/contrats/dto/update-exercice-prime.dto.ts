import { IsNumber, IsOptional, Min } from "class-validator";

// Saisie de la prime d'un exercice PASSÉ (2026-09) — voir demande
// utilisateur : "dans le cadre de la récupération des données, on puisse
// aller saisir les primes sur les anciennes périodes afin de rendre
// possible le calcul du S/P à ces périodes... renseigner la prime par
// personne et les accessoires et l'outil calculera la prime nette totale."
// Même détail (population par catégorie × prime unitaire + ajustements +
// accessoires) que la saisie de prime du contrat lui-même (voir
// CreateContratDto), réutilisé tel quel par ContratsService.mettreAJourPrimeExercice
// via le même moteur de calcul (prime.util.ts withComputedPrime), mais
// attaché à CET exercice précis plutôt qu'à l'état courant du contrat.
export class UpdateExercicePrimeDto {
  @IsOptional() @IsNumber() @Min(0) nombreAssuresPrincipaux?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireAssurePrincipal?: number;
  @IsOptional() @IsNumber() @Min(0) nombreConjoints?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireConjoint?: number;
  @IsOptional() @IsNumber() @Min(0) nombreEnfants?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireEnfant?: number;
  @IsOptional() @IsNumber() @Min(0) nombreCouples?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireCouple?: number;

  @IsOptional() @IsNumber() tauxMinoMajoration?: number;
  @IsOptional() @IsNumber() tauxReductionCommerciale?: number;
  @IsOptional() @IsNumber() @Min(0) montantAccessoires?: number;
  @IsOptional() @IsNumber() tauxCommission?: number;
}
