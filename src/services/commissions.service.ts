import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Commission } from "@/types/commissions";

interface ApiCommission {
  id: string;
  periode: string;
  primeEncaissee: string | number;
  tauxCommission: string;
  montantCommission: string | number;
  statut: string;
  compagnie: { nom: string };
}

export async function getCommissions(): Promise<Commission[]> {
  const data = await http.get<ApiCommission[]>("/commissions");
  return data.map((c) => ({
    id: c.id,
    compagnie: c.compagnie.nom,
    periode: c.periode,
    primeEncaissee: toNumber(c.primeEncaissee),
    tauxCommission: c.tauxCommission,
    montantCommission: toNumber(c.montantCommission),
    statut: c.statut,
  }));
}
