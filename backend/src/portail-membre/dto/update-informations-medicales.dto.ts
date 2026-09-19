import { IsArray, IsOptional, IsString } from "class-validator";

// Informations médicales d'urgence (2026-09) — voir demande utilisateur :
// enrichir l'E-carnet Santé avec une fiche d'urgence (jamais nommée avec un
// nom de produit concurrent, ni ici ni nulle part sur la plateforme — voir
// demande utilisateur explicite). Auto-déclaratif — jamais un diagnostic ni une donnée déduite
// par l'application, uniquement ce que la personne saisit elle-même sur
// SON PROPRE dossier (voir PortailMembreController.assureSanteIdDe, jamais
// un id transmis par le client).
export class UpdateInformationsMedicalesDto {
  @IsOptional() @IsString() groupeSanguin?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allergies?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) antecedentsMedicaux?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) traitementsEnCours?: string[];
  @IsOptional() @IsString() contactUrgenceNom?: string;
  @IsOptional() @IsString() contactUrgenceTelephone?: string;
}
