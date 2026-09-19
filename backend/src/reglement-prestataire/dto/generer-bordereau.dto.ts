import { ArrayMinSize, IsArray, IsOptional, IsString } from "class-validator";

export class GenererBordereauDto {
  @IsString()
  prestataireId: string;

  // Factures sélectionnées depuis l'écran de recherche (voir
  // FacturesService.findEligiblesReglement) — remplace l'ancien
  // comportement qui batchait automatiquement TOUTES les prises en charge
  // non réglées du prestataire.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  factureIds: string[];

  // Optionnel — si absent, dérivée automatiquement des dates de réception
  // réelles des factures sélectionnées (voir ReglementPrestataireService.genererBordereau).
  @IsOptional()
  @IsString()
  periode?: string;

  // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur :
  // "lorsqu'on fait un règlement pour une structure médicale, que le
  // règlement se fasse à l'ordre d'un médecin intervenant dans la
  // structure". Optionnel — par défaut le règlement reste à l'ordre de la
  // structure (prestataireId) elle-même.
  @IsOptional()
  @IsString()
  medecinId?: string;
}
