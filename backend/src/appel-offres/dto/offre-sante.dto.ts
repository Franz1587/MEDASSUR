import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AnalyserDocumentDto {
  @IsOptional() @IsIn(["auto", "grille", "colonnes"]) style?: string;
  @IsOptional() @IsNumber() @Min(0) tarifCarte?: number;
}

// Voir ParametresOffre (../../cotation/contenu-offre.ts).
export class ParametresOffreDto {
  @IsString() titreDocument: string;
  @IsString() exercice: string;
  @IsString() date: string;
  @IsArray() @IsString({ each: true }) redacteur: string[];
  @IsString() chargeClientele: string;
  @IsString() telephone: string;
  @IsString() telecopie: string;
  @IsString() adresseAssure: string;
  @IsString() periode: string;
  @IsString() duree: string;
  @IsString() mentionSignature: string;
  @IsString() lieuSignature: string;
  @IsOptional() @IsArray() @IsString({ each: true }) ordreCompagnies?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) cotationIdsExclues?: string[];
  @IsBoolean() pagesPresentation: boolean;
  @IsBoolean() annexeReseau: boolean;
}
