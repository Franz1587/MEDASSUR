import { Transform, Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { normaliserTelephone } from "../../lib/telephone.util";

// Une personne à incorporer (2026-08) — voir demande utilisateur : "on doit
// pouvoir choisir la famille s'il s'agit d'un conjoint ou d'un enfant. Mais
// s'il s'agit d'un assuré principal il faut rendre possible aussi l'ajout
// de ses ayants droit". familleId référence un AssureSante EXISTANT sur le
// contrat ; familleRefLocale=true référence plutôt l'assuré principal ajouté
// dans CETTE MÊME demande (résolu à l'approbation, voir
// DemandesClientService.decider) — les deux sont mutuellement exclusifs.
export class BeneficiaireDemandeClientDto {
  @IsString()
  nom: string;

  @IsOptional() @IsString() prenom?: string;
  @IsOptional() @IsString() dateNaissance?: string;

  @IsIn(["AS", "CJ", "EF"])
  typeAssure: string;

  @IsOptional() @IsString() sexe?: string;
  @IsOptional() @IsString() @Transform(({ value }) => normaliserTelephone(value)) telephone?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsBoolean() scolarise?: boolean;

  @IsOptional() @IsString() familleId?: string;
  @IsOptional() @IsBoolean() familleRefLocale?: boolean;
}

// Demande de mouvement de population initiée depuis le portail client
// (2026-08) — voir demande utilisateur : "initier des opérations comme des
// incorporations et retrait, mais la validation finale revient au
// gestionnaire côté assurance".
export class CreateDemandeClientDto {
  @IsString()
  contratId: string;

  @IsIn(["Incorporation", "Retrait"])
  type: string;

  @IsString()
  dateDemande: string;

  // ── Incorporation — une ou plusieurs personnes (assuré principal +
  // éventuels ayants droit) ────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BeneficiaireDemandeClientDto)
  beneficiaires?: BeneficiaireDemandeClientDto[];

  // ── Retrait ───────────────────────────────────────────────────────────
  @IsOptional() @IsString() assureId?: string;
  @IsOptional() @IsString() motifRetrait?: string;
}
