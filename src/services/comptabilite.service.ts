import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { JournalEntry } from "@/types/comptabilite";

interface ApiJournalEntry {
  date: string;
  num: string;
  libelle: string;
  debit: string | number;
  credit: string | number;
  compte: string;
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const data = await http.get<ApiJournalEntry[]>("/comptabilite/journal");
  return data.map((j) => ({
    date: j.date,
    num: j.num,
    libelle: j.libelle,
    debit: toNumber(j.debit),
    credit: toNumber(j.credit),
    compte: j.compte,
  }));
}
