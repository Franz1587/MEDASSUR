import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateLettreCleDto } from "./create-lettre-cle.dto";

// Le code est la clé de la lettre (K, KC, KA…) — fixé à la création, jamais
// modifiable ensuite (une ligne de facture existante y fait référence).
export class UpdateLettreCleDto extends PartialType(OmitType(CreateLettreCleDto, ["code"] as const)) {}
