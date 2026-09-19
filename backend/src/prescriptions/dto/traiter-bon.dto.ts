import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class LigneATraiterDto {
  @IsString()
  @IsNotEmpty()
  ligneId: string;

  @IsNumber()
  @Min(0)
  montant: number;

  // Quantité (2026-08) — voir demande utilisateur : "les montants des
  // produits et les quantités doivent remonter [pré-remplis]... la
  // pharmacie peut changer le prix manuellement ou la quantité." Optionnel
  // — reprend la quantité prescrite (PrescriptionLigne.quantite) si absent.
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantite?: number;
}

// Traitement d'un bon (2026-08) — voir demande utilisateur : "traiter le
// bon d'examen"/"traiter l'ordonnance" — crée une VRAIE ligne de Facture
// par item retenu. Montant/quantité pré-remplis depuis le catalogue côté
// écran (voir TraiterBon.tsx) mais toujours modifiables manuellement par le
// prestataire traitant avant validation.
export class TraiterBonDto {
  @IsString()
  @IsNotEmpty()
  assureId: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneATraiterDto)
  lignes: LigneATraiterDto[];
}
