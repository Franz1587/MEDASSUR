import { PartialType } from "@nestjs/mapped-types";
import { CreateFactureLigneDto } from "./create-facture-ligne.dto";

export class UpdateFactureLigneDto extends PartialType(CreateFactureLigneDto) {}
