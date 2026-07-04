import { journalEntries } from "@/data/mock/comptabilite.mock";
import type { JournalEntry } from "@/types/comptabilite";

export async function getJournalEntries(): Promise<JournalEntry[]> {
  return journalEntries;
}
