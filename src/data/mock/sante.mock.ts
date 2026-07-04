export const assuresSante = [
  { id: "ASS-001", nom: "Paul Nguesso", matricule: "MTN-CM-00234", police: "CTR-2024-005", benef: 4, cotisation: 185_000, statut: "Actif" },
  { id: "ASS-002", nom: "Yvette Koffi", matricule: "MTN-CM-00235", police: "CTR-2024-005", benef: 3, cotisation: 142_000, statut: "Actif" },
  { id: "ASS-003", nom: "Bernard Atangana", matricule: "MTN-CM-00236", police: "CTR-2024-005", benef: 2, cotisation: 98_000, statut: "Suspendu" },
];

export const priseEnCharges = [
  { id: "PC-2024-0234", assure: "Paul Nguesso", prestataire: "Hôpital Général Yaoundé", type: "Hospitalisation", montant: 3_800_000, statut: "Accordé", date: "10/10/2024" },
  { id: "PC-2024-0233", assure: "Yvette Koffi", prestataire: "Clinique des Eaux-Claires", type: "Consultation", montant: 45_000, statut: "Remboursé", date: "08/10/2024" },
  { id: "PC-2024-0232", assure: "Ibrahim Diallo", prestataire: "Pharmacie Centrale Dakar", type: "Pharmacie", montant: 78_000, statut: "Accordé", date: "07/10/2024" },
];
