import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class EnvoyerCommunicationDto {
  @IsIn(["Email", "SMS", "WhatsApp"])
  canal: string;

  @IsIn(["Prestataire", "Client", "AssureSante", "Prospect", "Libre"])
  destinataireType: string;

  @IsOptional()
  @IsString()
  destinataireId?: string;

  @IsString()
  destinataireNom: string;

  // Plusieurs destinataires séparés par « ; » ou « , ».
  @IsString()
  @MinLength(3)
  destinataireContact: string;

  @IsOptional()
  @IsString()
  cc?: string;

  @IsOptional()
  @IsString()
  objet?: string;

  @IsString()
  @MinLength(1)
  contenu: string;

  @IsOptional()
  @IsString()
  contenuHtml?: string;

  // Pièces jointes déjà stockées (transfert, brouillon) — JSON d'un tableau de noms.
  @IsOptional()
  @IsString()
  piecesJointesExistantes?: string;

  // Envoi d'un brouillon existant : il est remplacé par le message envoyé.
  @IsOptional()
  @IsString()
  brouillonId?: string;
}

export class BrouillonCommunicationDto {
  @IsOptional() @IsIn(["Email", "SMS", "WhatsApp"]) canal?: string;
  @IsOptional() @IsIn(["Prestataire", "Client", "AssureSante", "Prospect", "Libre"]) destinataireType?: string;
  @IsOptional() @IsString() destinataireId?: string;
  @IsOptional() @IsString() destinataireNom?: string;
  @IsOptional() @IsString() destinataireContact?: string;
  @IsOptional() @IsString() cc?: string;
  @IsOptional() @IsString() objet?: string;
  @IsOptional() @IsString() contenu?: string;
  @IsOptional() @IsString() contenuHtml?: string;
  @IsOptional() @IsString() piecesJointesExistantes?: string;
}

export class MajCommunicationDto {
  @IsOptional() @IsBoolean() lu?: boolean;
  @IsOptional() @IsBoolean() archive?: boolean;
  @IsOptional() @IsBoolean() supprime?: boolean;
  @IsOptional() @IsBoolean() suivi?: boolean;
}

export class SignatureDto {
  @IsOptional() @IsString() signatureEmail?: string;
  @IsOptional() @IsString() signatureSms?: string;
}
