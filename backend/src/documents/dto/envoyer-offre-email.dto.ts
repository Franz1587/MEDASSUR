import { IsEmail } from "class-validator";

export class EnvoyerOffreEmailDto {
  @IsEmail()
  to: string;
}
