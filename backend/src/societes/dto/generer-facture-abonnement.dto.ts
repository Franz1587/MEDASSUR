import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type as TransformType } from "class-transformer";
import { LigneFactureDto } from "./ligne-facture.dto";

// Formulaire de facturation (2026-09) — voir demande utilisateur : "revoir
// le formulaire de facturation... l'enrichir comme un vrai formulaire
// dédié à la facturation... TVA (18%), TPS (9.5%), CSS (1%), on doit
// pouvoir sélectionner les taxes à activer... plusieurs lignes." Chaque
// taxe est un choix explicite (booléen "appliquer" + taux éditable, jamais
// un défaut implicite) ; `lignes` omis = la facture est composée
// automatiquement par le serveur selon `type` (voir FactureAbonnementService.
// genererFacture) — fourni = repris tel quel, pour un "vrai formulaire"
// multi-lignes entièrement libre (type "Autre" notamment).
export class GenererFactureAbonnementDto {
  @IsOptional()
  @IsIn(["Installation", "Abonnement", "Cartes", "Autre"])
  type?: string;

  // Type "Cartes" uniquement — surcharge le nombre de personnes facturées
  // (voir demande utilisateur : "on facture la carte par assuré et ayant
  // droit"). Omis = population ACTIVE actuelle de la société (voir
  // FactureAbonnementService.compterPersonnes) ; utile pour ne facturer
  // que les cartes NOUVELLEMENT émises plutôt que toute la population.
  @IsOptional()
  @IsNumber()
  nombrePersonnes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @TransformType(() => LigneFactureDto)
  lignes?: LigneFactureDto[];

  @IsOptional()
  @IsString()
  periodeDebut?: string;

  @IsOptional()
  @IsString()
  periodeFin?: string;

  @IsOptional()
  @IsString()
  dateEcheance?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  appliquerTva?: boolean;

  @IsOptional()
  @IsNumber()
  tauxTva?: number;

  @IsOptional()
  @IsBoolean()
  appliquerTps?: boolean;

  @IsOptional()
  @IsNumber()
  tauxTps?: number;

  @IsOptional()
  @IsBoolean()
  appliquerCss?: boolean;

  @IsOptional()
  @IsNumber()
  tauxCss?: number;
}
