import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Import en masse de contrats (2026-08) — reprise d'antériorité (voir
// demande utilisateur). `souscripteur`/`compagnie` acceptent soit
// l'identifiant technique (CLI-.../CMP-...), soit le nom exact — résolus
// côté service (voir ContratsService.resoudreClient/resoudreCompagnie).
// Champs minimaux : le détail (population par catégorie, garanties, taux)
// reste à compléter au cas par cas après import, via l'écran habituel.
export class ImportContratRowDto {
  @IsString()
  souscripteur: string;

  @IsString()
  compagnie: string;

  @IsOptional() @IsString() branche?: string; // Maladie | Assistance
  // Détecté automatiquement (2026-08 — voir demande utilisateur : "Maurel &
  // Prom... deux contrats répartis en notion de collège, cadres et
  // non-cadres") quand la colonne Souscripteur porte en réalité "Raison
  // sociale + libellé de collège/produit" en une seule chaîne — voir
  // ContratsService.resoudreClient. Reste éditable/complétable après import
  // comme n'importe quel autre contrat (voir Contrat.produit).
  @IsOptional() @IsString() produit?: string;
  @IsOptional() @IsString() dateDebut?: string;
  @IsOptional() @IsString() dateFin?: string;
  @IsOptional() @IsString() prime?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() periodicite?: string;
  // Reprise d'antériorité — si absent, auto-généré (voir
  // ContratsService.prochainNumeroPolice), ligne par ligne dans l'ordre du
  // fichier pour que deux lignes de la même compagnie ne se percutent pas.
  @IsOptional() @IsString() numeroPolice?: string;
}

export class ImportContratsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportContratRowDto)
  rows: ImportContratRowDto[];
}
