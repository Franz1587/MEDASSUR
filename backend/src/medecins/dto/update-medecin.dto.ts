import { PartialType, OmitType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateMedecinDto } from "./create-medecin.dto";

// prestataireIds omis (2026-08) — la liaison aux structures se gère par des
// routes dédiées (lierStructure/delierStructure), pas par un remplacement
// en masse à chaque modification de fiche (voir MedecinsController).
export class UpdateMedecinDto extends PartialType(OmitType(CreateMedecinDto, ["prestataireIds"] as const)) {
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
