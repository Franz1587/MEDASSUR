export const mockImpayes = [
  { id: "IMP-2024-204", client: "SEEG", contrat: "CTR-2024-005", montantDu: 8_166_000, joursRetard: 8, niveau: "Relance 1", canal: "Mobile Money", statut: "En cours" },
  { id: "IMP-2024-199", client: "BGFI Bank Gabon", contrat: "CTR-2024-004", montantDu: 2_716_000, joursRetard: 5, niveau: "Relance 1", canal: "Email", statut: "Résolu" },
];

export const recouvrementKanban: Record<string, string[]> = {
  "Relance 1": ["IMP-2024-204", "IMP-2024-199"],
  "Relance 2": [],
  "Mise en demeure": [],
  "Contentieux": [],
};
