import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePriseEnChargeDto {
  @IsString()
  assureId: string;

  @IsString()
  prestataire: string;

  @IsOptional()
  @IsString()
  prestataireId?: string;

  @IsString()
  type: string;

  @IsNumber()
  montant: number;

  @IsString()
  date: string;

  @IsIn(["Remboursement", "TiersPayant"])
  modePaiement: string;

  // Lien optionnel vers le catalogue ActeMedical (2026-08) — voir demande
  // utilisateur : "on doit sélectionner ou rechercher... les actes [et] ces
  // données doivent remonter depuis les données saisies côté assurance",
  // pour une demande de remboursement soumise depuis le portail assuré.
  @IsOptional()
  @IsString()
  acteMedicalId?: string;
}
