import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";

// Délégation d'accès famille (2026-08) — voir demande utilisateur :
// "l'assuré principal doit pouvoir donner des droits à un des membres de la
// famille en décidant ce que ce dernier doit pouvoir voir. L'accès... doit
// pouvoir se faire par le numéro matricule, l'adresse mail... ou le numéro
// de téléphone". `identifiantValeur` est ignoré pour le canal "matricule"
// (AssureSante.matricule existe déjà, unique par contrat) — requis pour
// "email"/"telephone" (voir DelegationsFamilleService.accorder).
export class GrantDelegationDto {
  @IsIn(["matricule", "email", "telephone"])
  identifiantType: "matricule" | "email" | "telephone";

  @IsOptional()
  @IsString()
  identifiantValeur?: string;

  @IsString()
  @MinLength(6)
  motDePasse: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules: string[];
}
