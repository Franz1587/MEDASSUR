import { http, toNumber } from "./http";

// Catalogue des actes médicaux (578 actes, voir backend/src/actes-medicaux)
// — GET /actes-medicaux ne supporte qu'un filtre serveur "famille" ; la
// recherche-à-la-frappe (voir mémoire projet "Listes = recherche rapide")
// se fait donc CÔTÉ CLIENT sur la liste complète, comme le fait le Combobox
// web (src/components/shared/Combobox.tsx). Utilisé par les formulaires
// "Nouvelle demande de prise en charge" et "Nouvelle demande de
// remboursement" pour choisir un acte réel du catalogue.
export interface ActeMedical {
  id: string;
  libelle: string;
  famille: string;
  prixDefaut: number;
  categorieGarantie: string | null;
  exonereTps: boolean;
  lettreCleCode?: string | null;
  coefficient?: number | null;
  lettreCle?: { code: string; libelle: string; valeurUnitaire: string | number } | null;
}

interface ApiActeMedical extends Omit<ActeMedical, "prixDefaut"> {
  prixDefaut: string | number;
}

export async function getActesMedicaux(famille?: string): Promise<ActeMedical[]> {
  const qs = famille ? `?famille=${encodeURIComponent(famille)}` : "";
  const data = await http.get<ApiActeMedical[]>(`/actes-medicaux${qs}`);
  return data.map((a) => ({ ...a, prixDefaut: toNumber(a.prixDefaut) }));
}
