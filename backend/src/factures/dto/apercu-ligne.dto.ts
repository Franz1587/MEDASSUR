import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TYPES_PRESTATION } from "../../sante/dto/create-facture-ligne.dto";

export class ApercuLigneDto {
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
}
