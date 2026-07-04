export const mockComptesBancaires = [
  { id: "CPT-001", banque: "BGFI Bank", pays: "Gabon", devise: "XAF", solde: 87_400_000 },
  { id: "CPT-002", banque: "Ecobank", pays: "Côte d'Ivoire", devise: "XOF", solde: 112_800_000 },
  { id: "CPT-003", banque: "Société Générale", pays: "Cameroun", devise: "XAF", solde: 64_200_000 },
  { id: "CPT-004", banque: "Orabank", pays: "Togo", devise: "XOF", solde: 22_900_000 },
];

export const mockFluxTresorerie = [
  { date: "31/10/2024", libelle: "Encaissement prime — MTN Cameroun", type: "Encaissement", montant: 98_000_000, rapproche: true },
  { date: "30/10/2024", libelle: "Reversement commissions — ACTIVA", type: "Décaissement", montant: 8_208_000, rapproche: true },
  { date: "29/10/2024", libelle: "Règlement sinistre SIN-2024-0448", type: "Décaissement", montant: 8_600_000, rapproche: false },
  { date: "28/10/2024", libelle: "Encaissement prime — Groupe CFAO", type: "Encaissement", montant: 45_200_000, rapproche: true },
  { date: "27/10/2024", libelle: "Frais bancaires internationaux", type: "Décaissement", montant: 340_000, rapproche: false },
  { date: "25/10/2024", libelle: "Encaissement Mobile Money — Particuliers", type: "Encaissement", montant: 3_150_000, rapproche: true },
];
