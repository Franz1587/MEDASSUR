import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreatePropositionDto } from "./create-proposition.dto";

export class UpdatePropositionDto extends PartialType(CreatePropositionDto) {
  @IsOptional()
  @IsIn(["Brouillon", "Envoyée"])
  statut?: string;
}
