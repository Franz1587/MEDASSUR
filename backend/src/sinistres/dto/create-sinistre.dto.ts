import { IsIn, IsNumber, IsString } from "class-validator";

export class CreateSinistreDto {
  @IsString()
  clientId: string;

  @IsString()
  branche: string;

  @IsString()
  date: string;

  @IsString()
  description: string;

  @IsNumber()
  montant: number;

  @IsIn(["Déclaré", "Expert. en cours", "Expertise", "Recours", "Remboursé", "Clôturé"])
  statut: string;

  @IsIn(["Normal", "Haute", "Urgent"])
  priorite: string;
}
