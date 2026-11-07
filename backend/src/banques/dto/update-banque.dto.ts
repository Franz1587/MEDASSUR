import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString } from "class-validator";
import { CreateBanqueDto } from "./create-banque.dto";

export class UpdateBanqueDto extends PartialType(CreateBanqueDto) {
  @IsOptional()
  @IsString()
  statut?: string;
}
