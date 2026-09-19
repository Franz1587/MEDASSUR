import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString } from "class-validator";
import { CreateAccordPrealableDto } from "./create-accord-prealable.dto";

// Correction des champs de base d'une demande déjà saisie (2026-08) — voir
// demande utilisateur : "permettre l'accès aux lignes des prise en charge
// déjà [existantes]... modification en cas d'erreur ou d'actualisation des
// délais de validité". `dateValidite` s'ajoute à CreateAccordPrealableDto
// (absente à la création, où elle est calculée par défaut à l'impression).
export class UpdateAccordPrealableDto extends PartialType(CreateAccordPrealableDto) {
  @IsOptional()
  @IsString()
  dateValidite?: string;
}
