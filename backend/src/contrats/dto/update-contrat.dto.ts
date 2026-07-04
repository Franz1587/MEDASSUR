import { PartialType } from "@nestjs/mapped-types";
import { CreateContratDto } from "./create-contrat.dto";

export class UpdateContratDto extends PartialType(CreateContratDto) {}
