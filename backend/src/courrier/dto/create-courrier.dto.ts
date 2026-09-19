import { IsOptional, IsString } from "class-validator";

// Courrier Maladie (2026-08) — éditeur façon Word, voir demande utilisateur.
// La référence n'est PAS saisie ici : générée par CourrierService.create
// (initiales de l'agent connecté, voir User.initiales).
export class CreateCourrierDto {
  @IsOptional() @IsString() typeId?: string;

  @IsString()
  objet: string;

  @IsString()
  destinataireNom: string;

  @IsOptional() @IsString() destinataireAdresse?: string;

  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() prestataireId?: string;
  @IsOptional() @IsString() assureId?: string;

  @IsString()
  corps: string;

  @IsString()
  dateCreation: string;
}
