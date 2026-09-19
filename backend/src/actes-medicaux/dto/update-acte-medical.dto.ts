import { PartialType } from "@nestjs/mapped-types";
import { CreateActeMedicalDto } from "./create-acte-medical.dto";

export class UpdateActeMedicalDto extends PartialType(CreateActeMedicalDto) {}
