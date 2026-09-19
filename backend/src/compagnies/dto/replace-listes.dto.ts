import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

// "Remplace toute la liste" — même pattern que ReplaceGarantiesDto
// (backend/src/contrats/dto/replace-garanties.dto.ts) : le client envoie
// systématiquement la liste complète à jour, le serveur supprime puis
// recrée en une transaction, plutôt qu'un CRUD ligne par ligne.

export class AccessoireTrancheDto {
  @IsNumber() borneMin: number;
  @IsOptional() @IsNumber() borneMax?: number;
  @IsNumber() montant: number;
}
export class ReplaceAccessoiresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessoireTrancheDto)
  tranches: AccessoireTrancheDto[];
}

export class SurprimeAgeDto {
  @IsNumber() ageMin: number;
  @IsOptional() @IsNumber() ageMax?: number;
  @IsNumber() tauxPourcent: number;
}
export class ReplaceSurprimesAgeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurprimeAgeDto)
  tranches: SurprimeAgeDto[];
}

export class ClauseAjustementDto {
  @IsNumber() spMin: number;
  @IsOptional() @IsNumber() spMax?: number;
  @IsNumber() tauxAjustement: number;
  @IsOptional() @IsString() description?: string;
}
export class ReplaceClausesAjustementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClauseAjustementDto)
  clauses: ClauseAjustementDto[];
}

export class TerritorialiteDto {
  @IsString() libelle: string;
}
export class ReplaceTerritorialitesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TerritorialiteDto)
  libelles: TerritorialiteDto[];
}

export class TauxCouvertureDto {
  @IsString() tauxAmbulatoire: string;
  @IsString() tauxHospitalisation: string;
}
export class ReplaceTauxCouvertureDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TauxCouvertureDto)
  taux: TauxCouvertureDto[];
}

// Tableau de garanties/plafonds propre à cette compagnie (2026-08) — tel
// que transmis dans ses offres (voir Cotation/CotationGarantieLigne, qui
// s'en pré-remplit). Remplace une seule branche à la fois (Maladie OU
// Assistance) pour ne jamais effacer l'autre en éditant l'une des deux.
export class GarantieCatalogueLigneDto {
  @IsString() categorie: string;
  @IsString() libelle: string;
  @IsOptional() @IsNumber() tauxAssureDefaut?: number;
  @IsOptional() @IsNumber() tauxAyantsDroitDefaut?: number;
  @IsOptional() @IsString() plafondDefaut?: string;
  @IsOptional() @IsString() tauxStructurePriveeDefaut?: string;
  @IsOptional() @IsString() tauxStructurePubliqueDefaut?: string;
}
export class ReplaceGarantiesCatalogueDto {
  @IsIn(["Maladie", "Assistance"])
  branche: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GarantieCatalogueLigneDto)
  lignes: GarantieCatalogueLigneDto[];
}
