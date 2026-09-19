import { http } from "@/lib/http";
import type { Commission } from "@/types/commissions";

export async function getCommissions(du?: string, au?: string): Promise<Commission[]> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  const qs = params.toString();
  return http.get<Commission[]>(`/commissions${qs ? `?${qs}` : ""}`);
}

export async function reverserCommission(compagnieId: string, periode: string): Promise<void> {
  await http.patch("/commissions/reverser", { compagnieId, periode });
}
