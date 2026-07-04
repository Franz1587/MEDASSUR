export const mockImpayes = [
  { id: "IMP-2024-201", client: "Kofi Asante", contrat: "CTR-2023-089", montantDu: 450_000, joursRetard: 45, niveau: "Mise en demeure", canal: "Appel", statut: "En cours" },
  { id: "IMP-2024-202", client: "Fatou Sow", contrat: "CTR-2024-007", montantDu: 320_000, joursRetard: 12, niveau: "Relance 1", canal: "SMS", statut: "En cours" },
  { id: "IMP-2024-203", client: "SOGEA-SATOM CI", contrat: "CTR-2024-006", montantDu: 4_625_000, joursRetard: 30, niveau: "Relance 2", canal: "Email", statut: "En cours" },
  { id: "IMP-2024-204", client: "MTN Cameroun", contrat: "CTR-2024-005", montantDu: 8_166_000, joursRetard: 8, niveau: "Relance 1", canal: "Mobile Money", statut: "En cours" },
  { id: "IMP-2024-198", client: "Marie-Claire Diallo", contrat: "CTR-2024-003", montantDu: 85_000, joursRetard: 60, niveau: "Contentieux", canal: "Avocat", statut: "Transmis" },
  { id: "IMP-2024-199", client: "BGFI Bank Gabon", contrat: "CTR-2024-004", montantDu: 2_716_000, joursRetard: 5, niveau: "Relance 1", canal: "Email", statut: "Résolu" },
];

export const recouvrementKanban: Record<string, string[]> = {
  "Relance 1": ["IMP-2024-202", "IMP-2024-204", "IMP-2024-199"],
  "Relance 2": ["IMP-2024-203"],
  "Mise en demeure": ["IMP-2024-201"],
  "Contentieux": ["IMP-2024-198"],
};
