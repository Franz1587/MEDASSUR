import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class CreateAgenceDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() responsable?: string;

  @IsOptional()
  @IsIn(["Actif", "Inactif"])
  statut?: string;

  // Mentions reconnues à l'import de contrats (ex. "POG") — voir
  // Agence.mentionsImport dans schema.prisma.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionsImport?: string[];

  // Création automatique des déclinaisons de compagnies (ex. "NSIA
  // ASSURANCES POG") — voir schema.prisma Agence.creerDeclinaisonsAuto.
  @IsOptional()
  @IsBoolean()
  creerDeclinaisonsAuto?: boolean;
}
