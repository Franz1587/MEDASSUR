import { http } from "@/lib/http";

// Bordereaux (2026-08) — voir demande utilisateur : "3 nouveaux états, le
// bordereau sinistres, le bordereau de production... et le bordereau
// d'encaissement de prime". Voir backend/src/bordereaux.
export interface LigneBordereauSinistres {
  dateSoins: string;
  dateReglement: string;
  numeroPolice: string;
  souscripteur: string;
  numeroClient: string;
  assurePrincipal: string;
  prestataire: string;
  numeroReglement: string;
  fraisReels: number;
  partGarant: number;
  tps: number;
  netAPayer: number;
}

export interface GroupeBordereauSinistres {
  souscripteur: string;
  lignes: LigneBordereauSinistres[];
  totaux: { fraisReels: number; partGarant: number; tps: number; netAPayer: number };
}

export type TypeReglementBordereauSinistres = "maladie" | "comptable";

export interface BordereauSinistresPayload {
  du?: string;
  au?: string;
  compagnieId?: string;
  compagnie?: string;
  typeReglement: TypeReglementBordereauSinistres;
  groupes: GroupeBordereauSinistres[];
  total: { fraisReels: number; partGarant: number; tps: number; netAPayer: number };
}

export async function getBordereauSinistres(
  du?: string, au?: string, compagnieId?: string, typeReglement?: TypeReglementBordereauSinistres,
): Promise<BordereauSinistresPayload> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  if (typeReglement) params.set("typeReglement", typeReglement);
  const qs = params.toString();
  return http.get<BordereauSinistresPayload>(`/bordereaux/sinistres${qs ? `?${qs}` : ""}`);
}

export interface LigneBordereauProduction {
  numeroPolice: string;
  codeAssure: string;
  numQuittance: string;
  dateEmisQuittance: string;
  dateAvenant: string;
  nomSouscripteur: string;
  dateDebut: string;
  dateFin: string;
  produit: string;
  capitauxAssures: string;
  primes: number;
  access: number;
  taxes: number;
  primesTotales: number;
}

export interface GroupeBordereauProduction {
  compagnie: string;
  lignes: LigneBordereauProduction[];
  totaux: { primes: number; access: number; taxes: number; primesTotales: number; commission: number };
}

export interface BordereauProductionPayload {
  du?: string;
  au?: string;
  groupes: GroupeBordereauProduction[];
  total: { primes: number; access: number; taxes: number; primesTotales: number; commission: number };
}

export async function getBordereauProduction(du?: string, au?: string, compagnieId?: string): Promise<BordereauProductionPayload> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  const qs = params.toString();
  return http.get<BordereauProductionPayload>(`/bordereaux/production${qs ? `?${qs}` : ""}`);
}

// Bordereau d'Encaissement — même document que Production (voir demande
// utilisateur : "exactement le même document dans la forme"), réutilise donc
// directement ses types.
export async function getBordereauEncaissement(du?: string, au?: string, compagnieId?: string): Promise<BordereauProductionPayload> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  if (compagnieId) params.set("compagnieId", compagnieId);
  const qs = params.toString();
  return http.get<BordereauProductionPayload>(`/bordereaux/encaissement${qs ? `?${qs}` : ""}`);
}
