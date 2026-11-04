import { http } from "@/lib/http";
import type { NiveauRelance, RelanceEnvoyee } from "@/types/relances";

export const getNiveauxRelance = (): Promise<NiveauRelance[]> => http.get<NiveauRelance[]>("/relances/niveaux");

export const upsertNiveauRelance = (dto: Partial<NiveauRelance>): Promise<NiveauRelance> =>
  http.post<NiveauRelance>("/relances/niveaux", dto);

export const deleteNiveauRelance = (id: string): Promise<void> => http.delete(`/relances/niveaux/${id}`);

export const getHistoriqueRelances = (): Promise<RelanceEnvoyee[]> => http.get<RelanceEnvoyee[]>("/relances/historique");

export const declencherRelances = (): Promise<{ envoyees: number; ignorees: number }> =>
  http.post<{ envoyees: number; ignorees: number }>("/relances/declencher");
