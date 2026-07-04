import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Prospect } from "@/types/crm";

interface ApiProspect {
  id: string;
  nom: string;
  type: string;
  source: string;
  etape: string;
  valeurEstimee: string | number;
  commercial: string;
  dernierContact: string;
}

function mapProspect(p: ApiProspect): Prospect {
  return { ...p, valeurEstimee: toNumber(p.valeurEstimee) };
}

export async function getProspects(): Promise<Prospect[]> {
  const data = await http.get<ApiProspect[]>("/crm/prospects");
  return data.map(mapProspect);
}

/** Derived client-side from each prospect's own pipeline `etape`. */
export async function getCrmKanban(): Promise<Record<string, string[]>> {
  const prospects = await getProspects();
  const columns: Record<string, string[]> = {};
  for (const p of prospects) {
    (columns[p.etape] ??= []).push(p.id);
  }
  return columns;
}
