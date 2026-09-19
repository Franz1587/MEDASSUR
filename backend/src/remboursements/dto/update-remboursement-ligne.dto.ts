import { PartialType } from "@nestjs/mapped-types";
import { CreateRemboursementLigneDto } from "./create-remboursement-ligne.dto";

export class UpdateRemboursementLigneDto extends PartialType(CreateRemboursementLigneDto) {}
