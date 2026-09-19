import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateAppelOffresDto } from "./create-appel-offres.dto";

export class UpdateAppelOffresDto extends PartialType(CreateAppelOffresDto) {
  @IsOptional()
  @IsIn(["En cours", "Proposition envoyée", "Gagné", "Perdu"])
  statut?: string;
}
