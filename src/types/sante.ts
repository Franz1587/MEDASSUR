import type { assuresSante, priseEnCharges } from "@/data/mock/sante.mock";

export type AssureSante = (typeof assuresSante)[number];
export type PriseEnCharge = (typeof priseEnCharges)[number];
