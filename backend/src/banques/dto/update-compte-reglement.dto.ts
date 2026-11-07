import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString } from "class-validator";
import { CreateCompteReglementDto } from "./create-compte-reglement.dto";

// banqueId volontairement absent : un compte de règlement ne change jamais de banque.
export class UpdateCompteReglementDto extends PartialType(OmitType(CreateCompteReglementDto, ["banqueId"] as const)) {
  @IsOptional()
  @IsString()
  statut?: string;
}
