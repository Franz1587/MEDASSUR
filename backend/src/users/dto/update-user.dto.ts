import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { ROLE_IDS } from "../../auth/role.enum";
import { normaliserTelephone } from "../../lib/telephone.util";

export class UpdateUserDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() initiales?: string;
  @IsOptional() @IsIn(ROLE_IDS) roleId?: string;
  // Coordonnées personnelles (2026-08, voir demande utilisateur : "ajouter
  // les coordonnées personnels").
  @IsOptional() @IsString() @Transform(({ value }) => normaliserTelephone(value)) telephone?: string;
  @IsOptional() @IsString() adresse?: string;

  // Agence de rattachement (2026-09) — voir schema.prisma Agence. Chaîne
  // vide = retire l'agence (retombe sur "—" côté documents).
  @IsOptional() @IsString() agenceId?: string;
}
