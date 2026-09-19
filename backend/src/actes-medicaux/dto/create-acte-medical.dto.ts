import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const CATEGORIES_GARANTIE = ["Consultation/Divers", "Hospitalisation", "Dentisterie", "Kinésithérapie & Cure thermale"];

export class CreateActeMedicalDto {
  @IsString()
  libelle: string;

  @IsString()
  famille: string;

  // Prix forfaitaire manuel — obligatoire seulement si l'acte n'est pas
  // codifié à la lettre clé (voir lettreCleCode ci-dessous), sinon
  // recalculé automatiquement (coefficient × LettreCle.valeurUnitaire),
  // voir ActesMedicauxService.create.
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixDefaut?: number;

  @IsOptional()
  @IsIn(CATEGORIES_GARANTIE)
  categorieGarantie?: string;

  // Codification à la lettre clé (2026-08) — paramétrée une fois ici, à la
  // création/modification de l'acte dans le catalogue (voir demande
  // utilisateur : "ce sont des actes qui sont paramétrés... le système
  // remonte son coefficient"). Coefficient obligatoire dès que
  // lettreCleCode est renseigné (vérifié dans ActesMedicauxService).
  @IsOptional()
  @IsString()
  lettreCleCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coefficient?: number;
}
