import { http } from "@/lib/http";

export interface Transaction {
  id: string;
  reference: string;
  type: "PAYIN" | "PAYOUT";
  montant: number;
  description: string;
  statut: "created" | "pending" | "paid" | "expired" | "failed";
  operateur?: string;
  payeurMsisdn?: string;
  payeurNom?: string;
  payeurEmail?: string;
  ebillingId?: string;
  payoutId?: string;
  transactionIdOperateur?: string;
  fraisBilling?: number;
  contratId?: string;
  prestataireId?: string;
  gestionnaireId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PayinInput {
  montant: number;
  description: string;
  operateur: string;
  msisdn?: string;
  nom?: string;
  email?: string;
  contratId?: string;
  gestionnaireId?: string;
}

export interface PayoutInput {
  montant: number;
  msisdn: string;
  operateur: string;
  description: string;
  nom?: string;
  prestataireId?: string;
  gestionnaireId?: string;
  bordereauIds?: string[];
}

export async function getTransactions(type?: string, statut?: string): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (statut) params.set("statut", statut);
  const qs = params.toString();
  const data = await http.get<{ montant: string | number; [k: string]: unknown }[]>(
    `/ebilling/transactions${qs ? `?${qs}` : ""}`,
  );
  return data.map((t) => ({ ...t, montant: Number(t.montant) })) as unknown as Transaction[];
}

export async function initierPayin(
  dto: PayinInput,
): Promise<{ reference: string; redirectUrl?: string; ussd: boolean }> {
  return http.post("/ebilling/payin", dto);
}

export async function initierPayout(dto: PayoutInput): Promise<{ reference: string }> {
  return http.post("/ebilling/payout", dto);
}
