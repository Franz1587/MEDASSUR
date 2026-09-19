import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { TYPES_PRESTATION } from "../../sante/dto/create-facture-ligne.dto";

// Une ligne d'acte de la prestation (2026-08) — mêmes champs que
// CreateFactureLigneDto (voir SanteService.creerLigneFacture), réutilisé tel
// quel côté service : la prestation saisie par le prestataire EST une vraie
// Facture/PriseEnCharge tiers payant, visible et traitable côté interne
// (voir demande utilisateur : "l'application doit vraiment être
// interopérable").
export class LignePrestationMedicaleDto {
  @IsOptional() @IsString() acteMedicalId?: string;
  @IsOptional() @IsString() lettreCleCode?: string;
  @IsOptional() @IsNumber() coefficient?: number;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsNumber() @Min(1) quantite?: number;

  // Code affection CNAMGS + nature de l'affection (2026-08) — voir demande
  // utilisateur : "on doit renseigner le code d'affection pour chaque
  // ligne de saisie de la facture" — obligatoire ici aussi (SanteService.
  // creerLigneFacture, exigerAffection par défaut), jamais affiché sur le
  // Décompte remis au tiers.
  @IsIn(["AffectionCourante", "AffectionLongue"])
  natureMaladie: string;

  @IsOptional() @IsString()
  codeAffection?: string;

  // Médecin assigné par l'accueil pour une Consultation (2026-09) — voir
  // demande utilisateur : "au niveau de l'accueil, le médecin doit avoir
  // été lié à la prestation consultation qui doit se faire".
  @IsOptional() @IsString() medecinId?: string;
}

// Nouvelle prestation (2026-08) — voir demande utilisateur, capture de
// référence "Création des données de la consultation" : un type de
// prestation UNIQUE pour la Facture entière (Ambulatoire/Hospitalisation/
// rubrique plafonnée, voir TYPES_PRESTATION), une ou plusieurs lignes
// d'actes (le "Prestation Médicale" principal + les entrées de "Liste des
// actes" de la maquette de référence).
export class CreatePrestationMedicaleDto {
  @IsString()
  assureId: string;

  @IsIn(TYPES_PRESTATION)
  typePrestation: string;

  @IsString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LignePrestationMedicaleDto)
  lignes: LignePrestationMedicaleDto[];
}
