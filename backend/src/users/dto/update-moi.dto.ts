import { IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

// Mise à jour du PROPRE profil (2026-09) — voir demande utilisateur : "il
// faut un vrai formulaire 'Mon profil'... c'est là qu'il aura toutes les
// infos de son profil". Volontairement PLUS RESTREINT que UpdateUserDto
// (réservé aux administrateurs, voir users.controller.ts) : jamais `email`
// (identifiant de connexion, changer le sien soi-même ouvrirait la porte à
// une prise de contrôle de compte sans validation) ni `roleId` — seules les
// coordonnées personnelles, éditables par n'importe quel rôle sur SON PROPRE
// compte.
export class UpdateMoiDto {
  @IsOptional() @IsString() nom?: string;
  @IsOptional() @IsString() @Transform(({ value }) => normaliserTelephone(value)) telephone?: string;
  @IsOptional() @IsString() adresse?: string;
}
