import { IsString } from "class-validator";

// Reversement (2026-08, refonte) — voir CommissionsService : les montants ne
// se saisissent plus à la main, seule la confirmation qu'une compagnie a
// reversé la commission au courtier pour une période donnée reste une
// action manuelle réelle.
export class ReverserCommissionDto {
  @IsString()
  compagnieId: string;

  @IsString()
  periode: string;
}
