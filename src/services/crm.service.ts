import { mockProspects, crmKanban } from "@/data/mock/crm.mock";
import type { Prospect } from "@/types/crm";

export async function getProspects(): Promise<Prospect[]> {
  return mockProspects;
}

export async function getCrmKanban(): Promise<Record<string, string[]>> {
  return crmKanban;
}
