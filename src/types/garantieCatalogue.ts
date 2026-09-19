export interface GarantieCatalogueItem {
  id: string;
  branche: "Maladie" | "Assistance";
  categorie: string;
  libelle: string;
  tauxAssureDefaut?: number;
  tauxAyantsDroitDefaut?: number;
  plafondDefaut?: string;
}
