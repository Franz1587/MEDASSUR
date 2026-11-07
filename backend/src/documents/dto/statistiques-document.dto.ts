import { IsArray, IsIn, IsObject, IsOptional, IsString } from "class-validator";
import type { AnalyseNarrative, RubriqueId } from "../../statistiques/statistiques.types";

// Rapport Statistiques (voir src/services/documents.service.ts
// openStatistiques) : du/au au format JJ/MM/AAAA. `analyse` est un objet
// libre produit par le service de statistiques (éditable à l'écran), validé
// seulement comme objet.
export class StatistiquesDocumentDto {
  @IsOptional()
  @IsString()
  du?: string;

  @IsOptional()
  @IsString()
  au?: string;

  @IsOptional()
  @IsIn(["pdf", "docx"])
  format?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rubriques?: RubriqueId[];

  @IsOptional()
  @IsObject()
  analyse?: AnalyseNarrative;
}
