import { mockRapports, mockKpis } from "@/data/mock/rapports.mock";
import type { Rapport, Kpi } from "@/types/rapports";

export async function getRapports(): Promise<Rapport[]> {
  return mockRapports;
}

export async function getKpis(): Promise<Kpi[]> {
  return mockKpis;
}
