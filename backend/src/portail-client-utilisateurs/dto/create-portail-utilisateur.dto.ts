import { ArrayNotEmpty, IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePortailUtilisateurDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  initiales!: string;

  @IsString()
  @MinLength(6)
  motDePasse!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules!: string[];

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;
}
