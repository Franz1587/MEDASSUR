import { IsOptional, IsString } from "class-validator";

export class CreateBanqueDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  codeBanque?: string;

  @IsOptional()
  @IsString()
  compteNumero?: string;

  // Coordonnées de l'agence (2026-09) — voir schema.prisma Banque.
  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
