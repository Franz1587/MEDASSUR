import { IsOptional, IsString } from "class-validator";

export class PayerTrancheDto {
  @IsString()
  dateEncaissement: string;

  @IsOptional()
  @IsString()
  modePaiement?: string;

  // Chèque/Virement uniquement (2026-08) — voir demande utilisateur : "on
  // doit pouvoir choisir la banque" pour ces deux modes. Sans objet pour
  // Espèces/Mobile Money.
  @IsOptional()
  @IsString()
  banqueId?: string;

  @IsOptional()
  @IsString()
  referencePaiement?: string;
}
