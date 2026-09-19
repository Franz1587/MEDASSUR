import { PartialType } from "@nestjs/mapped-types";
import { CreateAvenantDto } from "./create-avenant.dto";

export class UpdateAvenantDto extends PartialType(CreateAvenantDto) {}
