import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

// Ligne de Facture Production (2026-08) — voir schema.prisma
// FactureProductionLigne. Libellé + période facultative (affichés "Prime du
// DD/MM/AAAA au DD/MM/AAAA" sur le PDF, voir modèle NSIA) + montant.
export class FactureProductionLigneDto {
  @IsString()
  libelle: string;

  @IsOptional() @IsString() periodeDebut?: string;
  @IsOptional() @IsString() periodeFin?: string;

  @IsNumber()
  @Min(0)
  montant: number;

  // Mouvement d'origine (2026-08) — voir schema.prisma FactureProductionLigne.
  @IsOptional() @IsString() contratId?: string;
  @IsOptional() @IsString() avenantId?: string;
}

export class CreateFactureProductionDto {
  @IsString()
  compagnieId: string;

  @IsString()
  clientId: string;

  @IsOptional() @IsString() contratId?: string;

  @IsString()
  dateEmission: string;

  @IsOptional() @IsString() lieuEmission?: string;
  @IsOptional() @IsString() referenceBonReception?: string;
  @IsOptional() @IsString() referenceBonCommande?: string;

  @IsString()
  objet: string;

  // "Paiement intégral" | "1ère échéance" | "2ème échéance" | "3ème
  // échéance" | "4ème échéance" — voir schema.prisma FactureProduction.
  @IsOptional() @IsString() typePaiement?: string;

  @IsOptional() @IsString() notePaiement?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FactureProductionLigneDto)
  lignes: FactureProductionLigneDto[];
}
