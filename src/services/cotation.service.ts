import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Cotation, CotationInput, TarifCalcule } from "@/types/cotation";

type ApiCotation = Omit<Cotation, "agePopulationMoyen" | "historiqueSinistres" | "stopLoss" | "primePure" | "chargements" | "marge" | "commission" | "pepm" | "tarifFinal"> & {
  agePopulationMoyen: string | number;
  historiqueSinistres: string | number;
  stopLoss: string | number;
  primePure: string | number;
  chargements: string | number;
  marge: string | number;
  commission: string | number;
  pepm: string | number;
  tarifFinal: string | number;
};

function mapCotation(c: ApiCotation): Cotation {
  return {
    ...c,
    agePopulationMoyen: toNumber(c.agePopulationMoyen),
    historiqueSinistres: toNumber(c.historiqueSinistres),
    stopLoss: toNumber(c.stopLoss),
    primePure: toNumber(c.primePure),
    chargements: toNumber(c.chargements),
    marge: toNumber(c.marge),
    commission: toNumber(c.commission),
    pepm: toNumber(c.pepm),
    tarifFinal: toNumber(c.tarifFinal),
  };
}

export async function getCotations(): Promise<Cotation[]> {
  const data = await http.get<ApiCotation[]>("/cotation");
  return data.map(mapCotation);
}

/** Prévisualise le tarif (Pricing Engine) sans persister. */
export async function simuler(input: CotationInput): Promise<TarifCalcule> {
  const data = await http.post<{ chargements: string | number; marge: string | number; commission: string | number; tarifFinal: string | number; pepm: string | number }>(
    "/cotation/simuler",
    input,
  );
  return {
    chargements: toNumber(data.chargements),
    marge: toNumber(data.marge),
    commission: toNumber(data.commission),
    tarifFinal: toNumber(data.tarifFinal),
    pepm: toNumber(data.pepm),
  };
}

export async function creerCotation(input: CotationInput): Promise<Cotation> {
  const data = await http.post<ApiCotation>("/cotation", input);
  return mapCotation(data);
}
