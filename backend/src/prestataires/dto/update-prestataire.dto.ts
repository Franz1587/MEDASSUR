import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString } from "class-validator";
import { CreatePrestataireDto } from "./create-prestataire.dto";

export class UpdatePrestataireDto extends PartialType(CreatePrestataireDto) {
  @IsOptional()
  @IsString()
  motifSuspension?: string;
}
