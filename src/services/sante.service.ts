import { assuresSante, priseEnCharges } from "@/data/mock/sante.mock";
import type { AssureSante, PriseEnCharge } from "@/types/sante";

export async function getAssuresSante(): Promise<AssureSante[]> {
  return assuresSante;
}

export async function getPriseEnCharges(): Promise<PriseEnCharge[]> {
  return priseEnCharges;
}
