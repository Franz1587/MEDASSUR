import { IsIn, IsOptional, IsString } from "class-validator";

export class CreatePrestataireDto {
  @IsString()
  nom: string;

  @IsIn(["Hôpital", "Clinique", "Pharmacie", "Laboratoire", "Cabinet"])
  type: string;

  @IsString()
  pays: string;

  @IsString()
  ville: string;

  @IsIn(["En négociation", "Conventionné", "Suspendu"])
  statutConvention: string;

  @IsOptional()
  @IsString()
  dateConventionnement?: string;
}
