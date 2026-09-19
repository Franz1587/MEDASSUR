import { IsString, MinLength } from "class-validator";

// email (2026-08) — accepte aussi un matricule pour un compte assure_principal
// (voir AuthService.login), donc plus de @IsEmail() ici : la résolution
// email-ou-matricule est entièrement déléguée au service.
export class LoginDto {
  @IsString()
  @MinLength(3)
  email: string;

  @IsString()
  @MinLength(4)
  password: string;
}
