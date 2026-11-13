import { IsString, MaxLength, MinLength } from "class-validator";

// email (2026-08) — accepte aussi un matricule pour un compte assure_principal
// (voir AuthService.login), donc plus de @IsEmail() ici : la résolution
// email-ou-matricule est entièrement déléguée au service.
export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  email: string;

  // MinLength volontairement permissif : les comptes existants peuvent avoir
  // un mot de passe faible (la politique ne s'applique qu'au changement).
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;
}
