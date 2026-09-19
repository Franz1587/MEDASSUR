import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreateClientDto {
  @IsString()
  nom: string;

  @IsIn(["Entreprise", "Particulier"])
  type: string;

  @IsString()
  pays: string;

  @IsString()
  contact: string;

  // Points retirés à la saisie (2026-08) — voir demande utilisateur :
  // "tous les numéros de l'application doivent s'écrire... après retrait
  // des '.' dans les numéros".
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  tel: string;

  @IsEmail()
  email: string;

  @IsIn(["Actif", "Inactif"])
  statut: string;

  // ── Coordonnées détaillées ──────────────────────────────────────────
  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  boitePostale?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telSecondaire?: string;

  // ── Personne morale ──────────────────────────────────────────────────
  @IsOptional()
  @IsIn(["Société privée", "Société publique", "Parapublique", "Administration publique", "Ministère", "Organisme", "Association", "Autre"])
  categorieMorale?: string;

  @IsOptional()
  @IsString()
  formeJuridique?: string;

  @IsOptional()
  @IsString()
  rccm?: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  secteurActivite?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  effectif?: number;

  @IsOptional()
  @IsString()
  representantNom?: string;

  @IsOptional()
  @IsString()
  representantFonction?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  representantTel?: string;

  @ValidateIf((o) => !!o.representantEmail)
  @IsEmail()
  representantEmail?: string;

  // ── Personne physique ────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  lieuNaissance?: string;

  @IsOptional()
  @IsIn(["M", "F"])
  sexe?: string;

  @IsOptional()
  @IsString()
  nationalite?: string;

  @IsOptional()
  @IsIn(["Célibataire", "Marié", "Mariée", "Divorcé", "Divorcée", "Veuf", "Veuve"])
  situationMatrimoniale?: string;

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  employeur?: string;

  @IsOptional()
  @IsIn(["CNI", "Passeport", "Permis de conduire", "Carte consulaire"])
  pieceIdentiteType?: string;

  @IsOptional()
  @IsString()
  pieceIdentiteNumero?: string;
}
