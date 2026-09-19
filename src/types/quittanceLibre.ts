// Quittance Libre (2026-08) — voir demande utilisateur : "il faut qu'on
// puisse quittancer librement même au cours d'un exercice sans que cela ne
// soit forcément lié à un avenant... échelonner le paiement d'une prime
// annuelle en plusieurs tranches... l'application doit faire un décompte
// entre ce qui est payé et ce qui reste à payer."
export interface QuittanceLibreTranche {
  id: string;
  numero: number;
  montant: number;
  dateEcheance: string;
  // Décomposition traçable de `montant` (2026-08) — voir demande
  // utilisateur : "retracer pour chaque tranche la prime nette, les
  // accessoires et la taxe de 8%". primeNette + accessoires + taxe =
  // montant, à l'arrondi près. Calculée une seule fois côté serveur à la
  // création (voir QuittancesLibresService.create).
  primeNette: number;
  accessoires: number;
  taxe: number;
  // Présent uniquement si la tranche est payée — voir
  // QuittancesLibresService.payerTranche (crée un vrai EncaissementPrime).
  encaissement?: {
    id: string;
    dateEncaissement: string;
    modePaiement?: string;
    // Chèque/Virement uniquement (2026-08) — voir demande utilisateur.
    banqueNom?: string;
    referencePaiement?: string;
  };
}

export interface QuittanceLibre {
  id: string;
  contratId: string;
  clientNom: string;
  compagnieNom: string;
  montantTotal: number;
  dateCreation: string;
  statut: "En cours" | "Soldée" | "Annulée";
  motifAnnulation?: string;
  gestionnaireNom?: string;
  createdAt: string;
  tranches: QuittanceLibreTranche[];
}
