import { productionMensuelle, portefeuilleBranche, sinistraliteData } from "@/data/mock/dashboard.mock";
import type { ProductionMensuelle, PortefeuilleBranche, SinistraliteData } from "@/types/dashboard";

export async function getProductionMensuelle(): Promise<ProductionMensuelle[]> {
  return productionMensuelle;
}

export async function getPortefeuilleBranche(): Promise<PortefeuilleBranche[]> {
  return portefeuilleBranche;
}

export async function getSinistraliteData(): Promise<SinistraliteData[]> {
  return sinistraliteData;
}
