import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "courteva2024";

// Mirrors src/auth/mockUsers.ts on the frontend so the same 19 demo
// personas can eventually log in against the real API.
const mockUsers = [
  { roleId: "administrateur", nom: "Aristide Bengono", email: "a.bengono@courteva.cm", initiales: "AB" },
  { roleId: "direction_generale", nom: "Hélène Mvondo", email: "h.mvondo@courteva.cm", initiales: "HM" },
  { roleId: "directeur_technique", nom: "Serge Ondoa", email: "s.ondoa@courteva.cm", initiales: "SO" },
  { roleId: "gestionnaire_production", nom: "Eric Kabila", email: "e.kabila@courteva.cm", initiales: "EK" },
  { roleId: "gestionnaire_sinistres", nom: "Solange Abiodun", email: "s.abiodun@courteva.cm", initiales: "SA" },
  { roleId: "gestionnaire_sante", nom: "Grace Etoundi", email: "g.etoundi@courteva.cm", initiales: "GE" },
  { roleId: "gestionnaire_vie", nom: "Michel Ngoy", email: "m.ngoy@courteva.cm", initiales: "MN" },
  { roleId: "gestionnaire_flotte", nom: "David Amougou", email: "d.amougou@courteva.cm", initiales: "DA" },
  { roleId: "gestionnaire_entreprises", nom: "Julie Tchamba", email: "j.tchamba@courteva.cm", initiales: "JT" },
  { roleId: "comptable", nom: "Théodore Nguema", email: "t.nguema@courteva.cm", initiales: "TN" },
  { roleId: "commercial", nom: "Cécile Koné", email: "c.kone@courteva.cm", initiales: "CK" },
  { roleId: "agent_recouvrement", nom: "Bruno Kamga", email: "b.kamga@courteva.cm", initiales: "BK" },
  { roleId: "courtier_partenaire", nom: "Cabinet Alpha Courtage", email: "contact@alpha-courtage.ci", initiales: "AC" },
  { roleId: "compagnie_assurance", nom: "ACTIVA Assurances", email: "partenaires@activa-assurances.cm", initiales: "AA" },
  { roleId: "prestataire_sante", nom: "Hôpital Général Yaoundé", email: "facturation@hgy.cm", initiales: "HG" },
  { roleId: "expert_auto", nom: "Cabinet Expertise Motors", email: "contact@expertise-motors.ci", initiales: "EM" },
  { roleId: "expert_sinistres", nom: "Cabinet Alpha Expertise", email: "contact@alpha-expertise.cm", initiales: "AE" },
  { roleId: "client_particulier", nom: "Marie-Claire Diallo", email: "mc.diallo@gmail.com", initiales: "MD" },
  { roleId: "client_entreprise", nom: "SABC SA", email: "assurances@sabc.cm", initiales: "SS" },
];

const clients = [
  { id: "CLI-001", nom: "SABC SA", type: "Entreprise", pays: "Cameroun", contact: "Jean-Pierre Mballa", tel: "+237 699 123 456", email: "jp.mballa@sabc.cm", statut: "Actif" },
  { id: "CLI-002", nom: "Groupe CFAO", type: "Entreprise", pays: "Côte d'Ivoire", contact: "Amadou Konaté", tel: "+225 07 12 34 56", email: "a.konate@cfao.ci", statut: "Actif" },
  { id: "CLI-003", nom: "Marie-Claire Diallo", type: "Particulier", pays: "Sénégal", contact: "Marie-Claire Diallo", tel: "+221 77 456 78 90", email: "mc.diallo@gmail.com", statut: "Actif" },
  { id: "CLI-004", nom: "BGFI Bank Gabon", type: "Entreprise", pays: "Gabon", contact: "Henri Obiang", tel: "+241 06 78 90 12", email: "h.obiang@bgfibank.ga", statut: "Actif" },
  { id: "CLI-005", nom: "Kofi Asante", type: "Particulier", pays: "Togo", contact: "Kofi Asante", tel: "+228 90 12 34 56", email: "k.asante@yahoo.fr", statut: "Inactif" },
  { id: "CLI-006", nom: "MTN Cameroun", type: "Entreprise", pays: "Cameroun", contact: "Patricia Nguemo", tel: "+237 677 234 567", email: "p.nguemo@mtn.cm", statut: "Actif" },
  { id: "CLI-007", nom: "Fatou Sow", type: "Particulier", pays: "Sénégal", contact: "Fatou Sow", tel: "+221 76 345 67 89", email: "f.sow@hotmail.fr", statut: "Actif" },
  { id: "CLI-008", nom: "SOGEA-SATOM CI", type: "Entreprise", pays: "Côte d'Ivoire", contact: "Luc Koffi Mensah", tel: "+225 05 23 45 67", email: "l.mensah@sogea.ci", statut: "Actif" },
];

const compagnies = [
  { id: "CMP-001", nom: "ACTIVA Assurances", pays: "Cameroun", taux: "12%", niveau: "Premium" },
  { id: "CMP-002", nom: "NSIA Assurances", pays: "Côte d'Ivoire", taux: "10%", niveau: "Standard" },
  { id: "CMP-003", nom: "AXA Côte d'Ivoire", pays: "Côte d'Ivoire", taux: "11%", niveau: "Premium" },
  { id: "CMP-004", nom: "Allianz Sénégal", pays: "Sénégal", taux: "10%", niveau: "Standard" },
  { id: "CMP-005", nom: "COLINA Assurances", pays: "Côte d'Ivoire", taux: "9%", niveau: "Standard" },
  { id: "CMP-006", nom: "SANLAM Africa", pays: "Pan-Africain", taux: "8%", niveau: "Standard" },
  { id: "CMP-007", nom: "NSIA Vie", pays: "Côte d'Ivoire", taux: "9%", niveau: "Standard" },
  { id: "CMP-008", nom: "UAM Togo", pays: "Togo", taux: "10%", niveau: "Standard" },
];

const contrats = [
  { id: "CTR-2024-001", clientNom: "SABC SA", branche: "Flotte Auto", compagnieNom: "ACTIVA Assurances", dateDebut: "01/01/2024", dateFin: "31/12/2024", prime: 28_500_000, statut: "Actif" },
  { id: "CTR-2024-002", clientNom: "Groupe CFAO", branche: "IARD", compagnieNom: "AXA Côte d'Ivoire", dateDebut: "01/03/2024", dateFin: "28/02/2025", prime: 45_200_000, statut: "Actif" },
  { id: "CTR-2024-003", clientNom: "Marie-Claire Diallo", branche: "Automobile", compagnieNom: "Allianz Sénégal", dateDebut: "15/06/2024", dateFin: "14/06/2025", prime: 850_000, statut: "Actif" },
  { id: "CTR-2024-004", clientNom: "BGFI Bank Gabon", branche: "Santé Collective", compagnieNom: "NSIA Vie", dateDebut: "01/01/2024", dateFin: "31/12/2024", prime: 32_600_000, statut: "En renouvellement" },
  { id: "CTR-2024-005", clientNom: "MTN Cameroun", branche: "Santé Collective", compagnieNom: "COLINA Assurances", dateDebut: "01/04/2024", dateFin: "31/03/2025", prime: 98_000_000, statut: "Actif" },
  { id: "CTR-2023-089", clientNom: "Kofi Asante", branche: "Automobile", compagnieNom: "UAM Togo", dateDebut: "01/07/2023", dateFin: "30/06/2024", prime: 450_000, statut: "Expiré" },
  { id: "CTR-2024-006", clientNom: "SOGEA-SATOM CI", branche: "RC Professionnelle", compagnieNom: "AXA Côte d'Ivoire", dateDebut: "01/02/2024", dateFin: "31/01/2025", prime: 18_500_000, statut: "Actif" },
];

const devis = [
  {
    id: "DEV-2024-501", clientNom: "SABC SA", branche: "Flotte Auto", primeEstimee: 29_900_000, dateCreation: "22/10/2024", validite: "22/11/2024", statut: "Envoyé",
    offres: [{ compagnieNom: "ACTIVA Assurances", prime: 29_900_000 }, { compagnieNom: "AXA Côte d'Ivoire", prime: 31_200_000 }],
  },
  {
    id: "DEV-2024-502", clientNom: "Fatou Sow", branche: "Habitation", primeEstimee: 210_000, dateCreation: "25/10/2024", validite: "25/11/2024", statut: "Brouillon",
    offres: [{ compagnieNom: "Allianz Sénégal", prime: 210_000 }],
  },
  {
    id: "DEV-2024-498", clientNom: "Groupe CFAO", branche: "RC Professionnelle", primeEstimee: 19_800_000, dateCreation: "10/10/2024", validite: "10/11/2024", statut: "Accepté",
    offres: [{ compagnieNom: "AXA Côte d'Ivoire", prime: 19_800_000 }, { compagnieNom: "NSIA Assurances", prime: 21_400_000 }, { compagnieNom: "SANLAM Africa", prime: 20_100_000 }],
  },
  {
    id: "DEV-2024-499", clientNom: "Kofi Asante", branche: "Automobile", primeEstimee: 480_000, dateCreation: "12/10/2024", validite: "12/11/2024", statut: "Refusé",
    offres: [{ compagnieNom: "UAM Togo", prime: 480_000 }],
  },
  {
    id: "DEV-2024-495", clientNom: "BGFI Bank Gabon", branche: "Santé Collective", primeEstimee: 35_100_000, dateCreation: "28/09/2024", validite: "28/10/2024", statut: "Expiré",
    offres: [{ compagnieNom: "NSIA Vie", prime: 35_100_000 }, { compagnieNom: "COLINA Assurances", prime: 36_800_000 }],
  },
];

const renouvellements = [
  { id: "REN-2024-014", contratId: "CTR-2024-004", joursRestants: 15, primeActuelle: 32_600_000, primeProposee: 34_800_000, sinistralite: "62%", statut: "À renouveler" },
  { id: "REN-2024-015", contratId: "CTR-2024-001", joursRestants: 15, primeActuelle: 28_500_000, primeProposee: 29_900_000, sinistralite: "41%", statut: "Relancé" },
  { id: "REN-2023-241", contratId: "CTR-2023-089", joursRestants: -8, primeActuelle: 450_000, primeProposee: 480_000, sinistralite: "12%", statut: "Perdu" },
  { id: "REN-2024-016", contratId: "CTR-2024-006", joursRestants: 60, primeActuelle: 18_500_000, primeProposee: 18_500_000, sinistralite: "8%", statut: "À renouveler" },
  { id: "REN-2024-013", contratId: "CTR-2024-002", joursRestants: 90, primeActuelle: 45_200_000, primeProposee: 45_200_000, sinistralite: "35%", statut: "Renouvelé" },
  { id: "REN-2024-012", contratId: "CTR-2024-005", joursRestants: 120, primeActuelle: 98_000_000, primeProposee: 102_500_000, sinistralite: "58%", statut: "À renouveler" },
];

const avenants = [
  { id: "AVN-2024-072", contratId: "CTR-2024-001", type: "Véhicule", description: "Ajout de 3 véhicules à la flotte (immatriculations M-YB 112/113/114 CE)", primeAvant: 28_500_000, primeApres: 31_200_000, dateEffet: "01/11/2024", statut: "Appliqué" },
  { id: "AVN-2024-073", contratId: "CTR-2024-005", type: "Bénéficiaire", description: "Ajout de 12 nouveaux collaborateurs à la couverture santé", primeAvant: 98_000_000, primeApres: 104_600_000, dateEffet: "01/11/2024", statut: "Validé" },
  { id: "AVN-2024-074", contratId: "CTR-2024-004", type: "Garantie", description: "Extension évacuation sanitaire zone CEMAC", primeAvant: 32_600_000, primeApres: 35_100_000, dateEffet: "15/11/2024", statut: "Brouillon" },
  { id: "AVN-2024-070", contratId: "CTR-2024-002", type: "Capital", description: "Révision capital RC exploitation à 500M XAF", primeAvant: 45_200_000, primeApres: 48_900_000, dateEffet: "01/10/2024", statut: "Appliqué" },
  { id: "AVN-2024-071", contratId: "CTR-2024-006", type: "Adresse", description: "Changement de chantier assuré — Bassam V vers Yamoussoukro", primeAvant: 18_500_000, primeApres: 18_500_000, dateEffet: "05/10/2024", statut: "Appliqué" },
];

const resiliations = [
  { id: "RES-2024-031", contratId: "CTR-2023-089", motif: "Non-paiement", dateEffet: "30/06/2024", ristourne: 0, initiateur: "Compagnie", statut: "Effective" },
  { id: "RES-2024-032", contratId: "CTR-2024-003", motif: "Vente du véhicule", dateEffet: "20/11/2024", ristourne: 210_000, initiateur: "Client", statut: "Validée" },
  { id: "RES-2024-030", contratId: "CTR-2024-006", motif: "Fin de chantier anticipée", dateEffet: "15/10/2024", ristourne: 4_200_000, initiateur: "Client", statut: "Effective" },
];

const sinistres = [
  { id: "SIN-2024-0451", clientNom: "SABC SA", branche: "Flotte Auto", date: "15/10/2024", description: "Collision véhicule M-YA 234 CE", montant: 4_500_000, statut: "Expert. en cours", priorite: "Haute" },
  { id: "SIN-2024-0452", clientNom: "Fatou Sow", branche: "Automobile", date: "18/10/2024", description: "Vol partiel — pièces moteur", montant: 1_200_000, statut: "Déclaré", priorite: "Normal" },
  { id: "SIN-2024-0450", clientNom: "Groupe CFAO", branche: "IARD", date: "12/10/2024", description: "Incendie entrepôt Cocody II", montant: 125_000_000, statut: "Expertise", priorite: "Urgent" },
  { id: "SIN-2024-0449", clientNom: "MTN Cameroun", branche: "Santé", date: "10/10/2024", description: "Hospitalisation — P. Essomba", montant: 3_800_000, statut: "Remboursé", priorite: "Normal" },
  { id: "SIN-2024-0448", clientNom: "SOGEA-SATOM CI", branche: "RC Pro", date: "08/10/2024", description: "Accident chantier Bassam V", montant: 8_600_000, statut: "Recours", priorite: "Haute" },
  { id: "SIN-2024-0447", clientNom: "BGFI Bank Gabon", branche: "IARD", date: "05/10/2024", description: "Dégâts des eaux — bureau DG", montant: 2_100_000, statut: "Clôturé", priorite: "Normal" },
];

const assures = [
  { id: "ASS-001", nom: "Paul Nguesso", matricule: "MTN-CM-00234", contratId: "CTR-2024-005", beneficiaires: 4, cotisation: 185_000, statut: "Actif" },
  { id: "ASS-002", nom: "Yvette Koffi", matricule: "MTN-CM-00235", contratId: "CTR-2024-005", beneficiaires: 3, cotisation: 142_000, statut: "Actif" },
  { id: "ASS-003", nom: "Bernard Atangana", matricule: "MTN-CM-00236", contratId: "CTR-2024-005", beneficiaires: 2, cotisation: 98_000, statut: "Suspendu" },
  { id: "ASS-004", nom: "Ibrahim Diallo", matricule: "MTN-CM-00237", contratId: "CTR-2024-005", beneficiaires: 1, cotisation: 76_000, statut: "Actif" },
];

const prisesEnCharge = [
  { id: "PC-2024-0234", assureNom: "Paul Nguesso", prestataire: "Hôpital Général Yaoundé", type: "Hospitalisation", montant: 3_800_000, statut: "Accordé", date: "10/10/2024" },
  { id: "PC-2024-0233", assureNom: "Yvette Koffi", prestataire: "Clinique des Eaux-Claires", type: "Consultation", montant: 45_000, statut: "Remboursé", date: "08/10/2024" },
  { id: "PC-2024-0232", assureNom: "Ibrahim Diallo", prestataire: "Pharmacie Centrale Dakar", type: "Pharmacie", montant: 78_000, statut: "Accordé", date: "07/10/2024" },
];

const commissions = [
  { id: "COM-2024-1001", compagnieNom: "ACTIVA Assurances", periode: "Octobre 2024", primeEncaissee: 68_400_000, tauxCommission: "12%", montantCommission: 8_208_000, statut: "Reversé" },
  { id: "COM-2024-1002", compagnieNom: "AXA Côte d'Ivoire", periode: "Octobre 2024", primeEncaissee: 63_700_000, tauxCommission: "11%", montantCommission: 7_007_000, statut: "En attente" },
  { id: "COM-2024-1003", compagnieNom: "NSIA Assurances", periode: "Octobre 2024", primeEncaissee: 32_600_000, tauxCommission: "10%", montantCommission: 3_260_000, statut: "À reverser" },
  { id: "COM-2024-1004", compagnieNom: "COLINA Assurances", periode: "Octobre 2024", primeEncaissee: 98_000_000, tauxCommission: "9%", montantCommission: 8_820_000, statut: "Reversé" },
  { id: "COM-2024-1005", compagnieNom: "Allianz Sénégal", periode: "Octobre 2024", primeEncaissee: 850_000, tauxCommission: "10%", montantCommission: 85_000, statut: "Reversé" },
  { id: "COM-2024-1006", compagnieNom: "SANLAM Africa", periode: "Octobre 2024", primeEncaissee: 12_400_000, tauxCommission: "8%", montantCommission: 992_000, statut: "À reverser" },
];

const comptesBancaires = [
  { id: "CPT-001", banque: "BGFI Bank", pays: "Gabon", devise: "XAF", solde: 87_400_000 },
  { id: "CPT-002", banque: "Ecobank", pays: "Côte d'Ivoire", devise: "XOF", solde: 112_800_000 },
  { id: "CPT-003", banque: "Société Générale", pays: "Cameroun", devise: "XAF", solde: 64_200_000 },
  { id: "CPT-004", banque: "Orabank", pays: "Togo", devise: "XOF", solde: 22_900_000 },
];

const fluxTresorerie = [
  { date: "31/10/2024", libelle: "Encaissement prime — MTN Cameroun", type: "Encaissement", montant: 98_000_000, rapproche: true },
  { date: "30/10/2024", libelle: "Reversement commissions — ACTIVA", type: "Décaissement", montant: 8_208_000, rapproche: true },
  { date: "29/10/2024", libelle: "Règlement sinistre SIN-2024-0448", type: "Décaissement", montant: 8_600_000, rapproche: false },
  { date: "28/10/2024", libelle: "Encaissement prime — Groupe CFAO", type: "Encaissement", montant: 45_200_000, rapproche: true },
  { date: "27/10/2024", libelle: "Frais bancaires internationaux", type: "Décaissement", montant: 340_000, rapproche: false },
  { date: "25/10/2024", libelle: "Encaissement Mobile Money — Particuliers", type: "Encaissement", montant: 3_150_000, rapproche: true },
];

const impayes = [
  { id: "IMP-2024-201", clientNom: "Kofi Asante", contratId: "CTR-2023-089", montantDu: 450_000, joursRetard: 45, niveau: "Mise en demeure", canal: "Appel", statut: "En cours" },
  { id: "IMP-2024-202", clientNom: "Fatou Sow", contratId: "CTR-2024-006", montantDu: 320_000, joursRetard: 12, niveau: "Relance 1", canal: "SMS", statut: "En cours" },
  { id: "IMP-2024-203", clientNom: "SOGEA-SATOM CI", contratId: "CTR-2024-006", montantDu: 4_625_000, joursRetard: 30, niveau: "Relance 2", canal: "Email", statut: "En cours" },
  { id: "IMP-2024-204", clientNom: "MTN Cameroun", contratId: "CTR-2024-005", montantDu: 8_166_000, joursRetard: 8, niveau: "Relance 1", canal: "Mobile Money", statut: "En cours" },
  { id: "IMP-2024-198", clientNom: "Marie-Claire Diallo", contratId: "CTR-2024-003", montantDu: 85_000, joursRetard: 60, niveau: "Contentieux", canal: "Avocat", statut: "Transmis" },
  { id: "IMP-2024-199", clientNom: "BGFI Bank Gabon", contratId: "CTR-2024-004", montantDu: 2_716_000, joursRetard: 5, niveau: "Relance 1", canal: "Email", statut: "Résolu" },
];

const prospects = [
  { id: "PRO-2024-401", nom: "Total Energies Gabon", type: "Entreprise", source: "Salon Assurance Libreville", etape: "Nouveau", valeurEstimee: 65_000_000, commercial: "Cécile Koné", dernierContact: "02/11/2024" },
  { id: "PRO-2024-402", nom: "Ibrahim Diallo", type: "Particulier", source: "Recommandation", etape: "Qualifié", valeurEstimee: 950_000, commercial: "Cécile Koné", dernierContact: "30/10/2024" },
  { id: "PRO-2024-403", nom: "Bolloré Transport & Logistics", type: "Entreprise", source: "Site web", etape: "Proposition envoyée", valeurEstimee: 38_000_000, commercial: "Nadège Fotso", dernierContact: "28/10/2024" },
  { id: "PRO-2024-404", nom: "Clinique La Providence", type: "Entreprise", source: "Appel entrant", etape: "Négociation", valeurEstimee: 22_500_000, commercial: "Nadège Fotso", dernierContact: "25/10/2024" },
  { id: "PRO-2024-395", nom: "Ecobank Sénégal", type: "Entreprise", source: "Partenariat courtier", etape: "Gagné", valeurEstimee: 54_000_000, commercial: "Cécile Koné", dernierContact: "18/10/2024" },
  { id: "PRO-2024-390", nom: "Aminata Cissé", type: "Particulier", source: "Réseaux sociaux", etape: "Perdu", valeurEstimee: 620_000, commercial: "Nadège Fotso", dernierContact: "10/10/2024" },
];

const policesIard = [
  { id: "IRD-2024-101", clientNom: "SABC SA", sousBranche: "Incendie", compagnieNom: "ACTIVA Assurances", capitalAssure: 850_000_000, prime: 6_200_000, statut: "Actif" },
  { id: "IRD-2024-102", clientNom: "Marie-Claire Diallo", sousBranche: "MRH", compagnieNom: "Allianz Sénégal", capitalAssure: 45_000_000, prime: 180_000, statut: "Actif" },
  { id: "IRD-2024-103", clientNom: "Groupe CFAO", sousBranche: "MRP", compagnieNom: "AXA Côte d'Ivoire", capitalAssure: 1_200_000_000, prime: 14_500_000, statut: "Actif" },
  { id: "IRD-2024-104", clientNom: "SOGEA-SATOM CI", sousBranche: "Transport", compagnieNom: "NSIA Assurances", capitalAssure: 320_000_000, prime: 3_800_000, statut: "Actif" },
  { id: "IRD-2024-105", clientNom: "SOGEA-SATOM CI", sousBranche: "TRC/TRME", compagnieNom: "AXA Côte d'Ivoire", capitalAssure: 2_400_000_000, prime: 21_600_000, statut: "Actif" },
  { id: "IRD-2024-106", clientNom: "Groupe CFAO", sousBranche: "RC", compagnieNom: "AXA Côte d'Ivoire", capitalAssure: 500_000_000, prime: 4_890_000, statut: "Actif" },
  { id: "IRD-2024-107", clientNom: "MTN Cameroun", sousBranche: "Cyber-risques", compagnieNom: "COLINA Assurances", capitalAssure: 1_000_000_000, prime: 18_200_000, statut: "En renouvellement" },
  { id: "IRD-2024-108", clientNom: "BGFI Bank Gabon", sousBranche: "Bris de Machine", compagnieNom: "NSIA Vie", capitalAssure: 180_000_000, prime: 2_100_000, statut: "Actif" },
];

const contratsVie = [
  {
    id: "VIE-2024-301", assure: "Jean-Pierre Mballa", produit: "Vie entière", compagnieNom: "NSIA Vie",
    capitalGaranti: 25_000_000, primeAnnuelle: 620_000, dateEffet: "01/01/2020", statut: "Actif",
    beneficiaires: [{ nom: "Chantal Mballa", lien: "Conjointe", quotePart: 60 }, { nom: "Junior Mballa", lien: "Enfant", quotePart: 40 }],
  },
  {
    id: "VIE-2024-302", assure: "Patricia Nguemo", produit: "Prévoyance collective", compagnieNom: "COLINA Assurances",
    capitalGaranti: 15_000_000, primeAnnuelle: 245_000, dateEffet: "01/04/2023", statut: "Actif",
    beneficiaires: [{ nom: "Ayants droit désignés", lien: "Famille", quotePart: 100 }],
  },
  {
    id: "VIE-2024-303", assure: "Henri Obiang", produit: "Retraite", compagnieNom: "NSIA Vie",
    capitalGaranti: 40_000_000, primeAnnuelle: 1_800_000, dateEffet: "01/06/2018", statut: "Actif",
    beneficiaires: [{ nom: "Henri Obiang", lien: "Souscripteur", quotePart: 100 }],
  },
  {
    id: "VIE-2024-304", assure: "Amadou Konaté", produit: "Décès Invalidité", compagnieNom: "AXA Côte d'Ivoire",
    capitalGaranti: 30_000_000, primeAnnuelle: 410_000, dateEffet: "01/09/2021", statut: "Suspendu",
    beneficiaires: [
      { nom: "Aïcha Konaté", lien: "Conjointe", quotePart: 50 },
      { nom: "Moussa Konaté", lien: "Enfant", quotePart: 25 },
      { nom: "Fanta Konaté", lien: "Enfant", quotePart: 25 },
    ],
  },
  {
    id: "VIE-2024-305", assure: "Yvette Koffi", produit: "Épargne", compagnieNom: "SANLAM Africa",
    capitalGaranti: 8_500_000, primeAnnuelle: 600_000, dateEffet: "01/02/2022", statut: "Actif",
    beneficiaires: [{ nom: "Yvette Koffi", lien: "Souscriptrice", quotePart: 100 }],
  },
];

const flottes = [
  {
    id: "FLT-2024-01", clientNom: "SABC SA", contratId: "CTR-2024-001", compagnieNom: "ACTIVA Assurances",
    nbVehicules: 15, primeTotal: 28_500_000, statut: "Actif",
    vehicules: [
      { immatriculation: "M-YA 234 CE", modele: "Toyota Hilux", conducteur: "Ndongo Ateba", valeurVenale: 18_500_000, statut: "En circulation" },
      { immatriculation: "M-YB 112 CE", modele: "Toyota Hiace", conducteur: "Paul Essomba", valeurVenale: 14_200_000, statut: "En circulation" },
      { immatriculation: "M-YB 113 CE", modele: "Toyota Hiace", conducteur: "Simon Biya", valeurVenale: 14_200_000, statut: "Immobilisé" },
    ],
  },
  {
    id: "FLT-2024-02", clientNom: "MTN Cameroun", contratId: "CTR-2024-005", compagnieNom: "COLINA Assurances",
    nbVehicules: 22, primeTotal: 42_000_000, statut: "Actif",
    vehicules: [
      { immatriculation: "LT 4521 AB", modele: "Nissan Patrol", conducteur: "Achille Mengue", valeurVenale: 22_000_000, statut: "En circulation" },
      { immatriculation: "LT 4522 AB", modele: "Nissan Patrol", conducteur: "Bertrand Fokou", valeurVenale: 22_000_000, statut: "En circulation" },
    ],
  },
];

const journalEntries = [
  { date: "31/10/2024", num: "JNL-001245", libelle: "Primes encaissées — SABC SA", debit: 0, credit: 28_500_000, compte: "701000" },
  { date: "31/10/2024", num: "JNL-001246", libelle: "Commission ACTIVA Assurances — Oct.", debit: 3_420_000, credit: 0, compte: "612000" },
  { date: "30/10/2024", num: "JNL-001244", libelle: "Reversement primes — AXA CI", debit: 0, credit: 45_200_000, compte: "401000" },
  { date: "30/10/2024", num: "JNL-001243", libelle: "Règlement sinistre SIN-2024-0448", debit: 8_600_000, credit: 0, compte: "652000" },
  { date: "29/10/2024", num: "JNL-001242", libelle: "Honoraires expertise — Cabinet Alpha", debit: 850_000, credit: 0, compte: "624000" },
  { date: "28/10/2024", num: "JNL-001241", libelle: "Primes encaissées — MTN Cameroun", debit: 0, credit: 98_000_000, compte: "701000" },
];

const gedDocuments = [
  { id: "DOC-2024-1201", nom: "CTR-2024-001_ACTIVA.pdf", type: "Contrat", entiteLiee: "SABC SA", statutOcr: "Analysé", statutSignature: "Signé", tags: ["Flotte Auto", "ACTIVA"], date: "01/01/2024" },
  { id: "DOC-2024-1202", nom: "Attestation_assurance_CFAO.pdf", type: "Attestation", entiteLiee: "Groupe CFAO", statutOcr: "Analysé", statutSignature: "N/A", tags: ["IARD"], date: "03/03/2024" },
  { id: "DOC-2024-1203", nom: "Facture_expertise_SIN-0448.pdf", type: "Facture", entiteLiee: "SIN-2024-0448", statutOcr: "Analysé", statutSignature: "N/A", tags: ["Sinistre", "Expertise"], date: "09/10/2024" },
  { id: "DOC-2024-1204", nom: "Scan_permis_conduire_Diallo.jpg", type: "Pièce d'identité", entiteLiee: "Marie-Claire Diallo", statutOcr: "En cours", statutSignature: "N/A", tags: ["KYC"], date: "02/11/2024" },
  { id: "DOC-2024-1205", nom: "Avenant_AVN-2024-073.pdf", type: "Avenant", entiteLiee: "MTN Cameroun", statutOcr: "Analysé", statutSignature: "En attente", tags: ["Santé Collective"], date: "01/11/2024" },
];

async function main() {
  console.log("Seeding CourtEVA+ database…");

  // Wipe in FK-safe order for idempotent re-runs.
  await prisma.priseEnCharge.deleteMany();
  await prisma.assureSante.deleteMany();
  await prisma.vehicule.deleteMany();
  await prisma.flotte.deleteMany();
  await prisma.beneficiaire.deleteMany();
  await prisma.contratVie.deleteMany();
  await prisma.policeIard.deleteMany();
  await prisma.impaye.deleteMany();
  await prisma.resiliation.deleteMany();
  await prisma.avenant.deleteMany();
  await prisma.renouvellement.deleteMany();
  await prisma.devisOffre.deleteMany();
  await prisma.devis.deleteMany();
  await prisma.sinistre.deleteMany();
  await prisma.contrat.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.compteBancaire.deleteMany();
  await prisma.fluxTresorerie.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.gedDocument.deleteMany();
  await prisma.prospect.deleteMany();
  await prisma.client.deleteMany();
  await prisma.compagnie.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.createMany({
    data: mockUsers.map((u) => ({ ...u, passwordHash })),
  });

  await prisma.client.createMany({ data: clients });
  await prisma.compagnie.createMany({ data: compagnies });

  const clientIdByNom = new Map(clients.map((c) => [c.nom, c.id]));
  const compagnieIdByNom = new Map(compagnies.map((c) => [c.nom, c.id]));

  await prisma.contrat.createMany({
    data: contrats.map((c) => ({
      id: c.id, branche: c.branche, dateDebut: c.dateDebut, dateFin: c.dateFin, prime: c.prime, statut: c.statut,
      clientId: clientIdByNom.get(c.clientNom)!, compagnieId: compagnieIdByNom.get(c.compagnieNom)!,
    })),
  });

  for (const d of devis) {
    await prisma.devis.create({
      data: {
        id: d.id, branche: d.branche, primeEstimee: d.primeEstimee, dateCreation: d.dateCreation, validite: d.validite, statut: d.statut,
        clientId: clientIdByNom.get(d.clientNom)!,
        offres: { create: d.offres.map((o) => ({ compagnieNom: o.compagnieNom, prime: o.prime })) },
      },
    });
  }

  await prisma.renouvellement.createMany({ data: renouvellements });
  await prisma.avenant.createMany({ data: avenants });
  await prisma.resiliation.createMany({ data: resiliations });

  await prisma.sinistre.createMany({
    data: sinistres.map((s) => ({
      id: s.id, branche: s.branche, date: s.date, description: s.description, montant: s.montant, statut: s.statut, priorite: s.priorite,
      clientId: clientIdByNom.get(s.clientNom)!,
    })),
  });

  await prisma.assureSante.createMany({ data: assures });
  const assureIdByNom = new Map(assures.map((a) => [a.nom, a.id]));
  await prisma.priseEnCharge.createMany({
    data: prisesEnCharge.map((pc) => ({
      id: pc.id, prestataire: pc.prestataire, type: pc.type, montant: pc.montant, statut: pc.statut, date: pc.date,
      assureId: assureIdByNom.get(pc.assureNom)!,
    })),
  });

  await prisma.commission.createMany({
    data: commissions.map((c) => ({
      id: c.id, periode: c.periode, primeEncaissee: c.primeEncaissee, tauxCommission: c.tauxCommission, montantCommission: c.montantCommission, statut: c.statut,
      compagnieId: compagnieIdByNom.get(c.compagnieNom)!,
    })),
  });

  await prisma.compteBancaire.createMany({ data: comptesBancaires });
  await prisma.fluxTresorerie.createMany({ data: fluxTresorerie });

  await prisma.impaye.createMany({
    data: impayes.map((i) => ({
      id: i.id, montantDu: i.montantDu, joursRetard: i.joursRetard, niveau: i.niveau, canal: i.canal, statut: i.statut,
      clientId: clientIdByNom.get(i.clientNom)!, contratId: i.contratId,
    })),
  });

  await prisma.prospect.createMany({ data: prospects });

  await prisma.policeIard.createMany({
    data: policesIard.map((p) => ({
      id: p.id, sousBranche: p.sousBranche, capitalAssure: p.capitalAssure, prime: p.prime, statut: p.statut,
      clientId: clientIdByNom.get(p.clientNom)!, compagnieId: compagnieIdByNom.get(p.compagnieNom)!,
    })),
  });

  for (const v of contratsVie) {
    await prisma.contratVie.create({
      data: {
        id: v.id, assure: v.assure, produit: v.produit, capitalGaranti: v.capitalGaranti, primeAnnuelle: v.primeAnnuelle, dateEffet: v.dateEffet, statut: v.statut,
        compagnieId: compagnieIdByNom.get(v.compagnieNom)!,
        beneficiaires: { create: v.beneficiaires },
      },
    });
  }

  for (const f of flottes) {
    await prisma.flotte.create({
      data: {
        id: f.id, nbVehicules: f.nbVehicules, primeTotal: f.primeTotal, statut: f.statut,
        clientId: clientIdByNom.get(f.clientNom)!, contratId: f.contratId, compagnieId: compagnieIdByNom.get(f.compagnieNom)!,
        vehicules: { create: f.vehicules },
      },
    });
  }

  await prisma.journalEntry.createMany({ data: journalEntries });
  await prisma.gedDocument.createMany({ data: gedDocuments });

  console.log(`Seed complete: ${mockUsers.length} users (password: ${DEMO_PASSWORD}), ${clients.length} clients, ${compagnies.length} compagnies, ${contrats.length} contrats, and all secondary domains.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
