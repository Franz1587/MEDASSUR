import { IsNotEmpty, IsString, MinLength } from "class-validator";

// Changement de mot de passe en LIBRE-SERVICE (2026-09) — voir demande
// utilisateur : "un vrai formulaire Mon profil... c'est là qu'il pourra
// changer de mot de passe". Distinct des flux de RÉINITIALISATION existants
// (SocieteUsersService.reinitialiserMotDePasse, PrestatairesService.
// reinitialiserMotDePassePortail) qui imposent un mot de passe généré SANS
// connaître l'ancien (réservés aux administrateurs pour un compte bloqué) —
// ici la personne connaît déjà son mot de passe actuel et en choisit un
// nouveau elle-même.
export class ChangerMotDePasseDto {
  @IsString() @IsNotEmpty()
  ancienMotDePasse: string;

  @IsString() @MinLength(8, { message: "Le nouveau mot de passe doit contenir au moins 8 caractères." })
  nouveauMotDePasse: string;
}
