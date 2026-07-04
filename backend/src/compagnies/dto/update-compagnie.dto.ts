import { PartialType } from "@nestjs/mapped-types";
import { CreateCompagnieDto } from "./create-compagnie.dto";

export class UpdateCompagnieDto extends PartialType(CreateCompagnieDto) {}
