import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Import en masse de souscripteurs (2026-08) — voir demande utilisateur :
// "créer 50, 100, 1000 contrats/souscripteurs" sans saisie unitaire.
// Champs permissifs (comme ImportedPersonRowDto/import-population.dto.ts) :
// seul `nom` est réellement requis, le reste est validé métier en service
// (email/tel dupliqués signalés ligne par ligne, jamais bloquant pour tout
// le fichier).
export class ImportClientRowDto {
  @IsString()
  nom: string;

  @IsOptional() @IsString() type?: string; // Entreprise | Particulier
  @IsOptional() @IsString() pays?: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() tel?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() boitePostale?: string;
  @IsOptional() @IsString() categorieMorale?: string;
  @IsOptional() @IsString() formeJuridique?: string;
  @IsOptional() @IsString() rccm?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() secteurActivite?: string;
  @IsOptional() @IsString() representantNom?: string;
  @IsOptional() @IsString() representantFonction?: string;
  @IsOptional() @IsString() representantTel?: string;
  @IsOptional() @IsString() representantEmail?: string;
  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsString() dateNaissance?: string;
  @IsOptional() @IsString() lieuNaissance?: string;
  @IsOptional() @IsString() sexe?: string;
  @IsOptional() @IsString() nationalite?: string;
  @IsOptional() @IsString() profession?: string;
  @IsOptional() @IsString() pieceIdentiteType?: string;
  @IsOptional() @IsString() pieceIdentiteNumero?: string;
}

export class ImportClientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportClientRowDto)
  rows: ImportClientRowDto[];
}
