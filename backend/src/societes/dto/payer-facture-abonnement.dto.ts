import { IsIn, IsOptional, IsString } from "class-validator";

export class PayerFactureAbonnementDto {
  @IsIn(["Virement", "Chèque", "Espèces", "Mobile Money"])
  modePaiement: string;

  @IsOptional()
  @IsString()
  referencePaiement?: string;

  @IsOptional()
  @IsString()
  datePaiement?: string;
}
