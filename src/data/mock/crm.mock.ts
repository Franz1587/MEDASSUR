export const mockProspects = [
  { id: "PRO-2024-401", nom: "Total Energies Gabon", type: "Entreprise", source: "Salon Assurance Libreville", etape: "Nouveau", valeurEstimee: 65_000_000, commercial: "Cécile Koné", dernierContact: "02/11/2024" },
  { id: "PRO-2024-402", nom: "Ibrahim Diallo", type: "Particulier", source: "Recommandation", etape: "Qualifié", valeurEstimee: 950_000, commercial: "Cécile Koné", dernierContact: "30/10/2024" },
  { id: "PRO-2024-403", nom: "Bolloré Transport & Logistics", type: "Entreprise", source: "Site web", etape: "Proposition envoyée", valeurEstimee: 38_000_000, commercial: "Nadège Fotso", dernierContact: "28/10/2024" },
  { id: "PRO-2024-404", nom: "Clinique La Providence", type: "Entreprise", source: "Appel entrant", etape: "Négociation", valeurEstimee: 22_500_000, commercial: "Nadège Fotso", dernierContact: "25/10/2024" },
  { id: "PRO-2024-395", nom: "Ecobank Sénégal", type: "Entreprise", source: "Partenariat courtier", etape: "Gagné", valeurEstimee: 54_000_000, commercial: "Cécile Koné", dernierContact: "18/10/2024" },
  { id: "PRO-2024-390", nom: "Aminata Cissé", type: "Particulier", source: "Réseaux sociaux", etape: "Perdu", valeurEstimee: 620_000, commercial: "Nadège Fotso", dernierContact: "10/10/2024" },
];

export const crmKanban: Record<string, string[]> = {
  "Nouveau": ["PRO-2024-401"],
  "Qualifié": ["PRO-2024-402"],
  "Proposition envoyée": ["PRO-2024-403"],
  "Négociation": ["PRO-2024-404"],
  "Gagné": ["PRO-2024-395"],
  "Perdu": ["PRO-2024-390"],
};
