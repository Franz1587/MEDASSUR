import { IsArray, IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { ROLE_IDS } from "../../auth/role.enum";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreateUserDto {
  @IsString()
  nom: string;

  @IsEmail()
  email: string;

  @IsString()
  initiales: string;

  @IsIn(ROLE_IDS)
  roleId: string;

  // Facultatif — si omis, UsersService.create() pré-remplit depuis
  // ROLE_MODULES[roleId] (voir role-modules.ts).
  @IsOptional() @IsArray() @IsString({ each: true }) modules?: string[];

  // Coordonnées personnelles (2026-08, voir demande utilisateur : "ajouter
  // les coordonnées personnels").
  @IsOptional() @IsString() @Transform(({ value }) => normaliserTelephone(value)) telephone?: string;
  @IsOptional() @IsString() adresse?: string;

  // Agence de rattachement (2026-09) — voir schema.prisma Agence.
  @IsOptional() @IsString() agenceId?: string;
}
