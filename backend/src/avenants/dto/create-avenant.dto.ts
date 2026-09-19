import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Tout mouvement sur un contrat en cours d'exercice est un avenant — 6
// types possibles (2026-08), Renouvellement et Résiliation compris (voir le
// commentaire sur le modèle Avenant du schéma). Incorporation/Retrait sont
// normalement créés par l'écran "Gérer les assurés" ; Renouvellement/
// Résiliation par leurs écrans dédiés (qui appellent ce même service) ; ce
// formulaire sert directement pour Ajustement/Régularisation de Prime.
export class CreateAvenantDto {
  @IsString()
  contratId: string;

  @IsIn(["Renouvellement", "Incorporation", "Retrait", "Ajustement de Prime", "Régularisation de Prime", "Résiliation", "Changement de Compagnie"])
  type: string;

  @IsString()
  description: string;

  @IsNumber()
  primeAvant: number;

  @IsNumber()
  primeApres: number;

  @IsString()
  dateEffet: string;

  // Renouvellement uniquement : nouvelle date d'échéance du contrat.
  @IsOptional()
  @IsString()
  dateFin?: string;

  @IsIn(["Brouillon", "Validé", "Appliqué", "Relancé", "Perdu", "À renouveler"])
  statut: string;

  // ── Calcul de la prime — mêmes champs que CreateContratDto ────────────
  // Renseignés pour Renouvellement / Ajustement de Prime / Régularisation
  // de Prime : la fenêtre "Créer un avenant" utilise le même formulaire que
  // la création de contrat (voir withComputedPrime, prime.util.ts).
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

  // Renouvellement — indicateur de sinistralité affiché sur la worklist.
  @IsOptional()
  @IsString()
  sinistralite?: string;

  // ── Résiliation ────────────────────────────────────────────────────────
  @IsOptional() @IsString() motif?: string;
  @IsOptional() @IsNumber() @Min(0) ristourne?: number;
  @IsOptional() @IsString() initiateur?: string;

  // ── Changement de Compagnie ─────────────────────────────────────────────
  @IsOptional() @IsString() compagnieAvantId?: string;
  @IsOptional() @IsString() compagnieApresId?: string;
}
