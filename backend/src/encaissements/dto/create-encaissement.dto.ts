import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateEncaissementDto {
  @IsString()
  contratId!: string;

  @IsNumber()
  @Min(1)
  montant!: number;

  @IsString()
  dateEncaissement!: string;

  @IsOptional()
  @IsIn(["Virement", "Chèque", "Espèces", "Mobile Money"])
  modePaiement?: string;

  @IsOptional()
  @IsString()
  referencePaiement?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
