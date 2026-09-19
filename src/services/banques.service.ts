import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Banque, BanqueUpsertInput, LotCheques, MouvementBanque, StatistiqueBanque } from "@/types/banques";

interface ApiMouvement {
  id: string;
  numero: string;
  numeroCheque: number;
  montantTotal: string | number;
  statut: string;
  dateEmission: string;
  prestataire: { nom: string };
  compagnie?: { nom: string } | null;
}

interface ApiStatistiqueBanque {
  banqueId: string;
  banqueNom: string;
  statut: string;
  nombreLettresCheque: number;
  montantTotal: string | number;
}

export async function getBanques(): Promise<Banque[]> {
  return http.get<Banque[]>("/banques");
}

export async function getBanque(id: string): Promise<Banque> {
  return http.get<Banque>(`/banques/${id}`);
}

export async function createBanque(payload: BanqueUpsertInput): Promise<Banque> {
  return http.post<Banque>("/banques", payload);
}

export async function updateBanque(id: string, payload: Partial<BanqueUpsertInput>): Promise<Banque> {
  return http.patch<Banque>(`/banques/${id}`, payload);
}

// Nouveau lot de numéros de chèque pré-paramétré (ex. 50 à la fois) —
// voir ReglementComptableService.genererLettreCheque côté backend, qui
// consomme ce lot un numéro à la fois jusqu'à épuisement.
export async function ajouterLotCheques(banqueId: string, payload: { numeroDebut: number; numeroFin: number }): Promise<LotCheques> {
  return http.post<LotCheques>(`/banques/${banqueId}/lots`, payload);
}

// Historique des mouvements d'une banque — voir BanquesService.mouvements.
export async function getMouvementsBanque(banqueId: string): Promise<MouvementBanque[]> {
  const data = await http.get<ApiMouvement[]>(`/banques/${banqueId}/mouvements`);
  return data.map((m) => ({
    id: m.id,
    numero: m.numero,
    numeroCheque: m.numeroCheque,
    montantTotal: toNumber(m.montantTotal),
    statut: m.statut,
    dateEmission: m.dateEmission,
    prestataireNom: m.prestataire.nom,
    compagnieNom: m.compagnie?.nom,
  }));
}

// Classement des banques par usage réel — voir BanquesService.statistiques.
export async function getStatistiquesBanques(): Promise<StatistiqueBanque[]> {
  const data = await http.get<ApiStatistiqueBanque[]>("/banques/statistiques");
  return data.map((s) => ({ ...s, montantTotal: toNumber(s.montantTotal) }));
}
