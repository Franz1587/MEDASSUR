import { http } from "@/lib/http";
import type { Agence, AgenceUpsertInput } from "@/types/agences";

export async function getAgences(): Promise<Agence[]> {
  return http.get<Agence[]>("/agences");
}

export async function createAgence(payload: AgenceUpsertInput): Promise<Agence> {
  return http.post<Agence>("/agences", payload);
}

export async function updateAgence(id: string, payload: Partial<AgenceUpsertInput>): Promise<Agence> {
  return http.patch<Agence>(`/agences/${id}`, payload);
}

export async function deleteAgence(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/agences/${id}`);
}
