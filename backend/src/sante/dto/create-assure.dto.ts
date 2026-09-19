import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreateAssureDto {
  @IsString()
  nom: string;

  // Nom et prénom sont les DEUX seuls champs obligatoires pour un assuré
  // (2026-09) — voir demande utilisateur : "à part le nom et prénom pour
  // les assurés... il ne faut pas rendre les autres données obligatoire."
  @IsString()
  prenom: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephone?: string;

  // AS (Assuré Principal) par défaut si non fourni — cohérent avec le
  // formulaire "Nouvelle affiliation" existant qui ne demandait pas le type.
  @IsOptional()
  @IsIn(["AS", "CJ", "EF"])
  typeAssure?: string;

  // Enfant (EF) encore scolarisé — ouvre droit à
  // Contrat.limiteAgeEnfantScolarise au lieu de limiteAgeEnfant. Sans effet
  // pour AS/CJ. Voir age-limite.util.ts.
  @IsOptional()
  @IsBoolean()
  scolarise?: boolean;

  // Racine de famille à laquelle rattacher un CJ/EF ajouté depuis la fiche
  // d'un assuré principal existant — absent/null pour un AS.
  @IsOptional()
  @IsString()
  familleId?: string;

  // Confirme explicitement l'ajout à une famille déjà existante détectée
  // via le téléphone (voir SanteService.resolveTelephone) — sans ce flag,
  // un conflit renvoie 409 pour que l'utilisateur confirme d'abord.
  @IsOptional()
  @IsBoolean()
  confirmerFamilleExistante?: boolean;

  // Auto-généré par l'application si non fourni — l'utilisateur ne doit
  // pas avoir à inventer un numéro de matricule à la saisie manuelle.
  @IsOptional()
  @IsString()
  matricule?: string;

  @IsString()
  contratId: string;

  @IsInt()
  @Min(0)
  beneficiaires: number;

  @IsNumber()
  cotisation: number;

  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @IsOptional()
  @IsIn(["Célibataire", "Marié", "Divorcé", "Veuf"])
  statutMatrimonial?: string;

  @IsString()
  dateAffiliation: string;

  // Fiche détaillée individuelle — propres à chaque personne (contrairement
  // à `telephone`, porté uniquement par la racine de famille).
  @IsOptional()
  @IsIn(["M", "F"])
  sexe?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  nomJeuneFille?: string;

  @IsOptional()
  @IsString()
  lieuNaissance?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephoneFixe?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  autreNumero?: string;

  @IsOptional()
  @IsString()
  fax?: string;
}
