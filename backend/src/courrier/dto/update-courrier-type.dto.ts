import { PartialType } from "@nestjs/mapped-types";
import { CreateCourrierTypeDto } from "./create-courrier-type.dto";

export class UpdateCourrierTypeDto extends PartialType(CreateCourrierTypeDto) {}
