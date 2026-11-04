import { api } from "./api";
import type { NiveauRelance, RelanceEnvoyee } from "@/types/relances";

export const getNiveauxRelance = (): Promise<NiveauRelance[]> => api.get("/relances/niveaux").then((r) => r.data);

export const upsertNiveauRelance = (dto: Partial<NiveauRelance>): Promise<NiveauRelance> =>
  api.post("/relances/niveaux", dto).then((r) => r.data);

export const deleteNiveauRelance = (id: string): Promise<void> => api.delete(`/relances/niveaux/${id}`);

export const getHistoriqueRelances = (): Promise<RelanceEnvoyee[]> => api.get("/relances/historique").then((r) => r.data);

export const declencherRelances = (): Promise<{ envoyees: number; ignorees: number }> =>
  api.post("/relances/declencher").then((r) => r.data);
