export const mockFlottes = [
  {
    id: "FLT-2024-01", client: "SABC SA", contrat: "CTR-2024-001", compagnie: "ACTIVA Assurances",
    nbVehicules: 15, primeTotal: 28_500_000, statut: "Actif",
    vehicules: [
      { immatriculation: "M-YA 234 CE", modele: "Toyota Hilux", conducteur: "Ndongo Ateba", valeurVenale: 18_500_000, statut: "En circulation" },
      { immatriculation: "M-YB 112 CE", modele: "Toyota Hiace", conducteur: "Paul Essomba", valeurVenale: 14_200_000, statut: "En circulation" },
      { immatriculation: "M-YB 113 CE", modele: "Toyota Hiace", conducteur: "Simon Biya", valeurVenale: 14_200_000, statut: "Immobilisé" },
    ],
  },
  {
    id: "FLT-2024-02", client: "MTN Cameroun", contrat: "CTR-2024-005", compagnie: "COLINA Assurances",
    nbVehicules: 22, primeTotal: 42_000_000, statut: "Actif",
    vehicules: [
      { immatriculation: "LT 4521 AB", modele: "Nissan Patrol", conducteur: "Achille Mengue", valeurVenale: 22_000_000, statut: "En circulation" },
      { immatriculation: "LT 4522 AB", modele: "Nissan Patrol", conducteur: "Bertrand Fokou", valeurVenale: 22_000_000, statut: "En circulation" },
    ],
  },
];
