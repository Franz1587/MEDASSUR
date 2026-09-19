import { IsOptional, IsString } from "class-validator";
import { CreateFactureLigneDto } from "../../sante/dto/create-facture-ligne.dto";

// Étend la ligne de Facture avec un prestataire PAR LIGNE (2026-08) — voir
// demande utilisateur : le remboursement n'a pas de prestataire en
// en-tête (le paiement va à l'assuré/souscripteur), donc chaque ligne
// porte le sien, optionnel : soit recherché dans le réseau conventionné
// (prestataireId — même calcul de taux qu'une Facture), soit saisi
// librement si la structure n'est pas conventionnée (prestataireNom) —
// voir SanteService.creerLigneRemboursement.
export class CreateRemboursementLigneDto extends CreateFactureLigneDto {
  @IsOptional()
  @IsString()
  prestataireId?: string;

  @IsOptional()
  @IsString()
  prestataireNom?: string;
}
