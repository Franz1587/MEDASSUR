import { mockOffres, aiComparatifSynthese } from "@/data/mock/comparateur.mock";
import { iaWelcomeMessage, iaSuggestions, iaDefaultResponse } from "@/data/mock/ia.mock";
import type { Offre } from "@/types/comparateur";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated OCR + AI offer comparison. Kept mocked per product decision;
 * swap this body for a real OCR/LLM call later without touching callers.
 */
export async function compareOffers(_files?: File[]): Promise<{ offres: Offre[]; synthese: string }> {
  await sleep(1800);
  return { offres: mockOffres, synthese: aiComparatifSynthese };
}

export function getIaWelcomeMessage(): string {
  return iaWelcomeMessage;
}

export function getIaSuggestions(): string[] {
  return iaSuggestions;
}

export async function chatAssistant(_message: string): Promise<string> {
  await sleep(700);
  return iaDefaultResponse;
}
