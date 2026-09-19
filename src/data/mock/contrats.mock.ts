export interface MockGarantie {
  id: string;
  categorie: string;
  libelle: string;
  tauxAssure: number | null;
  tauxAyantsDroit: number | null;
  plafond: string | null;
  plafondMontant: number | null;
  plafondPeriode: string | null;
}

export const mockContrats = [
  {
    id: "CTR-2024-004", client: "BGFI Bank Gabon", branche: "Maladie", compagnie: "Ogar Vie", dateDebut: "01/01/2024", dateFin: "31/12/2024", prime: 32_600_000, statut: "En renouvellement", jours: "15 jours",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC"] as string[],
    tauxCouvertureAmbulatoire: null as string | null, tauxCouvertureHospitalisation: null as string | null,
    nombreAssuresPrincipaux: null as number | null, primeUnitaireAssurePrincipal: null as number | null,
    nombreConjoints: null as number | null, primeUnitaireConjoint: null as number | null,
    nombreEnfants: null as number | null, primeUnitaireEnfant: null as number | null,
    nombreCouples: null as number | null, primeUnitaireCouple: null as number | null,
    tauxTerritorialite: null as number | null, limiteAgeAdulte: null as number | null, limiteAgeEnfant: null as number | null, limiteAgeEnfantScolarise: null as number | null, limitePersFamille: null as number | null,
    plafondAdherent: null as number | null, plafondFamille: null as number | null, plafondPolice: null as number | null,
    tauxMinoMajoration: null as number | null, tauxReductionCommerciale: null as number | null,
    montantAccessoires: null as number | null, tauxCommission: null as number | null, montantCommission: null as number | null,
    primeNette: null as number | null, primeTotaleHT: null as number | null, montantTaxe: null as number | null,
    periodicite: null as string | null, typeAffaire: null as string | null, exerciceNumero: null as number | null,
    garanties: [] as MockGarantie[],
  },
  {
    id: "CTR-2024-005", client: "SEEG", branche: "Maladie", compagnie: "Colina Gabon", dateDebut: "01/04/2024", dateFin: "31/03/2025", prime: 98_000_000, statut: "Actif", jours: "210 jours",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC", "Afrique"] as string[],
    tauxCouvertureAmbulatoire: null as string | null, tauxCouvertureHospitalisation: null as string | null,
    nombreAssuresPrincipaux: null as number | null, primeUnitaireAssurePrincipal: null as number | null,
    nombreConjoints: null as number | null, primeUnitaireConjoint: null as number | null,
    nombreEnfants: null as number | null, primeUnitaireEnfant: null as number | null,
    nombreCouples: null as number | null, primeUnitaireCouple: null as number | null,
    tauxTerritorialite: null as number | null, limiteAgeAdulte: null as number | null, limiteAgeEnfant: null as number | null, limiteAgeEnfantScolarise: null as number | null, limitePersFamille: null as number | null,
    plafondAdherent: null as number | null, plafondFamille: null as number | null, plafondPolice: null as number | null,
    tauxMinoMajoration: null as number | null, tauxReductionCommerciale: null as number | null,
    montantAccessoires: null as number | null, tauxCommission: null as number | null, montantCommission: null as number | null,
    primeNette: null as number | null, primeTotaleHT: null as number | null, montantTaxe: null as number | null,
    periodicite: null as string | null, typeAffaire: null as string | null, exerciceNumero: null as number | null,
    garanties: [] as MockGarantie[],
  },
];
