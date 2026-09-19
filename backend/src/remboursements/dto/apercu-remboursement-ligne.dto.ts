import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TYPES_PRESTATION } from "../../sante/dto/create-facture-ligne.dto";

export class ApercuRemboursementLigneDto {
  @IsString()
  assureId: string;

  @IsIn(TYPES_PRESTATION)
  typePrestation: string;

  @IsNumber()
  @Min(0)
  montant: number;

  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montantRejete?: number;

  // Voir CreateRemboursementLigneDto — le prestataire (s'il est
  // conventionné) détermine le secteur, donc le taux applicable.
  @IsOptional()
  @IsString()
  prestataireId?: string;
}
