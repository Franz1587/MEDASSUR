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

function mapJournalEntry(j: ApiJournalEntry): JournalEntry {
  return {
    date: j.date,
    num: j.num,
    libelle: j.libelle,
    debit: toNumber(j.debit),
    credit: toNumber(j.credit),
    compte: j.compte,
  };
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const data = await http.get<ApiJournalEntry[]>("/comptabilite/journal");
  return data.map(mapJournalEntry);
}

export interface JournalEntryUpsertInput {
  date: string;
  libelle: string;
  compte: string;
  debit: number;
  credit: number;
}

export async function createJournalEntry(payload: JournalEntryUpsertInput): Promise<JournalEntry> {
  const j = await http.post<ApiJournalEntry>("/comptabilite/journal", payload);
  return mapJournalEntry(j);
}
