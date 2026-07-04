import { http } from "@/lib/http";
import type { Compagnie } from "@/types/compagnies";

export async function getCompagnies(): Promise<Compagnie[]> {
  return http.get<Compagnie[]>("/compagnies");
}
