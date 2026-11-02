import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreatePrescriptionLigneDto } from "./create-prescription.dto";

// Ordonnance / bon d'examen papier converti en électronique par l'assuré
// (2026-11), après relecture des lignes lues par ARIANA.
export class ValiderBonNumeriseDto {
  @IsString()
  assureId: string;

  @IsOptional()
  @IsString()
  prescripteurNom?: string;

  @IsOptional()
  @IsString()
  titrePrescripteur?: string;

  @IsOptional()
  @IsString()
  codePraticien?: string;

  @IsOptional()
  @IsString()
  structureNom?: string;

  @IsOptional()
  @IsString()
  codeEtablissement?: string;

  @IsOptional()
  @IsString()
  dateOrdonnance?: string;

  @IsOptional()
  @IsString()
  codeAffection?: string;

  // Bounding box du cachet/signature du médecin, lu par ARIANA sur l'original
  // photographié (fractions 0-1 de la largeur/hauteur de l'image).
  @IsOptional() @IsBoolean() cachetVisible?: boolean;
  @IsOptional() @IsNumber() cachetX?: number;
  @IsOptional() @IsNumber() cachetY?: number;
  @IsOptional() @IsNumber() cachetW?: number;
  @IsOptional() @IsNumber() cachetH?: number;

  @IsOptional()
  @IsString()
  indicationsLibres?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionLigneDto)
  lignes: CreatePrescriptionLigneDto[];
}
