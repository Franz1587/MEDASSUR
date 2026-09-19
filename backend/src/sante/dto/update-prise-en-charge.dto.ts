import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional, IsString } from "class-validator";
import { CreatePriseEnChargeDto } from "./create-prise-en-charge.dto";

// Une facture/remboursement reste modifiable après saisie (voir écran
// Factures, bouton "Modifier" sur une ligne) — mêmes champs que la
// création, tout optionnel, plus le statut qui n'existe qu'en modification.
export class UpdatePriseEnChargeDto extends PartialType(CreatePriseEnChargeDto) {
  @IsOptional()
  @IsIn(["Déclaré", "Accordé", "Remboursé", "Rejeté"])
  statut?: string;
}
