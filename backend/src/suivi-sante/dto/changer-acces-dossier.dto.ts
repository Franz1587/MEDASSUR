import { IsString } from "class-validator";

// Ouverture / fermeture de l'accès d'un médecin au dossier d'un assuré.
export class ChangerAccesDossierDto {
  @IsString()
  assureId: string;

  @IsString()
  medecinId: string;
}
