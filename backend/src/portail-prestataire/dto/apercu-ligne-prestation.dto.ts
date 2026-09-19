import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TYPES_PRESTATION } from "../../sante/dto/create-facture-ligne.dto";

// Aperçu de calcul, portail prestataire (2026-08) — voir demande
// utilisateur : "le prestataire doit pouvoir saisir son tarif (en frais
// réels) et l'application doit générer cela comme dans la saisie de
// facture côté assurance" — même calcul que FacturesController.apercuLigne
// (taux/part assurance en direct pendant la saisie), mais sans exiger une
// Facture déjà créée : le contrat est retrouvé depuis l'assuré identifié.
export class ApercuLignePrestationDto {
  @IsString()
  assureId: string;

  @IsIn(TYPES_PRESTATION)
  typePrestation: string;

  @IsNumber()
  @Min(0)
  montant: number;

  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  // Quantité (2026-08) — voir demande utilisateur : "la saisie de la
  // pharmacie repose sur trois critères : le médicament, le prix et la
  // quantité" : nécessaire ici pour que l'aperçu plafonne au bon montant
  // (prixDefaut × quantite, voir SanteService.calculerPartAssuranceLigne).
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantite?: number;
}
