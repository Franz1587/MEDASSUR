import { ArrayUnique, IsArray, IsEmail, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export const CYCLES_FACTURATION = ["Mensuel", "Trimestriel", "Semestriel", "Annuel"] as const;

// Type de société (2026-09) — voir demande utilisateur : "il faut pouvoir
// dire le type de société qui va utiliser l'application : un courtier...
// une mutuelle... une compagnie d'assurance." Voir SocieteAssurance.type.
export const TYPES_SOCIETE = ["Courtier", "Mutuelle", "Compagnie"] as const;

// Création d'une société ET de son premier compte administrateur en une
// seule opération (2026-09) — voir demande utilisateur : "c'est lui qui
// crée les sociétés d'assurances qui vont utiliser l'application" — un
// Super Admin ne créerait jamais une société "vide", sans personne pour
// s'y connecter ensuite (voir SocietesService.create).
export class CreateSocieteDto {
  @IsString()
  @MinLength(2)
  nom: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  pays?: string;

  @IsOptional()
  @IsIn(TYPES_SOCIETE)
  type?: string;

  // Premier compte administrateur de la société — même rôle que
  // "administrateur" existant (toutes les fonctionnalités DE SA société,
  // voir src/auth/role-modules.ts), jamais super_admin.
  @IsString()
  @MinLength(2)
  adminNom: string;

  @IsEmail()
  adminEmail: string;

  // Abonnement (2026-09) — voir demande utilisateur : "il revient au super
  // Admin de donner accès à ces modules là en fonction du type
  // d'abonnement souscrit". planAbonnementId pré-remplit `modules` depuis
  // le plan choisi (voir SocietesService.create) ; `modules` peut aussi
  // être fourni directement pour un abonnement "sur mesure" sans plan
  // nommé — l'un des deux suffit, les deux ensemble : modules l'emporte.
  @IsOptional()
  @IsString()
  planAbonnementId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  modules?: string[];

  // Facturation (2026-09) — voir demande utilisateur : "un écran de
  // facturation afin de gérer... les frais d'installation et... le paiement
  // de licence d'utilisation par mois, trimestre, semestre, année (selon le
  // mode de souscription)". cycleFacturation par défaut "Mensuel" ; les
  // deux prix sont facultatifs (dérivés du plan choisi si absents, voir
  // FactureAbonnementService.calculerMontantPeriode).
  @IsOptional()
  @IsIn(CYCLES_FACTURATION)
  cycleFacturation?: string;

  @IsOptional()
  @IsNumber()
  prixAbonnement?: number;

  @IsOptional()
  @IsNumber()
  fraisInstallation?: number;

  // Identité de la carte/du matricule (2026-09) — voir demande
  // utilisateur : "il reviendra à chaque société à sa création de choisir
  // son modèle de carte", "le préfixe du numéro matricule." Le logo, lui,
  // s'envoie séparément (fichier) une fois la société créée — voir
  // SocietesController.uploadLogo.
  @IsOptional()
  @IsString()
  modeleCarteId?: string;

  @IsOptional()
  @IsString()
  prefixeMatricule?: string;
}
