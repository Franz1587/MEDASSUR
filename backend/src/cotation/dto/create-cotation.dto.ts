import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsPositive, IsString, Min, ValidateNested } from "class-validator";

export class CotationGarantieLigneDto {
  @IsString() categorie: string;
  @IsString() libelle: string;
  @IsString() plafond: string;
  @IsOptional() @IsString() tauxStructurePrivee?: string;
  @IsOptional() @IsString() tauxStructurePublique?: string;
}

// Une Cotation = l'offre réelle d'une compagnie pour une branche (voir
// documents.service.ts renderCotationOffre) — pas un simulateur actuariel.
// montantTaxe/primeTTC sont calculés côté serveur, jamais reçus du client.
export class CreateCotationDto {
  @IsOptional() @IsString() appelOffresId?: string;
  @IsOptional() @IsString() compagnieId?: string;

  @IsIn(["Maladie", "Assistance"])
  branche: string;

  @IsString()
  clientNom: string;

  @IsNumber() @IsPositive()
  population: number;

  @IsString()
  territorialite: string;

  @IsOptional() @IsString() tauxCouvertureAmbulatoire?: string;
  @IsOptional() @IsString() tauxCouvertureHospitalisation?: string;
  @IsOptional() @IsString() exclusions?: string;
  @IsOptional() @IsString() clauseAjustement?: string;
  @IsOptional() @IsNumber() limiteAgeAdulte?: number;
  @IsOptional() @IsNumber() limiteAgeEnfant?: number;
  @IsOptional() @IsNumber() @Min(0) plafondFamilial?: number;
  @IsOptional() @IsString() conditionsFermete?: string;

  @IsNumber() @Min(0)
  primeNette: number;

  @IsOptional() @IsNumber() @Min(0) montantCartes?: number;
  @IsOptional() @IsNumber() @Min(0) montantAccessoires?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotationGarantieLigneDto)
  garanties: CotationGarantieLigneDto[];

  // Contenu « offre santé » (voir ../contenu-offre.ts), lu par ARIANA puis
  // relu/corrigé à l'écran ; validé à la génération, pas champ par champ ici.
  @IsOptional() @IsObject() contenuOffre?: Record<string, unknown>;
  @IsOptional() @IsString() documentSourceId?: string;
}
