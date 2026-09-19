import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreateProspectDto {
  @IsString()
  nom: string;

  @IsIn(["Entreprise", "Particulier"])
  type: string;

  @IsString()
  source: string;

  @IsIn(["Nouveau", "Qualifié", "Proposition envoyée", "Négociation", "Gagné", "Perdu"])
  etape: string;

  @IsNumber()
  valeurEstimee: number;

  @IsString()
  commercial: string;

  @IsString()
  dernierContact: string;

  @IsOptional()
  @IsNumber()
  effectifEstime?: number;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsString()
  historiqueAssurance?: string;

  @IsOptional()
  @IsString()
  zoneGeographique?: string;

  @IsOptional()
  @IsIn(["Faible", "Moyen", "Fort"])
  scoring?: string;

  // Personne ressource (2026-08) — voir demande utilisateur : "il faut
  // ajouter la personne ressource avec qui on échange, son contact, son
  // adresse mail".
  @IsOptional()
  @IsString()
  contactNom?: string;

  @IsOptional()
  @IsString()
  contactFonction?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  contactTelephone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  // Type de contrat envisagé (2026-08) — voir demande utilisateur :
  // "le type de contrat, maladie et assistance ou maladie simple".
  @IsOptional()
  @IsIn(["MaladieEtAssistance", "MaladieSeule"])
  typeContrat?: string;
}
