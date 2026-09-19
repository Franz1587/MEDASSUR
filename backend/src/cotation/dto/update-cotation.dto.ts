import { PartialType } from "@nestjs/mapped-types";
import { CreateCotationDto } from "./create-cotation.dto";

// Toute cotation reste modifiable après enregistrement (voir écran
// Cotation) — mêmes règles de validation que la création, tout optionnel.
export class UpdateCotationDto extends PartialType(CreateCotationDto) {}
