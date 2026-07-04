import { mockCommissions } from "@/data/mock/commissions.mock";
import type { Commission } from "@/types/commissions";

export async function getCommissions(): Promise<Commission[]> {
  return mockCommissions;
}
