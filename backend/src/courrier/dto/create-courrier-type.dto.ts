import { IsBoolean, IsOptional, IsString } from "class-validator";

// Modèle de courrier paramétrable (2026-08, voir demande utilisateur —
// "rendre paramétrable les options de courrier"). corpsModele est du HTML
// avec jetons {{DESTINATAIRE}}/{{DATE}}/{{REFERENCE}}/{{OBJET}}, substitués
// à la création d'un Courrier à partir de ce type.
export class CreateCourrierTypeDto {
  @IsString()
  libelle: string;

  @IsString()
  corpsModele: string;

  @IsOptional() @IsBoolean() actif?: boolean;
}
