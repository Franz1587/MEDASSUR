import { PartialType } from "@nestjs/mapped-types";
import { CreateRegleConsigneDto } from "./create-regle-consigne.dto";

export class UpdateRegleConsigneDto extends PartialType(CreateRegleConsigneDto) {}
