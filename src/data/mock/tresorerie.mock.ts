export const mockComptesBancaires = [
  { id: "CPT-001", banque: "BGFI Bank", pays: "Gabon", devise: "FCFA", solde: 87_400_000 },
  { id: "CPT-002", banque: "UGB", pays: "Gabon", devise: "FCFA", solde: 112_800_000 },
  { id: "CPT-003", banque: "Ecobank Gabon", pays: "Gabon", devise: "FCFA", solde: 64_200_000 },
  { id: "CPT-004", banque: "BICIG", pays: "Gabon", devise: "FCFA", solde: 22_900_000 },
];

export const mockFluxTresorerie = [
  { id: "flx-1", date: "31/10/2024", libelle: "Encaissement prime — SEEG", type: "Encaissement", montant: 98_000_000, rapproche: true },
  { id: "flx-2", date: "30/10/2024", libelle: "Reversement commissions — OGAR", type: "Décaissement", montant: 8_208_000, rapproche: true },
  { id: "flx-3", date: "28/10/2024", libelle: "Encaissement prime — SOGARA", type: "Encaissement", montant: 45_200_000, rapproche: true },
  { id: "flx-4", date: "27/10/2024", libelle: "Frais bancaires", type: "Décaissement", montant: 340_000, rapproche: false },
  { id: "flx-5", date: "25/10/2024", libelle: "Encaissement Mobile Money — Particuliers", type: "Encaissement", montant: 3_150_000, rapproche: true },
];
