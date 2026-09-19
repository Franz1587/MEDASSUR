import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { actesMedicaux } from "./seed-actes-medicaux";
import { codesAffection } from "./seed-codes-affection";
import { reseauSoins } from "./seed-reseau-soins";
import { ROLE_MODULES } from "../src/auth/role-modules";
import { ROLE_IDS, type RoleId } from "../src/auth/role.enum";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "medassur2024";
// Mirrors src/prestataires/prestataires.service.ts
// MOT_DE_PASSE_PORTAIL_PRESTATAIRE (2026-09) — tous les comptes portail
// prestataire réels utilisent ce mot de passe fixe, distinct de
// DEMO_PASSWORD ci-dessus. Les comptes de démo prestataire seedés
// ci-dessous doivent s'y aligner (voir src/auth/mockUsers.ts,
// MOT_DE_PASSE_PORTAIL_PRESTATAIRE côté frontend) — sans ça, le mode démo
// "choisir un profil sans mot de passe" échoue pour ces profils.
const MOT_DE_PASSE_PORTAIL_PRESTATAIRE = "passe";

// Mirrors src/auth/mockUsers.ts on the frontend so the same demo
// personas can eventually log in against the real API.
const mockUsers = [
  { roleId: "administrateur", nom: "Aristide Bengono", email: "a.bengono@medassur.ga", initiales: "AB" },
  { roleId: "direction_generale", nom: "Hélène Mvondo", email: "h.mvondo@medassur.ga", initiales: "HM" },
  { roleId: "directeur_technique", nom: "Serge Ondoa", email: "s.ondoa@medassur.ga", initiales: "SO" },
  { roleId: "gestionnaire_production", nom: "Eric Kabila", email: "e.kabila@medassur.ga", initiales: "EK" },
  { roleId: "gestionnaire_sinistres", nom: "Solange Ntsame", email: "s.ntsame@medassur.ga", initiales: "SN" },
  { roleId: "gestionnaire_sante", nom: "Grace Etoundi", email: "g.etoundi@medassur.ga", initiales: "GE" },
  { roleId: "gestionnaire_entreprises", nom: "Julie Tchamba", email: "j.tchamba@medassur.ga", initiales: "JT" },
  { roleId: "comptable", nom: "Théodore Nguema", email: "t.nguema@medassur.ga", initiales: "TN" },
  { roleId: "commercial", nom: "Cécile Ndong", email: "c.ndong@medassur.ga", initiales: "CN" },
  { roleId: "agent_recouvrement", nom: "Bruno Kombila", email: "b.kombila@medassur.ga", initiales: "BK" },
  { roleId: "courtier_partenaire", nom: "Cabinet Ogooué Courtage", email: "contact@ogooue-courtage.ga", initiales: "OC" },
  { roleId: "compagnie_assurance", nom: "OGAR", email: "partenaires@ogar.ga", initiales: "OG" },
  // prestataire_sante (2026-08) — voir plus bas : compte créé séparément,
  // APRÈS la boucle de seed des prestataires (a besoin que PRS-001 existe
  // déjà pour le rattachement User.prestataireId).
  { roleId: "expert_sinistres", nom: "Cabinet Expertise Ogooué", email: "contact@expertise-ogooue.ga", initiales: "EO" },
  // clientId (2026-08) — rattache un compte du portail client à SON Client
  // (voir schema.prisma User.clientId), pour que le portail se cloisonne à
  // ses propres contrats dès le seed. SEEG (CLI-006) sert de compte de
  // démonstration — 2 contrats seedés (Maladie + Assistance) et 8+
  // participants, contrairement à SOGARA qui n'a aucun contrat (voir
  // demande utilisateur : "utiliser plutôt la SEEG à la place de SOGARA").
  { roleId: "client_particulier", nom: "Marielle Obame", email: "marielle.obame@gmail.com", initiales: "MO", clientId: "CLI-003" },
  { roleId: "client_entreprise", nom: "SEEG", email: "portail@seeg.ga", initiales: "SG", clientId: "CLI-006" },
];

const clients = [
  {
    id: "CLI-001", nom: "SOGARA", type: "Entreprise", pays: "Gabon", ville: "Port-Gentil", adresse: "Route de la Raffinerie", boitePostale: "BP 30", contact: "Paul-Marie Ondo", tel: "+241 01 55 23 10", email: "pm.ondo@sogara.ga", statut: "Actif",
    categorieMorale: "Parapublique", formeJuridique: "Société Anonyme", rccm: "RCCM GA-POG-1978-B-045", nif: "740100123", secteurActivite: "Industrie pétrolière", effectif: 850,
    representantNom: "Paul-Marie Ondo", representantFonction: "Directeur des Ressources Humaines", representantTel: "+241 01 55 23 10", representantEmail: "pm.ondo@sogara.ga",
  },
  {
    id: "CLI-002", nom: "Gabon Telecom", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Boulevard Triomphal", boitePostale: "BP 2016", contact: "Patricia Ndong", tel: "+241 01 44 87 32", email: "p.ndong@gabontelecom.ga", statut: "Actif",
    categorieMorale: "Société privée", formeJuridique: "Société Anonyme", rccm: "RCCM GA-LBV-1998-B-891", nif: "740200456", secteurActivite: "Télécommunications", effectif: 1200,
    representantNom: "Patricia Ndong", representantFonction: "Responsable Avantages Sociaux", representantTel: "+241 01 44 87 32", representantEmail: "p.ndong@gabontelecom.ga",
  },
  {
    id: "CLI-003", nom: "Marielle Obame", type: "Particulier", pays: "Gabon", ville: "Libreville", adresse: "Quartier Glass", contact: "Marielle Obame", tel: "+241 06 12 34 56", email: "marielle.obame@gmail.com", statut: "Actif",
    prenom: "Marielle", dateNaissance: "14/03/1988", lieuNaissance: "Libreville", sexe: "F", nationalite: "Gabonaise", situationMatrimoniale: "Célibataire", profession: "Enseignante", employeur: "Ministère de l'Éducation Nationale",
    pieceIdentiteType: "CNI", pieceIdentiteNumero: "GA0198803140012",
  },
  {
    id: "CLI-004", nom: "BGFI Bank Gabon", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Boulevard de l'Indépendance", boitePostale: "BP 2253", contact: "Henri Obiang", tel: "+241 06 78 90 12", email: "h.obiang@bgfibank.ga", statut: "Actif",
    categorieMorale: "Société privée", formeJuridique: "Société Anonyme", rccm: "RCCM GA-LBV-1971-B-012", nif: "740300789", secteurActivite: "Banque & Finance", effectif: 650,
    representantNom: "Henri Obiang", representantFonction: "Directeur des Ressources Humaines", representantTel: "+241 06 78 90 12", representantEmail: "h.obiang@bgfibank.ga",
  },
  {
    id: "CLI-005", nom: "Jean-Claude Nzamba", type: "Particulier", pays: "Gabon", ville: "Libreville", adresse: "Quartier Nzeng-Ayong", contact: "Jean-Claude Nzamba", tel: "+241 07 65 43 21", email: "jc.nzamba@yahoo.fr", statut: "Inactif",
    prenom: "Jean-Claude", dateNaissance: "22/07/1975", lieuNaissance: "Franceville", sexe: "M", nationalite: "Gabonaise", situationMatrimoniale: "Marié", profession: "Consultant indépendant",
    pieceIdentiteType: "CNI", pieceIdentiteNumero: "GA0197507220087",
  },
  {
    id: "CLI-006", nom: "SEEG", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Avenue Colonel Parant", boitePostale: "BP 2187", contact: "Henriette Moussavou", tel: "+241 01 76 23 45", email: "h.moussavou@seeg.ga", statut: "Actif",
    categorieMorale: "Parapublique", formeJuridique: "Société de droit privé à participation publique", rccm: "RCCM GA-LBV-1997-B-033", nif: "740400234", secteurActivite: "Énergie & Eau", effectif: 2100,
    representantNom: "Henriette Moussavou", representantFonction: "Directrice des Ressources Humaines", representantTel: "+241 01 76 23 45", representantEmail: "h.moussavou@seeg.ga",
  },
  {
    id: "CLI-007", nom: "Sylvie Mengue", type: "Particulier", pays: "Gabon", ville: "Port-Gentil", adresse: "Quartier Balise", contact: "Sylvie Mengue", tel: "+241 06 34 56 78", email: "s.mengue@hotmail.fr", statut: "Actif",
    prenom: "Sylvie", dateNaissance: "05/11/1992", lieuNaissance: "Port-Gentil", sexe: "F", nationalite: "Gabonaise", situationMatrimoniale: "Mariée", profession: "Infirmière", employeur: "Clinique El Rapha",
    pieceIdentiteType: "CNI", pieceIdentiteNumero: "GA0199211050156",
  },
  {
    id: "CLI-008", nom: "COMILOG", type: "Entreprise", pays: "Gabon", ville: "Moanda", adresse: "Zone Industrielle", boitePostale: "BP 1", contact: "Luc Obiang", tel: "+241 01 92 34 56", email: "l.obiang@comilog.ga", statut: "Actif",
    categorieMorale: "Société privée", formeJuridique: "Société Anonyme", rccm: "RCCM GA-FCV-1953-B-003", nif: "740500567", secteurActivite: "Mines", effectif: 4200,
    representantNom: "Luc Obiang", representantFonction: "Responsable Protection Sociale", representantTel: "+241 01 92 34 56", representantEmail: "l.obiang@comilog.ga",
  },
  {
    id: "CLI-009", nom: "Ministère de la Santé", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Immeuble du Ministère, Quartier Glass", boitePostale: "BP 50", contact: "Estelle Nguema", tel: "+241 01 76 40 00", email: "cabinet@sante.gouv.ga", statut: "Actif",
    categorieMorale: "Ministère", formeJuridique: "Établissement public", secteurActivite: "Administration publique — Santé", effectif: 3200,
    representantNom: "Estelle Nguema", representantFonction: "Directrice des Ressources Humaines", representantTel: "+241 01 76 40 00", representantEmail: "cabinet@sante.gouv.ga",
  },
  {
    id: "CLI-010", nom: "CNAMGS", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Avenue de Cointet", boitePostale: "BP 1988", contact: "Roger Mba", tel: "+241 01 44 20 20", email: "contact@cnamgs.ga", statut: "Actif",
    categorieMorale: "Organisme", formeJuridique: "Établissement public à caractère social", nif: "740600890", secteurActivite: "Protection sociale", effectif: 480,
    representantNom: "Roger Mba", representantFonction: "Directeur Général Adjoint", representantTel: "+241 01 44 20 20", representantEmail: "contact@cnamgs.ga",
  },
  {
    id: "CLI-011", nom: "Mairie de Libreville", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Place de l'Hôtel de Ville", boitePostale: "BP 22", contact: "Christiane Ella", tel: "+241 01 72 15 30", email: "drh@mairie-libreville.ga", statut: "Actif",
    categorieMorale: "Administration publique", formeJuridique: "Collectivité territoriale", secteurActivite: "Administration communale", effectif: 1650,
    representantNom: "Christiane Ella", representantFonction: "Directrice des Ressources Humaines", representantTel: "+241 01 72 15 30", representantEmail: "drh@mairie-libreville.ga",
  },
  {
    id: "CLI-012", nom: "Association des Femmes Entrepreneures du Gabon", type: "Entreprise", pays: "Gabon", ville: "Libreville", adresse: "Immeuble Diamant, Quartier Louis", contact: "Judith Ovono", tel: "+241 06 55 12 40", email: "contact@afeg.ga", statut: "Actif",
    categorieMorale: "Association", formeJuridique: "Association loi 1901", secteurActivite: "Entrepreneuriat féminin", effectif: 45,
    representantNom: "Judith Ovono", representantFonction: "Présidente", representantTel: "+241 06 55 12 40", representantEmail: "contact@afeg.ga",
  },
];

// plafondFamilialDefaut/limiteAgeAdulteDefaut/limiteAgeEnfantDefaut pour
// CMP-001/002/003 — valeurs réelles extraites de OFFRE SANTE BW ENERGY.pdf
// (pages Proposition Santé de chaque compagnie), servent de pré-remplissage
// à la création d'une cotation Maladie pour ces compagnies.
// `logo` référence des fichiers déjà présents sous backend/uploads/logos/
// (uploadés via CompagnieParamsDrawer lors d'une session antérieure) — sans
// ce champ dans le seed, un reseed efface la référence en base alors que le
// fichier reste sur disque, et le PDF de cotation retombe sur le nom en
// texte au lieu du vrai logo.
const compagnies = [
  { id: "CMP-001", nom: "BGFI ASSURANCES", pays: "Gabon", logo: "CMP-001.png", code: "100", tauxCommissionMaladie: 15.0, tauxCommissionAssistance: 14.5, plafondFamilialDefaut: 30_000_000, limiteAgeAdulteDefaut: 65 },
  { id: "CMP-002", nom: "NSIA ASSURANCES", pays: "Gabon", logo: "CMP-002.png", code: "102", tauxCommissionMaladie: 20.0, tauxCommissionAssistance: 20.0, plafondFamilialDefaut: 50_000_000, limiteAgeEnfantDefaut: 21 },
  { id: "CMP-003", nom: "AXA", pays: "Gabon", logo: "CMP-003.jpg", code: "103", tauxCommissionMaladie: 20.0, tauxCommissionAssistance: 20.0, plafondFamilialDefaut: 20_000_000 },
  { id: "CMP-004", nom: "SUNU ASSURANCES", pays: "Gabon", logo: "CMP-004.jpg", code: "104", tauxCommissionMaladie: 20.0, tauxCommissionAssistance: 20.0 },
  { id: "CMP-005", nom: "SANLAM ALLIANZ", pays: "Gabon", logo: "CMP-005.png", code: "105", tauxCommissionMaladie: 19.0, tauxCommissionAssistance: 19.0 },
  { id: "CMP-006", nom: "OGAR ASSURANCES", pays: "Gabon", logo: "CMP-006.png", code: "106", tauxCommissionMaladie: 15.0, tauxCommissionAssistance: 14.5 },
];

// Tranches d'accessoires (borne de prime nette -> montant forfaitaire) par
// compagnie — source : ACCESOIRES COMPAGNIE.pdf. `borneMax: null` = "et
// plus"/"au-delà de".
const compagnieAccessoires: { compagnieId: string; borneMin: number; borneMax: number | null; montant: number }[] = [
  // AXA
  { compagnieId: "CMP-003", borneMin: 1, borneMax: 100_000, montant: 10_000 },
  { compagnieId: "CMP-003", borneMin: 100_001, borneMax: 500_000, montant: 15_000 },
  { compagnieId: "CMP-003", borneMin: 500_001, borneMax: 10_000_000, montant: 25_000 },
  { compagnieId: "CMP-003", borneMin: 10_000_001, borneMax: 20_000_000, montant: 40_000 },
  { compagnieId: "CMP-003", borneMin: 20_000_001, borneMax: null, montant: 55_000 },
  // BGFI ASSURANCES
  { compagnieId: "CMP-001", borneMin: 1, borneMax: 99_999, montant: 10_000 },
  { compagnieId: "CMP-001", borneMin: 100_000, borneMax: 499_999, montant: 15_000 },
  { compagnieId: "CMP-001", borneMin: 500_000, borneMax: 1_499_999, montant: 25_000 },
  { compagnieId: "CMP-001", borneMin: 1_500_000, borneMax: 3_999_999, montant: 35_000 },
  { compagnieId: "CMP-001", borneMin: 4_000_000, borneMax: null, montant: 50_000 },
  // NSIA ASSURANCES
  { compagnieId: "CMP-002", borneMin: 1, borneMax: 99_999, montant: 15_000 },
  { compagnieId: "CMP-002", borneMin: 100_000, borneMax: 499_999, montant: 25_000 },
  { compagnieId: "CMP-002", borneMin: 500_000, borneMax: 1_499_999, montant: 50_000 },
  { compagnieId: "CMP-002", borneMin: 5_000_000, borneMax: 9_999_999, montant: 55_000 },
  { compagnieId: "CMP-002", borneMin: 10_000_000, borneMax: null, montant: 55_000 },
  // OGAR ASSURANCES
  { compagnieId: "CMP-006", borneMin: 0, borneMax: 99_999, montant: 15_000 },
  { compagnieId: "CMP-006", borneMin: 100_000, borneMax: 999_999, montant: 20_000 },
  { compagnieId: "CMP-006", borneMin: 1_000_000, borneMax: null, montant: 30_000 },
  // SANLAM ALLIANZ
  { compagnieId: "CMP-005", borneMin: 0, borneMax: 99_999, montant: 15_000 },
  { compagnieId: "CMP-005", borneMin: 100_000, borneMax: 499_999, montant: 15_000 },
  { compagnieId: "CMP-005", borneMin: 500_000, borneMax: 999_999, montant: 20_000 },
  { compagnieId: "CMP-005", borneMin: 1_000_000, borneMax: 4_999_999, montant: 30_000 },
  { compagnieId: "CMP-005", borneMin: 5_000_000, borneMax: 9_999_999, montant: 50_000 },
  { compagnieId: "CMP-005", borneMin: 10_000_000, borneMax: null, montant: 100_000 },
  // SUNU ASSURANCES
  { compagnieId: "CMP-004", borneMin: 1, borneMax: 100_000, montant: 10_000 },
  { compagnieId: "CMP-004", borneMin: 100_001, borneMax: 500_000, montant: 15_000 },
  { compagnieId: "CMP-004", borneMin: 500_001, borneMax: 1_500_000, montant: 25_000 },
  { compagnieId: "CMP-004", borneMin: 1_500_001, borneMax: 4_000_000, montant: 40_000 },
  { compagnieId: "CMP-004", borneMin: 4_000_001, borneMax: null, montant: 50_000 },
];

// Table de surprimes d'âge — source : SURPRIMES D'AGES.pdf, identique pour
// les 6 compagnies faute de grille différenciée fournie (modifiable ensuite
// par compagnie depuis l'écran Paramètres).
const surprimesAgeStandard: { ageMin: number; ageMax: number | null; tauxPourcent: number }[] = [
  { ageMin: 0, ageMax: 49, tauxPourcent: 0 },
  { ageMin: 50, ageMax: 55, tauxPourcent: 10 },
  { ageMin: 56, ageMax: 60, tauxPourcent: 15 },
  { ageMin: 61, ageMax: 65, tauxPourcent: 20 },
];
const compagnieSurprimesAge = compagnies.flatMap((c) =>
  surprimesAgeStandard.map((s) => ({ ...s, compagnieId: c.id }))
);

// Territorialités et taux de couverture "standard souvent appliqués en
// garanties" (source : capture "Couvertures existantes"/"Taux de couverture
// existants") — servent de valeurs par défaut, identiques pour les 6
// compagnies au démarrage ; chaque compagnie peut ensuite en ajouter/retirer
// depuis sa fiche Paramètres.
const territorialitesStandard = [
  "GABON UNIQUEMENT",
  "GABON -PAYS CIMA- AFRIQUE DU SUD-UNION EUROPEENNE- USA",
  "GABON -PAYS CIMA- AFRIQUE DU SUD-UNION EUROPEENNE",
  "GABON -PAYS CIMA- AFRIQUE DU SUD-UNION EUROPEENNE- MAGRHEB",
  "GABON -PAYS CIMA- AFRIQUE DU SUD-UNION EUROPEENNE",
  "GABON-PAYS CIMA- AFRIQUE DU SUD- TUNISIE",
  "GABON-PAYS CIMA- AFRIQUE DU SUD- TUNISIE- MAROC",
];
const compagnieTerritorialites = compagnies.flatMap((c) =>
  territorialitesStandard.map((libelle) => ({ libelle, compagnieId: c.id }))
);

const tauxCouvertureStandard: { tauxHospitalisation: string; tauxAmbulatoire: string }[] = [
  { tauxHospitalisation: "100%", tauxAmbulatoire: "100%" },
  { tauxHospitalisation: "100%", tauxAmbulatoire: "80%" },
  { tauxHospitalisation: "100%", tauxAmbulatoire: "70%" },
  { tauxHospitalisation: "90%", tauxAmbulatoire: "80%" },
  { tauxHospitalisation: "80%", tauxAmbulatoire: "70%" },
  { tauxHospitalisation: "60%", tauxAmbulatoire: "60%" },
];
const compagnieTauxCouverture = compagnies.flatMap((c) =>
  tauxCouvertureStandard.map((t) => ({ ...t, compagnieId: c.id }))
);

// Clauses d'ajustement (barème de régularisation selon le ratio
// Sinistres/Prime constaté à l'échéance) — source fournie pour 4 des 6
// compagnies ; AXA et SUNU n'ont pas de grille communiquée à ce stade
// (ajoutable ensuite depuis la fiche Paramètres). `tauxAjustement: 999`
// représente conventionnellement une majoration/résiliation "non plafonnée"
// (borne haute du Decimal(5,2)) — le libellé exact reste dans `description`.
const compagnieClausesAjustement: { compagnieId: string; spMin: number; spMax: number | null; tauxAjustement: number; description: string }[] = [
  // OGAR ASSURANCES
  { compagnieId: "CMP-006", spMin: 0, spMax: 0.74, tauxAjustement: 0, description: "Sans chargement" },
  { compagnieId: "CMP-006", spMin: 0.75, spMax: 0.84, tauxAjustement: 35, description: "Majoration 35%" },
  { compagnieId: "CMP-006", spMin: 0.85, spMax: 0.99, tauxAjustement: 45, description: "Majoration 45%" },
  { compagnieId: "CMP-006", spMin: 1, spMax: 1.14, tauxAjustement: 55, description: "Majoration 55%" },
  { compagnieId: "CMP-006", spMin: 1.15, spMax: 1.29, tauxAjustement: 65, description: "Majoration 65%" },
  { compagnieId: "CMP-006", spMin: 1.30, spMax: 1.45, tauxAjustement: 75, description: "Majoration 75%" },
  { compagnieId: "CMP-006", spMin: 1.46, spMax: 1.55, tauxAjustement: 85, description: "Majoration 85%" },
  { compagnieId: "CMP-006", spMin: 1.56, spMax: null, tauxAjustement: 999, description: "Résiliation ou majoration non limitée" },
  // BGFI ASSURANCES
  { compagnieId: "CMP-001", spMin: 0.55, spMax: 0.70, tauxAjustement: 0, description: "Sans chargement" },
  { compagnieId: "CMP-001", spMin: 0.71, spMax: 0.90, tauxAjustement: 15, description: "Majoration 15%" },
  { compagnieId: "CMP-001", spMin: 0.91, spMax: 1.05, tauxAjustement: 30, description: "Majoration 30%" },
  { compagnieId: "CMP-001", spMin: 1.06, spMax: 1.20, tauxAjustement: 50, description: "Majoration 50%" },
  { compagnieId: "CMP-001", spMin: 1.21, spMax: null, tauxAjustement: 60, description: "Majoration 60% (au-delà de 1,20)" },
  // SANLAM ALLIANZ
  { compagnieId: "CMP-005", spMin: 0, spMax: 0.74, tauxAjustement: 0, description: "Sans chargement" },
  { compagnieId: "CMP-005", spMin: 0.75, spMax: 0.79, tauxAjustement: 5, description: "Majoration 5%" },
  { compagnieId: "CMP-005", spMin: 0.80, spMax: 0.84, tauxAjustement: 10, description: "Majoration 10%" },
  { compagnieId: "CMP-005", spMin: 0.85, spMax: 0.89, tauxAjustement: 15, description: "Majoration 15%" },
  { compagnieId: "CMP-005", spMin: 0.90, spMax: 0.94, tauxAjustement: 20, description: "Majoration 20%" },
  { compagnieId: "CMP-005", spMin: 0.95, spMax: 0.99, tauxAjustement: 25, description: "Majoration 25%" },
  { compagnieId: "CMP-005", spMin: 1.00, spMax: 1.04, tauxAjustement: 30, description: "Majoration 30%" },
  { compagnieId: "CMP-005", spMin: 1.05, spMax: 1.09, tauxAjustement: 35, description: "Majoration 35%" },
  { compagnieId: "CMP-005", spMin: 1.10, spMax: 1.14, tauxAjustement: 40, description: "Majoration 40%" },
  { compagnieId: "CMP-005", spMin: 1.15, spMax: 1.19, tauxAjustement: 45, description: "Majoration 45%" },
  { compagnieId: "CMP-005", spMin: 1.20, spMax: 1.24, tauxAjustement: 50, description: "Majoration 50%" },
  { compagnieId: "CMP-005", spMin: 1.25, spMax: 1.29, tauxAjustement: 55, description: "Majoration 55%" },
  { compagnieId: "CMP-005", spMin: 1.30, spMax: 1.34, tauxAjustement: 60, description: "Majoration 60%" },
  { compagnieId: "CMP-005", spMin: 1.35, spMax: 1.39, tauxAjustement: 65, description: "Majoration 65%" },
  { compagnieId: "CMP-005", spMin: 1.40, spMax: 1.44, tauxAjustement: 70, description: "Majoration 70%" },
  { compagnieId: "CMP-005", spMin: 1.45, spMax: 1.49, tauxAjustement: 75, description: "Majoration 75%" },
  { compagnieId: "CMP-005", spMin: 1.50, spMax: 1.54, tauxAjustement: 80, description: "Majoration 80%" },
  { compagnieId: "CMP-005", spMin: 1.55, spMax: null, tauxAjustement: 999, description: "Revue des garanties et tarifs ou résiliation" },
  // NSIA ASSURANCES — "Clause de régularisation" réelle, source :
  // OFFRE SANTE BW ENERGY.pdf (rapport Sinistres/Primes à l'échéance).
  // tauxAjustement négatif = ristourne, positif = régularisation (majoration).
  { compagnieId: "CMP-002", spMin: 0, spMax: 0.35, tauxAjustement: -20, description: "Ristourne de 20% (S/P inférieur à 35%)" },
  { compagnieId: "CMP-002", spMin: 0.36, spMax: 0.44, tauxAjustement: -10, description: "Ristourne de 10%" },
  { compagnieId: "CMP-002", spMin: 0.45, spMax: 0.54, tauxAjustement: -5, description: "Ristourne de 5%" },
  { compagnieId: "CMP-002", spMin: 0.55, spMax: 0.64, tauxAjustement: 0, description: "Aucune modification" },
  { compagnieId: "CMP-002", spMin: 0.65, spMax: 0.74, tauxAjustement: 15, description: "Régularisation de 15%" },
  { compagnieId: "CMP-002", spMin: 0.75, spMax: 0.89, tauxAjustement: 30, description: "Régularisation de 30%" },
  { compagnieId: "CMP-002", spMin: 0.90, spMax: 1.04, tauxAjustement: 50, description: "Régularisation de 50%" },
  { compagnieId: "CMP-002", spMin: 1.05, spMax: 1.29, tauxAjustement: 70, description: "Régularisation de 70%" },
  { compagnieId: "CMP-002", spMin: 1.30, spMax: 1.50, tauxAjustement: 80, description: "Régularisation de 80%" },
  { compagnieId: "CMP-002", spMin: 1.51, spMax: null, tauxAjustement: 100, description: "Régularisation de 100% (S/P supérieur à 150%)" },
  // AXA — "Clause d'ajustement semestrielle", même source.
  { compagnieId: "CMP-003", spMin: 0, spMax: 0.60, tauxAjustement: 0, description: "Sans changement" },
  { compagnieId: "CMP-003", spMin: 0.61, spMax: 0.70, tauxAjustement: 15, description: "Majoration de 15%" },
  { compagnieId: "CMP-003", spMin: 0.71, spMax: 0.90, tauxAjustement: 30, description: "Majoration de 30%" },
  { compagnieId: "CMP-003", spMin: 0.91, spMax: 1.00, tauxAjustement: 50, description: "Majoration de 50%" },
  { compagnieId: "CMP-003", spMin: 1.01, spMax: 1.10, tauxAjustement: 100, description: "Majoration de 100%" },
  { compagnieId: "CMP-003", spMin: 1.11, spMax: null, tauxAjustement: 999, description: "L'assureur se réserve le droit de résilier le contrat à échéance" },
];

// Territorialités réelles propres à une compagnie (en plus des libellés
// génériques ci-dessus) — source : OFFRE SANTE BW ENERGY.pdf, page
// "Proposition Santé" de chaque compagnie.
const compagnieTerritorialitesReelles: { compagnieId: string; libelle: string }[] = [
  { compagnieId: "CMP-001", libelle: "GABON-MONDE ENTIER (Sauf Amérique du Nord & Japon) Option 1" },
  { compagnieId: "CMP-002", libelle: "GABON – PAYS CIMA – UE – AFRIQUE DU SUD" },
  { compagnieId: "CMP-003", libelle: "Gabon, Pays CIMA (Bénin, Cameroun, Centre-Afrique, Comores, Congo, Côte d'Ivoire, Guinée Equatoriale, Mali, Niger, Sénégal, Tchad, Togo), Afrique du Sud, Union européenne (zone Schengen), Maroc, Tunisie" },
];

// Catalogues de garanties Maladie réels par compagnie — source : OFFRE SANTE
// BW ENERGY.pdf, tableau "Garanties et plafonds annuels par personne" (ou
// "Tableau des prestations" pour NSIA) de chaque compagnie. Pré-remplissent
// l'éditeur de garanties d'une cotation pour cette compagnie/branche (voir
// CompagniesService.replaceGarantiesCatalogue), librement modifiables
// ensuite. La branche Assistance de ces 3 compagnies reprend le catalogue
// générique `garantiesAssistance` (mêmes 8 rubriques dans le modèle,
// aucun plafond différencié communiqué par compagnie).
const compagnieGarantiesCatalogue: {
  compagnieId: string; categorie: string; libelle: string; plafondDefaut?: string;
  tauxStructurePriveeDefaut?: string; tauxStructurePubliqueDefaut?: string;
}[] = [
  // BGFI ASSURANCES (Assinco)
  { compagnieId: "CMP-001", categorie: "Médecine", libelle: "Consultations, visites, analyses médicales, consultations de spécialistes", plafondDefaut: "100% des frais selon le BTAM au Gabon — 100% du Tarif de Convention de la Sécurité Sociale Française hors du Gabon" },
  { compagnieId: "CMP-001", categorie: "Pharmacie", libelle: "Pharmacie", plafondDefaut: "100% des frais selon le BTAM au Gabon" },
  { compagnieId: "CMP-001", categorie: "Hospitalisation", libelle: "Hospitalisation médicale et chirurgicale", plafondDefaut: "100% des frais selon le BTAM au Gabon — 100% du Tarif de Convention de la Sécurité Sociale Française hors du Gabon" },
  { compagnieId: "CMP-001", categorie: "Hospitalisation", libelle: "Frais de séjour", plafondDefaut: "65 000 FCFA / jour" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Prothèse en générale (autres que dentaires et optiques)", plafondDefaut: "300 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Maternité — Accouchement simple", plafondDefaut: "350 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Maternité — Accouchement multiple", plafondDefaut: "700 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Dentisterie (soins dentaires, prothèse, orthodontie, chirurgie dentaire)", plafondDefaut: "450 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Lettre D ou K", plafondDefaut: "2 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Lunetterie (verres tous les ans + monture tous les deux ans)", plafondDefaut: "300 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Orthophonie", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Orthodontie (réservée aux assurés de moins de 16 ans, pendant 2 ans maximum)", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Cures thermales et Massages", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "SAMU", plafondDefaut: "50 000 FCFA" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Infection au virus VIH (maladies opportunistes, traitement du SIDA)", plafondDefaut: "Suivant les dispositions contractuelles" },
  { compagnieId: "CMP-001", categorie: "Garanties plafonnées", libelle: "Evacuation sanitaire intérieur du pays", plafondDefaut: "5 000 000 FCFA pour le même évènement" },

  // AXA
  {
    compagnieId: "CMP-003", categorie: "Médecine", libelle: "Consultation, visites, actes courants de médecine, analyses, actes de radiologie et assimilés",
    tauxStructurePubliqueDefaut: "100% des frais réels de remboursement (Hôpitaux publics, C.N.SS, Hôpital Albert Schweitzer, Hôpital de Bongolo)",
    tauxStructurePriveeDefaut: "100% du barème de remboursement AXA Gabon (Clinique et secteur privé, Hôpital d'Instruction des Armées)",
  },
  { compagnieId: "CMP-003", categorie: "Pharmacie", libelle: "Pharmacie", plafondDefaut: "100% frais réels" },
  { compagnieId: "CMP-003", categorie: "Hospitalisation", libelle: "Hospitalisation médicale et/ou chirurgicale", plafondDefaut: "100% du barème de remboursement AXA Gabon" },
  { compagnieId: "CMP-003", categorie: "Hospitalisation", libelle: "Frais de séjour", plafondDefaut: "65 000 FCFA / jour" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Maternité — Frais pré & post natals", plafondDefaut: "100% BTAM" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Maternité — Accouchement simple", plafondDefaut: "100% — 400 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Maternité — Accouchement multiple", plafondDefaut: "100% — 800 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Dentisterie", plafondDefaut: "100% — 350 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Optique (verres et monture)", plafondDefaut: "100% — 250 000 FCFA / tous les deux ans" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Orthodontie", plafondDefaut: "100% — 200 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Orthophonie", plafondDefaut: "100% — 200 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Kinésithérapie", plafondDefaut: "100% — 200 000 FCFA / an" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Frais funéraires", plafondDefaut: "Exclu" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Transport (SAMU)", plafondDefaut: "100% — 70 000 FCFA / cas" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "EVASAN", plafondDefaut: "100% — 2 000 000 FCFA / cas" },
  { compagnieId: "CMP-003", categorie: "Garanties plafonnées", libelle: "Maladies chroniques (diabète, cancer, drépanocytose…)", plafondDefaut: "Plafond annuel 1 500 000 FCFA" },

  // NSIA ASSURANCES
  { compagnieId: "CMP-002", categorie: "Rubrique A", libelle: "Consultations, visites, actes courants de médecine, analyses, radios, pharmacies", plafondDefaut: "100% des frais réels exposés" },
  { compagnieId: "CMP-002", categorie: "Rubrique B", libelle: "Hospitalisation et chirurgie", plafondDefaut: "100% des frais réels exposés dans les hôpitaux du secteur Sécurité Sociale France" },
  { compagnieId: "CMP-002", categorie: "Rubrique C", libelle: "Frais de chambre consécutifs à l'hospitalisation", plafondDefaut: "Plafonnement journalier tous frais inclus 50 000 FCFA en secteur privé" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Accouchement simple", plafondDefaut: "400 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Accouchement gémellaire", plafondDefaut: "800 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Soins dentaires (y compris prothèse)", plafondDefaut: "500 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Optique", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Orthopédie", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Orthophonie", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Cure thermale", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Kinésithérapie et rééducation", plafondDefaut: "200 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "SAMU", plafondDefaut: "70 000 FCFA" },
  { compagnieId: "CMP-002", categorie: "Rubrique D — Extension des garanties", libelle: "Evacuation sanitaire intérieur du pays", plafondDefaut: "1 000 000 FCFA" },
];

const contrats = [
  {
    id: "CTR-2024-004", clientNom: "BGFI Bank Gabon", branche: "Maladie", compagnieNom: "OGAR ASSURANCES", dateDebut: "01/01/2024", dateFin: "31/12/2024", statut: "En renouvellement",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC"],
    tauxCouvertureAmbulatoire: "Consultation généraliste 80%, Consultation spécialiste 80%, Pharmacie 70%, Analyses médicales 70%",
    tauxCouvertureHospitalisation: "Hospitalisation médicale et chirurgicale 100%, Maternité 80%, Chambre particulière selon plafond",
    tauxAmbulatoirePublique: "80%", tauxAmbulatoirePrivee: "70%",
    tauxHospitalisationPublique: "100%", tauxHospitalisationPrivee: "90%",
    nombreAssuresPrincipaux: 300, primeUnitaireAssurePrincipal: 60_000,
    nombreConjoints: 150, primeUnitaireConjoint: 45_000,
    nombreEnfants: 110, primeUnitaireEnfant: 30_000,
    nombreCouples: 0, primeUnitaireCouple: 0,
    tauxTerritorialite: 0, limiteAgeAdulte: 65, limiteAgeEnfant: 21, limitePersFamille: 21,
    plafondAdherent: null as number | null, plafondFamille: 50_000_000, plafondPolice: null as number | null,
    tauxMinoMajoration: 0, tauxReductionCommerciale: 0, montantAccessoires: 350_000, tauxCommission: 12,
  },
  {
    id: "CTR-2024-005", clientNom: "SEEG", branche: "Maladie", compagnieNom: "SANLAM ALLIANZ", dateDebut: "01/04/2024", dateFin: "31/03/2025", statut: "Actif",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC", "Afrique"],
    tauxCouvertureAmbulatoire: "Consultation généraliste 90%, Consultation spécialiste 90%, Pharmacie 80%, Optique et dentaire 60%",
    tauxCouvertureHospitalisation: "Hospitalisation médicale et chirurgicale 100%, Maternité 90%",
    tauxAmbulatoirePublique: "90%", tauxAmbulatoirePrivee: "80%",
    tauxHospitalisationPublique: "100%", tauxHospitalisationPrivee: "100%",
    nombreAssuresPrincipaux: 900, primeUnitaireAssurePrincipal: 55_000,
    nombreConjoints: 500, primeUnitaireConjoint: 42_000,
    nombreEnfants: 400, primeUnitaireEnfant: 28_000,
    nombreCouples: 0, primeUnitaireCouple: 0,
    tauxTerritorialite: 0, limiteAgeAdulte: 65, limiteAgeEnfant: 21, limitePersFamille: 21,
    plafondAdherent: null as number | null, plafondFamille: 80_000_000, plafondPolice: null as number | null,
    tauxMinoMajoration: 0, tauxReductionCommerciale: 0, montantAccessoires: 600_000, tauxCommission: 9,
  },
  {
    id: "CTR-2024-006", clientNom: "BGFI Bank Gabon", branche: "Assistance", compagnieNom: "OGAR ASSURANCES", dateDebut: "01/01/2024", dateFin: "31/12/2024", statut: "Actif",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC", "France", "International"],
    tauxCouvertureAmbulatoire: null as string | null, tauxCouvertureHospitalisation: null as string | null,
    tauxAmbulatoirePublique: undefined as string | undefined, tauxAmbulatoirePrivee: undefined as string | undefined,
    tauxHospitalisationPublique: undefined as string | undefined, tauxHospitalisationPrivee: undefined as string | undefined,
    nombreAssuresPrincipaux: 300, primeUnitaireAssurePrincipal: 8_000,
    nombreConjoints: 150, primeUnitaireConjoint: 6_000,
    nombreEnfants: 110, primeUnitaireEnfant: 4_000,
    nombreCouples: 0, primeUnitaireCouple: 0,
    tauxTerritorialite: 0, limiteAgeAdulte: 65, limiteAgeEnfant: 21, limitePersFamille: 21,
    plafondAdherent: null as number | null, plafondFamille: null as number | null, plafondPolice: null as number | null,
    tauxMinoMajoration: 0, tauxReductionCommerciale: 0, montantAccessoires: 50_000, tauxCommission: 12,
  },
  {
    id: "CTR-2024-007", clientNom: "SEEG", branche: "Assistance", compagnieNom: "SANLAM ALLIANZ", dateDebut: "01/04/2024", dateFin: "31/03/2025", statut: "Actif",
    paysSouscription: "Gabon", extensionsTerritorialite: ["Zone CEMAC", "Europe"],
    tauxCouvertureAmbulatoire: null as string | null, tauxCouvertureHospitalisation: null as string | null,
    tauxAmbulatoirePublique: undefined as string | undefined, tauxAmbulatoirePrivee: undefined as string | undefined,
    tauxHospitalisationPublique: undefined as string | undefined, tauxHospitalisationPrivee: undefined as string | undefined,
    nombreAssuresPrincipaux: 900, primeUnitaireAssurePrincipal: 3_500,
    nombreConjoints: 500, primeUnitaireConjoint: 2_500,
    nombreEnfants: 400, primeUnitaireEnfant: 1_800,
    nombreCouples: 0, primeUnitaireCouple: 0,
    tauxTerritorialite: 0, limiteAgeAdulte: 65, limiteAgeEnfant: 21, limitePersFamille: 21,
    plafondAdherent: null as number | null, plafondFamille: null as number | null, plafondPolice: null as number | null,
    tauxMinoMajoration: 0, tauxReductionCommerciale: 0, montantAccessoires: 80_000, tauxCommission: 9,
  },
].map((c) => {
  const TAUX_TAXE_GABON = 0.08;
  const totalNettePrestation =
    c.nombreAssuresPrincipaux * c.primeUnitaireAssurePrincipal +
    c.nombreConjoints * c.primeUnitaireConjoint +
    c.nombreEnfants * c.primeUnitaireEnfant +
    c.nombreCouples * c.primeUnitaireCouple;
  const primeNette = totalNettePrestation * (1 + c.tauxMinoMajoration / 100) * (1 - c.tauxReductionCommerciale / 100);
  const primeTotaleHT = primeNette;
  const montantTaxe = (primeTotaleHT + c.montantAccessoires) * TAUX_TAXE_GABON;
  const montantCommission = primeTotaleHT * (c.tauxCommission / 100);
  const prime = primeTotaleHT + c.montantAccessoires + montantTaxe;
  return { ...c, primeNette, primeTotaleHT, montantTaxe, montantCommission, prime };
});

// Tableau de garanties standard "Collège Cadres" (santé Gabon) — appliqué
// aux contrats Maladie ci-dessus. Source : tableau de garanties fourni.
const garantiesTypeMaladie: { categorie: string; libelle: string; tauxAssure: number; tauxAyantsDroit: number; plafond: string | null; plafondMontant?: number; plafondPeriode?: string }[] = [
  { categorie: "Consultation/Divers", libelle: "Consultation Généraliste", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Consultation Spécialiste", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Visite Généraliste", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Visite Spécialiste", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Consultation Urgente/Garde", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Frais Pharmaceutique & Produits", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Radiologie & Imagerie", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Analyses Biologiques", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Petite Chirurgie/Soins", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Consultation/Divers", libelle: "Auxiliaires Médicaux", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Dentisterie", libelle: "Consultation", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Dentisterie", libelle: "Orthodontie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM 500 000 F CFA / AN — plafond partagé avec Soins conservateurs & prothétiques", plafondMontant: 500_000, plafondPeriode: "An" },
  { categorie: "Dentisterie", libelle: "Soins conservateurs & prothétiques", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM 500 000 F CFA / AN — plafond partagé avec Orthodontie", plafondMontant: 500_000, plafondPeriode: "An" },
  { categorie: "Hospitalisation", libelle: "Hébergement", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "50 000 F CFA BTAM" },
  { categorie: "Hospitalisation", libelle: "Frais de traitement médicaux & chirurgicaux", tauxAssure: 100, tauxAyantsDroit: 100, plafond: null },
  { categorie: "Maternité", libelle: "Frais pré & Natals", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM" },
  { categorie: "Maternité", libelle: "Accouchement Simple", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "400 000 F CFA" },
  { categorie: "Maternité", libelle: "Accouchement Multiple", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "800 000 F CFA" },
  { categorie: "Optique", libelle: "Verres + Montures", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / 2 ANS" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Kinésithérapie & Cure Thermale", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Orthophonie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Orthoptie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Transport", libelle: "Ambulance", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "70 000 F CFA" },
];

// Garanties du contrat d'Assistance (évacuation sanitaire hors pays de
// souscription) — structurellement différentes de la Maladie : pas de
// taux Structures Privées/Publiques, juste une rubrique + un plafond.
const garantiesAssistance: { categorie: string; libelle: string; plafond: string | null }[] = [
  { categorie: "Assistance", libelle: "Transport sanitaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Transport du corps en cas de décès du bénéficiaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Retour après convalescence", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Accompagnement du bénéficiaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Voyage en cas de décès d'un proche parent", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Billet de visite", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Frais d'avocat", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Avance de caution pénale", plafond: "Prise en charge intégrale" },
];

// Renouvellement et Résiliation sont des TYPES d'avenant (2026-08), pas des
// concepts à part — 6 types pris en charge par la génération de document
// (voir AVENANT_META dans documents.service.ts, et le commentaire sur le
// modèle Avenant du schéma) : Renouvellement, Incorporation, Retrait,
// Ajustement de Prime, Régularisation de Prime, Résiliation. Les écrans
// "Renouvellements"/"Résiliations" restent des vues de travail (worklist,
// workflow) sur cette même table `avenants` — voir RenouvellementsService/
// ResiliationsService, de simples adaptateurs sans table propre.
const avenants = [
  { id: "AVN-2024-073", contratId: "CTR-2024-005", type: "Ajustement de Prime", description: "Ajout de 12 nouveaux collaborateurs à la couverture santé", primeAvant: 98_000_000, primeApres: 104_600_000, dateEffet: "01/11/2024", statut: "Validé" },
  { id: "AVN-2024-074", contratId: "CTR-2024-004", type: "Ajustement de Prime", description: "Extension évacuation sanitaire zone CEMAC", primeAvant: 32_600_000, primeApres: 35_100_000, dateEffet: "15/11/2024", statut: "Brouillon" },
  { id: "REN-2024-014", contratId: "CTR-2024-004", type: "Renouvellement", description: "Renouvellement — sinistralité 62%", primeAvant: 32_600_000, primeApres: 34_800_000, dateEffet: "31/12/2024", statut: "À renouveler", sinistralite: "62%" },
  { id: "REN-2024-012", contratId: "CTR-2024-005", type: "Renouvellement", description: "Renouvellement — sinistralité 58%", primeAvant: 98_000_000, primeApres: 102_500_000, dateEffet: "31/03/2025", statut: "À renouveler", sinistralite: "58%" },
];

const sinistres = [
  { id: "SIN-2024-0449", clientNom: "SEEG", branche: "Santé", date: "10/10/2024", description: "Hospitalisation — P. Ondo", montant: 3_800_000, statut: "Remboursé", priorite: "Normal", gestionnaireNom: "Solange Ntsame" },
];

const assures = [
  {
    id: "ASS-001", nom: "Paul Ondo", matricule: "SEEG-GA-00234", contratId: "CTR-2024-005", beneficiaires: 4, cotisation: 185_000, statut: "Actif",
    dateNaissance: "12/04/1982", statutMatrimonial: "Marié", numeroAssure: "MED-SAN-000234", qrCode: "QR-MED-000234", statutCarte: "Active", dateAffiliation: "01/04/2024",
    typeAssure: "AS", telephone: "+241 06 12 34 56",
    membres: [
      { suffix: "CJ1", nom: "Chantal Ondo", typeAssure: "CJ", dateNaissance: "20/08/1985", statut: "Actif" },
      { suffix: "EF1", nom: "Paul Ondo Jr.", typeAssure: "EF", dateNaissance: "14/02/2012", statut: "Actif" },
      { suffix: "EF2", nom: "Sarah Ondo", typeAssure: "EF", dateNaissance: "03/06/2015", statut: "Actif" },
    ],
  },
  {
    id: "ASS-002", nom: "Yvette Nze", matricule: "SEEG-GA-00235", contratId: "CTR-2024-005", beneficiaires: 3, cotisation: 142_000, statut: "Actif",
    dateNaissance: "05/11/1990", statutMatrimonial: "Célibataire", numeroAssure: "MED-SAN-000235", qrCode: "QR-MED-000235", statutCarte: "Active", dateAffiliation: "01/04/2024",
    typeAssure: "AS", telephone: "+241 06 23 45 67",
    membres: [
      { suffix: "EF1", nom: "Grace Nze", typeAssure: "EF", dateNaissance: "22/09/2018", statut: "Actif" },
    ],
  },
  {
    id: "ASS-003", nom: "Bernard Mba", matricule: "SEEG-GA-00236", contratId: "CTR-2024-005", beneficiaires: 2, cotisation: 98_000, statut: "Suspendu",
    dateNaissance: "30/01/1978", statutMatrimonial: "Marié", numeroAssure: "MED-SAN-000236", qrCode: "QR-MED-000236", statutCarte: "Bloquée", dateAffiliation: "01/04/2024",
    typeAssure: "AS", telephone: "+241 06 34 56 78",
    membres: [],
  },
  {
    id: "ASS-004", nom: "Fabrice Moussavou", matricule: "SEEG-GA-00237", contratId: "CTR-2024-005", beneficiaires: 1, cotisation: 76_000, statut: "Actif",
    dateNaissance: "17/07/1995", statutMatrimonial: "Célibataire", numeroAssure: "MED-SAN-000237", qrCode: "QR-MED-000237", statutCarte: "Active", dateAffiliation: "01/04/2024",
    typeAssure: "AS", telephone: "+241 06 45 67 89",
    membres: [],
  },
];

const prestataires = [
  { id: "PRS-001", nom: "CHU Libreville", type: "Hôpital", secteur: "Public", pays: "Gabon", ville: "Libreville", statutConvention: "Conventionné", dateConventionnement: "01/01/2022", delaiPaiementMoyen: 21, scoreQualite: 87,
    grilles: [{ acte: "Hospitalisation — journée", plafond: 250_000 }, { acte: "Chirurgie — acte majeur", plafond: 4_500_000 }] },
  { id: "PRS-002", nom: "Clinique El Rapha", type: "Clinique", secteur: "Privé", pays: "Gabon", ville: "Libreville", statutConvention: "Conventionné", dateConventionnement: "15/03/2022", delaiPaiementMoyen: 14, scoreQualite: 91,
    grilles: [{ acte: "Consultation généraliste", plafond: 15_000 }, { acte: "Consultation spécialiste", plafond: 30_000 }] },
  // categoriesActesVisibles (2026-08) — voir demande utilisateur : "une
  // pharmacie, un laboratoire n'aura pas besoin de consultation" ; démo du
  // portail prestataire filtré par type (voir PortailPrestataireController,
  // GROUPES_ACTES). Compte de connexion créé plus bas (après cette boucle).
  { id: "PRS-003", nom: "Pharmacie Nkembo", type: "Pharmacie", secteur: "Privé", pays: "Gabon", ville: "Libreville", statutConvention: "Conventionné", dateConventionnement: "01/06/2023", delaiPaiementMoyen: 7, scoreQualite: 82,
    grilles: [{ acte: "Médicaments génériques", plafond: 50_000 }], categoriesActesVisibles: ["Autre"] },
  { id: "PRS-004", nom: "Laboratoire Bio-Gabon", type: "Laboratoire", secteur: "Privé", pays: "Gabon", ville: "Port-Gentil", statutConvention: "En négociation", dateConventionnement: null, delaiPaiementMoyen: null, scoreQualite: null,
    grilles: [{ acte: "Bilan sanguin complet", plafond: 35_000 }], categoriesActesVisibles: ["Analyse"] },
  { id: "PRS-005", nom: "Cabinet Dentaire Glass", type: "Cabinet", secteur: "Privé", pays: "Gabon", ville: "Libreville", statutConvention: "Suspendu", dateConventionnement: "01/01/2021", delaiPaiementMoyen: 45, scoreQualite: 38,
    grilles: [{ acte: "Soins dentaires", plafond: 60_000 }] },
  // Deuxième pharmacie/laboratoire de démo (2026-08) — voir demande
  // utilisateur : "crées deux autres compte prestataire test: une pharmacie
  // et un laboratoire" (en plus de PRS-003/PRS-004 ci-dessus, pas à leur
  // place). Compte de connexion créé plus bas.
  { id: "PRS-006", nom: "Pharmacie Akanda", type: "Pharmacie", secteur: "Privé", pays: "Gabon", ville: "Akanda", statutConvention: "Conventionné", dateConventionnement: "10/02/2024", delaiPaiementMoyen: 10, scoreQualite: 88,
    grilles: [{ acte: "Médicaments génériques", plafond: 50_000 }], categoriesActesVisibles: ["Autre"] },
  { id: "PRS-007", nom: "Laboratoire Owendo Santé", type: "Laboratoire", secteur: "Privé", pays: "Gabon", ville: "Owendo", statutConvention: "Conventionné", dateConventionnement: "05/09/2023", delaiPaiementMoyen: 12, scoreQualite: 85,
    grilles: [{ acte: "Bilan sanguin complet", plafond: 35_000 }], categoriesActesVisibles: ["Analyse"] },
];

const accordsPrealables = [
  { id: "ACP-2024-011", assureNom: "Paul Ondo", prestataireNom: "CHU Libreville", type: "Hospitalisation", description: "Hospitalisation programmée — appendicectomie", dateDemande: "08/10/2024", statutAnalyseMedicale: "Validée", statutValidationFinanciere: "Validée", decision: "Accordé", montantAutorise: 3_800_000, dateDecision: "09/10/2024" },
];

const prisesEnCharge = [
  {
    id: "PC-2024-0234", assureNom: "Paul Ondo", prestataireNom: "CHU Libreville", type: "Hospitalisation", montant: 3_800_000, statut: "Accordé", date: "10/10/2024",
    modePaiement: "TiersPayant", prescriptionRef: "PRESC-2024-5501", factureRef: "FACT-CHU-8821", statutControleMedical: "Validé",
    baseRemboursement: 3_800_000, tauxRemboursement: 100, franchise: 0, plafondApplique: 4_500_000, resteACharge: 0, ordrePaiement: "OP-2024-3301",
    accordPrealableId: "ACP-2024-011", scoreFraude: 8, gestionnaireNom: "Grace Etoundi",
  },
  {
    id: "PC-2024-0233", assureNom: "Yvette Nze", prestataireNom: "Clinique El Rapha", type: "Consultation", montant: 45_000, statut: "Remboursé", date: "08/10/2024",
    modePaiement: "Remboursement", prescriptionRef: "PRESC-2024-5498", factureRef: "FACT-CER-1187", statutControleMedical: "Validé",
    baseRemboursement: 36_000, tauxRemboursement: 80, franchise: 0, plafondApplique: 30_000, resteACharge: 9_000, ordrePaiement: "OP-2024-3298",
    accordPrealableId: null, scoreFraude: 4, gestionnaireNom: "Grace Etoundi",
  },
  {
    id: "PC-2024-0232", assureNom: "Fabrice Moussavou", prestataireNom: "Pharmacie Nkembo", type: "Pharmacie", montant: 78_000, statut: "Accordé", date: "07/10/2024",
    modePaiement: "TiersPayant", prescriptionRef: "PRESC-2024-5490", factureRef: "FACT-PN-2231", statutControleMedical: "En cours",
    baseRemboursement: 54_600, tauxRemboursement: 70, franchise: 0, plafondApplique: 50_000, resteACharge: 27_600, ordrePaiement: null,
    accordPrealableId: null, scoreFraude: 62, gestionnaireNom: "Grace Etoundi",
  },
];

const bordereauxReglement = [
  { id: "BDX-2024-001", numero: "1", prestataireNom: "CHU Libreville", periode: "Octobre 2024", nbPrisesEnCharge: 1, montantTotal: 3_800_000, montantValide: 3_800_000, statut: "Payé", dateReception: "11/10/2024", datePaiement: "18/10/2024", referenceVirement: "VIR-2024-5521", priseEnChargeIds: ["PC-2024-0234"] },
];

const comptesBancaires = [
  { id: "CPT-001", banque: "BGFI Bank", pays: "Gabon", devise: "FCFA", solde: 87_400_000 },
  { id: "CPT-002", banque: "UGB", pays: "Gabon", devise: "FCFA", solde: 112_800_000 },
  { id: "CPT-003", banque: "Ecobank Gabon", pays: "Gabon", devise: "FCFA", solde: 64_200_000 },
  { id: "CPT-004", banque: "BICIG", pays: "Gabon", devise: "FCFA", solde: 22_900_000 },
];

// Catalogue des banques (2026-08) — voir demande utilisateur : onglet
// "Banques" du Système, distinct de `comptesBancaires` ci-dessus (mock de
// la Trésorerie) — ce sont les vraies banques référencées par LotCheques/
// LettreCheque/EncaissementPrime.banqueId. Liste transmise par l'utilisateur.
const banques = [
  { id: "BQ-BGFIBANK", nom: "BGFIBANK Gabon" },
  { id: "BQ-BICIG", nom: "BICIG" },
  { id: "BQ-AFGBANK", nom: "AFG Bank Gabon" },
  { id: "BQ-UGB", nom: "UGB (Union Gabonaise de Banque)" },
  { id: "BQ-UBA", nom: "UBA Gabon" },
  { id: "BQ-ORABANK", nom: "Orabank Gabon" },
  { id: "BQ-ECOBANK", nom: "Ecobank Gabon" },
  { id: "BQ-CITIBANK", nom: "Citibank Gabon" },
];

const fluxTresorerie = [
  { date: "31/10/2024", libelle: "Encaissement prime — SEEG", type: "Encaissement", montant: 98_000_000, rapproche: true },
  { date: "30/10/2024", libelle: "Reversement commissions — OGAR", type: "Décaissement", montant: 8_208_000, rapproche: true },
  { date: "28/10/2024", libelle: "Encaissement prime — SOGARA", type: "Encaissement", montant: 45_200_000, rapproche: true },
  { date: "27/10/2024", libelle: "Frais bancaires", type: "Décaissement", montant: 340_000, rapproche: false },
  { date: "25/10/2024", libelle: "Encaissement Mobile Money — Particuliers", type: "Encaissement", montant: 3_150_000, rapproche: true },
];

const impayes = [
  { id: "IMP-2024-204", clientNom: "SEEG", contratId: "CTR-2024-005", montantDu: 8_166_000, joursRetard: 8, niveau: "Relance 1", canal: "Mobile Money", statut: "En cours" },
  { id: "IMP-2024-199", clientNom: "BGFI Bank Gabon", contratId: "CTR-2024-004", montantDu: 2_716_000, joursRetard: 5, niveau: "Relance 1", canal: "Email", statut: "Résolu" },
];

const prospects = [
  { id: "PRO-2024-401", nom: "Total Energies Gabon", type: "Entreprise", source: "Salon Assurance Libreville", etape: "Nouveau", valeurEstimee: 65_000_000, commercial: "Cécile Ndong", dernierContact: "02/11/2024", effectifEstime: 420, budget: 70_000_000, historiqueAssurance: "Assureur en place: SUNU (contrat expirant en 03/2025)", zoneGeographique: "Gabon — Port-Gentil", scoring: "Fort" },
  { id: "PRO-2024-402", nom: "Christian Mabika", type: "Particulier", source: "Recommandation", etape: "Qualifié", valeurEstimee: 950_000, commercial: "Cécile Ndong", dernierContact: "30/10/2024", effectifEstime: 1, budget: 1_000_000, historiqueAssurance: "Aucune couverture santé actuelle", zoneGeographique: "Gabon — Libreville", scoring: "Moyen" },
  { id: "PRO-2024-404", nom: "Clinique La Providence", type: "Entreprise", source: "Appel entrant", etape: "Négociation", valeurEstimee: 22_500_000, commercial: "Julie Tchamba", dernierContact: "25/10/2024", effectifEstime: 85, budget: 25_000_000, historiqueAssurance: "Auto-assurance partielle actuellement", zoneGeographique: "Gabon — Libreville", scoring: "Moyen" },
  { id: "PRO-2024-395", nom: "Ecobank Gabon", type: "Entreprise", source: "Partenariat courtier", etape: "Gagné", valeurEstimee: 54_000_000, commercial: "Cécile Ndong", dernierContact: "18/10/2024", effectifEstime: 340, budget: 55_000_000, historiqueAssurance: "Portefeuille repris d'un courtier concurrent", zoneGeographique: "Gabon — Libreville", scoring: "Fort" },
  { id: "PRO-2024-390", nom: "Bernadette Nzue", type: "Particulier", source: "Réseaux sociaux", etape: "Perdu", valeurEstimee: 620_000, commercial: "Julie Tchamba", dernierContact: "10/10/2024", effectifEstime: 1, budget: 500_000, historiqueAssurance: "Budget insuffisant pour le niveau de garanties souhaité", zoneGeographique: "Gabon — Franceville", scoring: "Faible" },
];

const appelsOffres = [
  {
    id: "AO-2024-071", prospectId: "PRO-2024-401", clientNom: "Total Energies Gabon",
    cahierCharges: "Couverture santé collective 420 salariés + ayants droit, hospitalisation, EVASAN zone CEMAC",
    garantiesDemandees: "Hospitalisation 100%, Consultation 80%, Pharmacie 70%, EVASAN illimité",
    historiqueSinistres: "S/P moyen 58% sur les 3 dernières années chez l'assureur sortant",
    projectionSP: 60, estimationPepm: 42_500, estimationFondsRoulement: 180_000_000, statut: "En cours", dateCreation: "05/10/2024",
    propositions: [
      { niveau: "Essentiel", primeProposee: 58_000_000, descriptionGaranties: "Hospitalisation 80%, Consultation 60%, Pharmacie 50%", statut: "Envoyée" },
      { niveau: "Confort", primeProposee: 70_000_000, descriptionGaranties: "Hospitalisation 100%, Consultation 80%, Pharmacie 70%", statut: "Envoyée" },
      { niveau: "Premium", primeProposee: 85_000_000, descriptionGaranties: "Hospitalisation 100%, Consultation 100%, Pharmacie 90%, EVASAN illimité", statut: "Envoyée" },
    ],
  },
  {
    id: "AO-2024-069", prospectId: "PRO-2024-404", clientNom: "Clinique La Providence",
    cahierCharges: "Couverture santé collective 85 salariés, auto-gestion partielle à convertir en assurance complète",
    garantiesDemandees: "Hospitalisation 90%, Consultation 70%, Pharmacie 60%",
    historiqueSinistres: "Auto-assurance partielle — S/P estimé 48%",
    projectionSP: 48, estimationPepm: 18_200, estimationFondsRoulement: 32_000_000, statut: "Proposition envoyée", dateCreation: "20/09/2024",
    propositions: [
      { niveau: "Essentiel", primeProposee: 14_500_000, descriptionGaranties: "Hospitalisation 70%, Consultation 50%, Pharmacie 40%", statut: "Envoyée" },
      { niveau: "Confort", primeProposee: 19_800_000, descriptionGaranties: "Hospitalisation 90%, Consultation 70%, Pharmacie 60%", statut: "Envoyée" },
      { niveau: "Premium", primeProposee: 25_500_000, descriptionGaranties: "Hospitalisation 100%, Consultation 90%, Pharmacie 80%", statut: "Brouillon" },
    ],
  },
];

// Cotation = l'offre réelle d'une compagnie pour une branche (voir
// documents.service.ts renderCotationOffre) — une compagnie répondant à un
// appel d'offres produit typiquement 2 cotations, une par branche.
const cotations = [
  {
    id: "COT-2024-141", appelOffresId: "AO-2024-071", compagnieId: "CMP-001", branche: "Maladie",
    clientNom: "Total Energies Gabon", population: 420, territorialite: "Gabon - Zone CEMAC",
    exclusions: "Pathologies antérieures à la souscription",
    clauseAjustement: "Régularisation au S/P constaté à l'échéance (voir barème de la compagnie)",
    limiteAgeAdulte: 65, limiteAgeEnfant: 21, plafondFamilial: 30_000_000,
    conditionsFermete: "Sous réserve de l'examen des bulletins d'adhésion par le médecin conseil de la compagnie",
    primeNette: 62_000_000, montantCartes: 1_050_000, montantAccessoires: 350_000, montantTaxe: 5_072_000, primeTTC: 68_472_000,
    dateCreation: "05/10/2024",
    garanties: [
      { categorie: "Médecine", libelle: "Consultations, visites, analyses médicales", plafond: "100% des frais réels" },
      { categorie: "Hospitalisation", libelle: "Hospitalisation médicale et chirurgicale", plafond: "100% des frais réels" },
      { categorie: "Garanties plafonnées", libelle: "Maternité (accouchement simple)", plafond: "500 000 FCFA" },
    ],
  },
  {
    id: "COT-2024-142", appelOffresId: "AO-2024-071", compagnieId: "CMP-001", branche: "Assistance",
    clientNom: "Total Energies Gabon", population: 420, territorialite: "Gabon - Zone CEMAC",
    limiteAgeAdulte: 75,
    primeNette: 4_800_000, montantCartes: 0, montantAccessoires: 50_000, montantTaxe: 388_000, primeTTC: 5_238_000,
    dateCreation: "05/10/2024",
    garanties: [
      { categorie: "Assistance", libelle: "Évacuation sanitaire (EVASAN)", plafond: "Illimité" },
      { categorie: "Assistance", libelle: "Transport du corps en cas de décès", plafond: "Prise en charge intégrale" },
    ],
  },
  {
    id: "COT-2024-140", appelOffresId: "AO-2024-069", compagnieId: "CMP-002", branche: "Maladie",
    clientNom: "Clinique La Providence", population: 85, territorialite: "Gabon",
    limiteAgeAdulte: 65, limiteAgeEnfant: 21, plafondFamilial: 20_000_000,
    primeNette: 16_500_000, montantCartes: 212_500, montantAccessoires: 50_000, montantTaxe: 1_341_000, primeTTC: 18_103_500,
    dateCreation: "18/10/2024",
    garanties: [
      { categorie: "Médecine", libelle: "Consultations et pharmacie", plafond: "70% des frais réels" },
      { categorie: "Hospitalisation", libelle: "Hospitalisation médicale et chirurgicale", plafond: "90% des frais réels" },
    ],
  },
];

const journalEntries = [
  { date: "31/10/2024", num: "JNL-001245", libelle: "Primes encaissées — SOGARA", debit: 0, credit: 28_500_000, compte: "701000" },
  { date: "31/10/2024", num: "JNL-001246", libelle: "Commission OGAR — Oct.", debit: 3_420_000, credit: 0, compte: "612000" },
  { date: "30/10/2024", num: "JNL-001244", libelle: "Reversement primes — AXA Gabon", debit: 0, credit: 45_200_000, compte: "401000" },
  { date: "29/10/2024", num: "JNL-001242", libelle: "Honoraires expertise — Cabinet Expertise Ogooué", debit: 850_000, credit: 0, compte: "624000" },
  { date: "28/10/2024", num: "JNL-001241", libelle: "Primes encaissées — SEEG", debit: 0, credit: 98_000_000, compte: "701000" },
];

const fondsDeRoulement = [
  { contratId: "CTR-2024-005", montantInitial: 20_000_000, montantConsomme: 14_200_000, seuilAlerte: 4_000_000, statut: "Normal", dateAlimentation: "01/04/2024" },
  { contratId: "CTR-2024-004", montantInitial: 8_000_000, montantConsomme: 7_100_000, seuilAlerte: 1_500_000, statut: "Alerte", dateAlimentation: "01/01/2024" },
];

const honorairesGestion = [
  { contratId: "CTR-2024-005", periode: "Octobre 2024", montantSinistres: 12_400_000, tauxHonoraires: 8, montantHonoraires: 992_000, plafond: 1_500_000, statut: "Facturé" },
  { contratId: "CTR-2024-004", periode: "Octobre 2024", montantSinistres: 3_800_000, tauxHonoraires: 10, montantHonoraires: 380_000, plafond: 600_000, statut: "En attente" },
];

const scoringFraude = [
  { cible: "Assuré", cibleId: "ASS-004", cibleNom: "Fabrice Moussavou", score: 62, motifs: "Fréquence de consultation pharmacie anormalement élevée sur 30 jours", dateEvaluation: "07/10/2024" },
  { cible: "Prestataire", cibleId: "PRS-005", cibleNom: "Cabinet Dentaire Glass", score: 78, motifs: "Surtarification récurrente + non-respect des délais de facturation", dateEvaluation: "15/09/2024" },
];

const auditLogs = [
  { entite: "PriseEnCharge", entiteId: "PC-2024-0234", action: "Validé", utilisateur: "Grace Etoundi", details: "Accord préalable ACP-2024-011 validé, prise en charge liquidée à 100%" },
  { entite: "AccordPrealable", entiteId: "ACP-2024-011", action: "Validé", utilisateur: "Grace Etoundi", details: "Analyse médicale et validation financière conformes" },
  { entite: "AssureSante", entiteId: "ASS-003", action: "Modifié", utilisateur: "Grace Etoundi", details: "Carte bloquée suite à suspension du contrat" },
  { entite: "Prestataire", entiteId: "PRS-005", action: "Modifié", utilisateur: "Solange Ntsame", details: "Suspension pour surtarification récurrente" },
];

const notifications = [
  { destinataireType: "Gestionnaire", destinataireId: "GE", message: "Fonds de roulement CTR-2024-004 sous le seuil d'alerte (1.5M FCFA restants)", statut: "Envoyée" },
  { destinataireType: "Prestataire", destinataireId: "PRS-003", message: "Prise en charge PC-2024-0232 en cours de contrôle médical", statut: "Envoyée" },
  { destinataireType: "Client", destinataireId: "ASS-002", message: "Votre remboursement de 36 000 FCFA a été traité", statut: "Lue" },
];

const gedDocuments = [
  { id: "DOC-2024-1204", nom: "Scan_piece_identite_Obame.jpg", type: "Pièce d'identité", entiteLiee: "Marielle Obame", statutOcr: "En cours", statutSignature: "N/A", tags: ["KYC"], date: "02/11/2024" },
  { id: "DOC-2024-1205", nom: "Avenant_AVN-2024-073.pdf", type: "Avenant", entiteLiee: "SEEG", statutOcr: "Analysé", statutSignature: "En attente", tags: ["Santé Collective"], date: "01/11/2024" },
  { id: "DOC-2024-1206", nom: "Facture_CHU_8821.pdf", type: "Facture prestataire", entiteLiee: "CHU Libreville", statutOcr: "Analysé", statutSignature: "N/A", tags: ["Santé", "Prestataire"], date: "10/10/2024" },
  { id: "DOC-2024-1207", nom: "Bordereau_reglement_CHU_202410.pdf", type: "Bordereau", entiteLiee: "CHU Libreville", statutOcr: "Analysé", statutSignature: "N/A", tags: ["Santé", "Règlement"], date: "12/10/2024" },
  { id: "DOC-2024-1208", nom: "Carte_assure_ASS-001.pdf", type: "Carte assuré", entiteLiee: "Paul Ondo", statutOcr: "Analysé", statutSignature: "N/A", tags: ["Santé", "Affiliation"], date: "01/01/2024" },
];

async function main() {
  console.log("Seeding MedAssur database…");

  // Wipe in FK-safe order for idempotent re-runs.
  await prisma.notification.deleteMany();
  await prisma.roleModuleTemplate.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.scoringFraude.deleteMany();
  await prisma.honorairesGestion.deleteMany();
  await prisma.fondsDeRoulement.deleteMany();
  await prisma.priseEnCharge.deleteMany();
  await prisma.bordereauReglement.deleteMany();
  await prisma.accordPrealable.deleteMany();
  await prisma.decompte.deleteMany();
  await prisma.demandeClient.deleteMany();
  await prisma.assureSante.deleteMany();
  await prisma.grilleTarifaire.deleteMany();
  await prisma.facture.deleteMany();
  await prisma.lettreCheque.deleteMany();
  await prisma.lotCheques.deleteMany();
  await prisma.banque.deleteMany();
  await prisma.prestataire.deleteMany();
  await prisma.impaye.deleteMany();
  await prisma.avenant.deleteMany();
  await prisma.sinistre.deleteMany();
  await prisma.cotation.deleteMany();
  await prisma.propositionCommerciale.deleteMany();
  await prisma.appelOffres.deleteMany();
  await prisma.garantie.deleteMany();
  await prisma.garantieCatalogue.deleteMany();
  await prisma.acteMedical.deleteMany();
  await prisma.contrat.deleteMany();
  await prisma.commissionReversement.deleteMany();
  await prisma.compteBancaire.deleteMany();
  await prisma.fluxTresorerie.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.gedDocument.deleteMany();
  await prisma.prospect.deleteMany();
  // Compagnie avant Client : un profil Auto-Gestion (Compagnie.clientId,
  // FK RESTRICT) peut référencer un Client — doit être supprimé en premier
  // pour un reseed idempotent, même si plus aucun n'a été créé par le seed
  // lui-même (peut apparaître via l'écran Auto-Gestion en cours de session).
  await prisma.factureProduction.deleteMany();
  await prisma.compagnie.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.compteurDocument.deleteMany();
  await prisma.compteurDocument.create({ data: { id: "quittance", valeur: 846604 } });

  // Client avant User (2026-08) — un compte du portail peut porter
  // User.clientId (voir mockUsers ci-dessus, ex. SEEG/CLI-006), FK RESTRICT
  // vers Client.
  await prisma.client.createMany({ data: clients });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.createMany({
    data: mockUsers.map((u) => ({ ...u, passwordHash, modules: ROLE_MODULES[u.roleId as RoleId] ?? [] })),
  });
  const userIdByNom = new Map((await prisma.user.findMany()).map((u) => [u.nom, u.id]));

  // Modèle de droits par rôle (2026-08) — voir demande utilisateur : "on
  // peut créer des champs génériques à attribuer aux types d'utilisateur"
  // — copie de ROLE_MODULES en base, éditable ensuite depuis l'écran
  // Administration → "Rôles" (backend/src/role-templates).
  await prisma.roleModuleTemplate.createMany({
    data: ROLE_IDS.map((roleId) => ({ roleId, modules: ROLE_MODULES[roleId] ?? [] })),
  });

  await prisma.compagnie.createMany({ data: compagnies });
  await prisma.compagnieAccessoireTranche.createMany({
    data: compagnieAccessoires.map((a, i) => ({ ...a, ordre: i })),
  });
  await prisma.compagnieSurprimeAge.createMany({
    data: compagnieSurprimesAge.map((s, i) => ({ ...s, ordre: i })),
  });
  await prisma.compagnieTerritorialite.createMany({
    data: [
      ...compagnieTerritorialites.map((t, i) => ({ ...t, ordre: i % territorialitesStandard.length })),
      ...compagnieTerritorialitesReelles.map((t) => ({ ...t, ordre: territorialitesStandard.length })),
    ],
  });
  await prisma.compagnieTauxCouverture.createMany({
    data: compagnieTauxCouverture.map((t, i) => ({ ...t, ordre: i % tauxCouvertureStandard.length })),
  });
  const clauseOrdreParCompagnie = new Map<string, number>();
  await prisma.compagnieClauseAjustement.createMany({
    data: compagnieClausesAjustement.map((c) => {
      const ordre = clauseOrdreParCompagnie.get(c.compagnieId) ?? 0;
      clauseOrdreParCompagnie.set(c.compagnieId, ordre + 1);
      return { ...c, ordre };
    }),
  });

  const clientIdByNom = new Map(clients.map((c) => [c.nom, c.id]));
  const compagnieIdByNom = new Map(compagnies.map((c) => [c.nom, c.id]));

  await prisma.contrat.createMany({
    data: contrats.map((c) => ({
      id: c.id, branche: c.branche, dateDebut: c.dateDebut, dateFin: c.dateFin, prime: c.prime, statut: c.statut,
      clientId: clientIdByNom.get(c.clientNom)!, compagnieId: compagnieIdByNom.get(c.compagnieNom)!,
      paysSouscription: c.paysSouscription, extensionsTerritorialite: c.extensionsTerritorialite,
      tauxCouvertureAmbulatoire: c.tauxCouvertureAmbulatoire, tauxCouvertureHospitalisation: c.tauxCouvertureHospitalisation,
      tauxAmbulatoirePublique: c.tauxAmbulatoirePublique, tauxAmbulatoirePrivee: c.tauxAmbulatoirePrivee,
      tauxHospitalisationPublique: c.tauxHospitalisationPublique, tauxHospitalisationPrivee: c.tauxHospitalisationPrivee,
      nombreAssuresPrincipaux: c.nombreAssuresPrincipaux, primeUnitaireAssurePrincipal: c.primeUnitaireAssurePrincipal,
      nombreConjoints: c.nombreConjoints, primeUnitaireConjoint: c.primeUnitaireConjoint,
      nombreEnfants: c.nombreEnfants, primeUnitaireEnfant: c.primeUnitaireEnfant,
      nombreCouples: c.nombreCouples, primeUnitaireCouple: c.primeUnitaireCouple,
      tauxTerritorialite: c.tauxTerritorialite, limiteAgeAdulte: c.limiteAgeAdulte, limiteAgeEnfant: c.limiteAgeEnfant, limitePersFamille: c.limitePersFamille,
      plafondAdherent: c.plafondAdherent, plafondFamille: c.plafondFamille, plafondPolice: c.plafondPolice,
      tauxMinoMajoration: c.tauxMinoMajoration, tauxReductionCommerciale: c.tauxReductionCommerciale,
      montantAccessoires: c.montantAccessoires, tauxCommission: c.tauxCommission, montantCommission: c.montantCommission,
      primeNette: c.primeNette, primeTotaleHT: c.primeTotaleHT, montantTaxe: c.montantTaxe,
    })),
  });

  const contratsMaladieIds = contrats.filter((c) => c.branche === "Maladie").map((c) => c.id);
  await prisma.garantie.createMany({
    data: contratsMaladieIds.flatMap((contratId) =>
      garantiesTypeMaladie.map((g) => ({ ...g, contratId })),
    ),
  });

  // Exercice n°1 (Affaire Nouvelle) pour chaque contrat seedé — les contrats
  // créés via l'API le reçoivent automatiquement (ContratsService.create).
  await prisma.exercice.createMany({
    data: contrats.map((c) => ({
      contratId: c.id, numero: 1,
      dateDebut: c.dateDebut, dateFin: c.dateFin,
      periodicite: "Annuel", prime: c.prime, statut: c.statut === "Expiré" ? "Clôturé" : "Actif",
    })),
  });

  // Catalogue paramétrable (Paramètres → Catalogue de garanties) — pré-rempli
  // avec le même tableau standard, personnalisable/étendu ensuite.
  const ordreGarantiesParCompagnie = new Map<string, number>();
  await prisma.garantieCatalogue.createMany({
    data: [
      ...garantiesTypeMaladie.map((g, ordre) => ({
        branche: "Maladie", categorie: g.categorie, libelle: g.libelle,
        tauxAssureDefaut: g.tauxAssure, tauxAyantsDroitDefaut: g.tauxAyantsDroit,
        plafondDefaut: g.plafond ?? undefined, ordre,
      })),
      ...garantiesAssistance.map((g, ordre) => ({
        branche: "Assistance", categorie: g.categorie, libelle: g.libelle,
        plafondDefaut: g.plafond ?? undefined, ordre,
      })),
      // Ordre = position dans le tableau ci-dessus, qui reprend fidèlement
      // l'ordre des rubriques du modèle (Médecine, Pharmacie,
      // Hospitalisation, Garanties plafonnées / Rubriques A-D) — surtout
      // pas de tri alphabétique, qui casserait cette fidélité au PDF source.
      ...compagnieGarantiesCatalogue.map((g) => {
        const ordre = ordreGarantiesParCompagnie.get(g.compagnieId) ?? 0;
        ordreGarantiesParCompagnie.set(g.compagnieId, ordre + 1);
        return { branche: "Maladie", ...g, ordre };
      }),
    ],
  });

  await prisma.acteMedical.createMany({ data: actesMedicaux });
  await prisma.codeAffection.createMany({ data: codesAffection });

  await prisma.avenant.createMany({ data: avenants });

  await prisma.sinistre.createMany({
    data: sinistres.map((s) => ({
      id: s.id, branche: s.branche, date: s.date, description: s.description, montant: s.montant, statut: s.statut, priorite: s.priorite,
      clientId: clientIdByNom.get(s.clientNom)!, gestionnaireId: userIdByNom.get(s.gestionnaireNom),
    })),
  });

  for (const p of prestataires) {
    await prisma.prestataire.create({
      data: {
        id: p.id, nom: p.nom, type: p.type, secteur: p.secteur, pays: p.pays, ville: p.ville, statutConvention: p.statutConvention,
        dateConventionnement: p.dateConventionnement, delaiPaiementMoyen: p.delaiPaiementMoyen, scoreQualite: p.scoreQualite,
        grillesTarifaires: { create: p.grilles },
        categoriesActesVisibles: "categoriesActesVisibles" in p ? p.categoriesActesVisibles : [],
      },
    });
  }

  // Réseau de soins "LA RUCHE Excellence" (2026-08) — voir seed-reseau-soins.ts.
  for (const r of reseauSoins) {
    await prisma.prestataire.create({
      data: {
        id: r.id, nom: r.nom, type: r.type, pays: r.pays, ville: r.ville, statutConvention: r.statutConvention,
        specialite: r.specialite, telephone: r.telephone, adresse: r.adresse,
      },
    });
  }
  const prestataireIdByNom = new Map(prestataires.map((p) => [p.nom, p.id]));

  // Compte démo du portail prestataire (2026-08) — voir demande utilisateur :
  // "portail externe dédié au prestataire médical". Créé APRÈS la boucle
  // prestataires ci-dessus (User.prestataireId a besoin que le Prestataire
  // existe déjà) ; CHU Libreville (PRS-001) a déjà un dossier réel (accord
  // préalable ACP-2024-011, prise en charge PC-2024-0234, bordereau
  // BDX-2024-001), idéal pour tester "Prestations".
  const passwordHashPrestataire = await bcrypt.hash(MOT_DE_PASSE_PORTAIL_PRESTATAIRE, 10);
  await prisma.user.create({
    data: {
      nom: "CHU Libreville", email: "facturation@chu-libreville.ga", initiales: "CL", passwordHash: passwordHashPrestataire,
      roleId: "prestataire_sante", modules: ROLE_MODULES.prestataire_sante, prestataireId: "PRS-001",
    },
  });

  // Comptes démo Pharmacie/Laboratoire (2026-08) — voir demande utilisateur :
  // "il faut créer des écrans test pour les prestataires de type Pharmacie
  // et Laboratoire afin qu'on puisse également éditer leurs écrans et
  // mettre les fonctionnalités qui leur siéent". Mêmes rôle/modules que
  // CHU Libreville — seule la visibilité (categoriesActesVisibles, voir
  // tableau prestataires ci-dessus) change ce que chacun voit côté portail.
  await prisma.user.create({
    data: {
      nom: "Pharmacie Nkembo", email: "commande@pharmacie-nkembo.ga", initiales: "PN", passwordHash: passwordHashPrestataire,
      roleId: "prestataire_sante", modules: ROLE_MODULES.prestataire_sante, prestataireId: "PRS-003",
    },
  });
  await prisma.user.create({
    data: {
      nom: "Laboratoire Bio-Gabon", email: "resultats@biogabon.ga", initiales: "LB", passwordHash: passwordHashPrestataire,
      roleId: "prestataire_sante", modules: ROLE_MODULES.prestataire_sante, prestataireId: "PRS-004",
    },
  });

  // Deuxième pharmacie/laboratoire de démo (2026-08) — voir demande
  // utilisateur : "je parle bien de deux nouveau compte" (distincts de
  // Pharmacie Nkembo/Laboratoire Bio-Gabon ci-dessus).
  await prisma.user.create({
    data: {
      nom: "Pharmacie Akanda", email: "contact@pharmacie-akanda.ga", initiales: "PA", passwordHash: passwordHashPrestataire,
      roleId: "prestataire_sante", modules: ROLE_MODULES.prestataire_sante, prestataireId: "PRS-006",
    },
  });
  await prisma.user.create({
    data: {
      nom: "Laboratoire Owendo Santé", email: "contact@labo-owendo.ga", initiales: "LO", passwordHash: passwordHashPrestataire,
      roleId: "prestataire_sante", modules: ROLE_MODULES.prestataire_sante, prestataireId: "PRS-007",
    },
  });

  // Compte démo du portail médecin (2026-08) — voir demande utilisateur :
  // "le médecin doit avoir ses accès différents de ceux de la clinique ou
  // l'hôpital... il faut donc créer un compte demo pour le médecin". Dr
  // Alice Mba intervient à CHU Libreville (PRS-001), idéal pour tester la
  // file d'attente avec les prestations déjà seedées.
  const medecinDemo = await prisma.medecin.create({
    data: {
      nom: "Mba", prenom: "Alice", titre: "Docteur", specialite: "Médecine générale",
      codePraticien: "OM-GA-7789", telephone: "+241 06 55 12 34",
      structures: { create: [{ prestataireId: "PRS-001" }] },
    },
  });
  await prisma.user.create({
    data: {
      nom: "Dr Alice Mba", email: "alice.mba@medecin.medassur.local", initiales: "AM", passwordHash,
      roleId: "medecin_prescripteur", modules: ROLE_MODULES.medecin_prescripteur, medecinId: medecinDemo.id,
    },
  });

  for (const a of assures) {
    await prisma.assureSante.create({
      data: {
        id: a.id, nom: a.nom, matricule: a.matricule, contratId: a.contratId, beneficiaires: a.beneficiaires,
        cotisation: a.cotisation, statut: a.statut, dateNaissance: a.dateNaissance, statutMatrimonial: a.statutMatrimonial,
        numeroAssure: a.numeroAssure, qrCode: a.qrCode, statutCarte: a.statutCarte, dateAffiliation: a.dateAffiliation,
        typeAssure: a.typeAssure, telephone: a.telephone,
      },
    });
    for (const m of a.membres) {
      await prisma.assureSante.create({
        data: {
          id: `${a.id}-${m.suffix}`, nom: m.nom, matricule: `${a.matricule}-${m.suffix}`, contratId: a.contratId,
          beneficiaires: 0, cotisation: 0, statut: m.statut, dateNaissance: m.dateNaissance,
          numeroAssure: `${a.numeroAssure}-${m.suffix}`, qrCode: `${a.qrCode}-${m.suffix}`, statutCarte: "Active",
          typeAssure: m.typeAssure, familleId: a.id,
        },
      });
    }
  }
  const assureIdByNom = new Map(assures.map((a) => [a.nom, a.id]));
  const assureContratIdByNom = new Map(assures.map((a) => [a.nom, a.contratId]));

  // Compte démo du portail assuré (2026-08) — voir demande utilisateur :
  // "écran externe dédié à l'assuré principal". Créé APRÈS la boucle
  // assures ci-dessus (User.assureSanteId a besoin que l'AssureSante existe
  // déjà) ; Paul Ondo (ASS-001) a 3 ayants droit et un contrat SEEG riche en
  // garanties/exercices, idéal pour tester "Ma famille"/"Mes garanties".
  await prisma.user.create({
    data: {
      nom: "Paul Ondo", email: "paul.ondo@assure.medassur.local", initiales: "PO", passwordHash,
      roleId: "assure_principal", modules: ROLE_MODULES.assure_principal, assureSanteId: "ASS-001",
    },
  });

  for (const acp of accordsPrealables) {
    await prisma.accordPrealable.create({
      data: {
        id: acp.id, assureId: assureIdByNom.get(acp.assureNom)!, contratId: assureContratIdByNom.get(acp.assureNom)!,
        type: acp.type, description: acp.description, prestataire: acp.prestataireNom, prestataireId: prestataireIdByNom.get(acp.prestataireNom),
        dateDemande: acp.dateDemande, statutAnalyseMedicale: acp.statutAnalyseMedicale,
        statutValidationFinanciere: acp.statutValidationFinanciere, decision: acp.decision,
        montantAutorise: acp.montantAutorise, dateDecision: acp.dateDecision,
      },
    });
  }

  for (const b of bordereauxReglement) {
    await prisma.bordereauReglement.create({
      data: {
        id: b.id, numero: b.numero, prestataireId: prestataireIdByNom.get(b.prestataireNom)!, periode: b.periode,
        nbPrisesEnCharge: b.nbPrisesEnCharge, montantTotal: b.montantTotal, montantValide: b.montantValide,
        statut: b.statut, dateReception: b.dateReception, datePaiement: b.datePaiement, referenceVirement: b.referenceVirement,
      },
    });
  }
  const bordereauIdByPriseEnCharge = new Map(
    bordereauxReglement.flatMap((b) => b.priseEnChargeIds.map((pcId) => [pcId, b.id])),
  );

  await prisma.priseEnCharge.createMany({
    data: prisesEnCharge.map((pc) => ({
      id: pc.id, prestataire: pc.prestataireNom, type: pc.type, montant: pc.montant, statut: pc.statut, date: pc.date,
      assureId: assureIdByNom.get(pc.assureNom)!, contratId: assureContratIdByNom.get(pc.assureNom)!, prestataireId: prestataireIdByNom.get(pc.prestataireNom),
      modePaiement: pc.modePaiement, prescriptionRef: pc.prescriptionRef, factureRef: pc.factureRef,
      statutControleMedical: pc.statutControleMedical, baseRemboursement: pc.baseRemboursement,
      tauxRemboursement: pc.tauxRemboursement, franchise: pc.franchise, plafondApplique: pc.plafondApplique,
      resteACharge: pc.resteACharge, ordrePaiement: pc.ordrePaiement, accordPrealableId: pc.accordPrealableId,
      scoreFraude: pc.scoreFraude, bordereauId: bordereauIdByPriseEnCharge.get(pc.id),
      gestionnaireId: userIdByNom.get(pc.gestionnaireNom),
    })),
  });

  await prisma.banque.createMany({ data: banques });
  await prisma.compteBancaire.createMany({ data: comptesBancaires });
  await prisma.fluxTresorerie.createMany({ data: fluxTresorerie });

  await prisma.impaye.createMany({
    data: impayes.map((i) => ({
      id: i.id, montantDu: i.montantDu, joursRetard: i.joursRetard, niveau: i.niveau, canal: i.canal, statut: i.statut,
      clientId: clientIdByNom.get(i.clientNom)!, contratId: i.contratId,
    })),
  });

  await prisma.prospect.createMany({
    data: prospects.map((p) => ({ ...p, gestionnaireId: userIdByNom.get(p.commercial) })),
  });

  for (const ao of appelsOffres) {
    await prisma.appelOffres.create({
      data: {
        id: ao.id, prospectId: ao.prospectId, clientNom: ao.clientNom, cahierCharges: ao.cahierCharges,
        garantiesDemandees: ao.garantiesDemandees, historiqueSinistres: ao.historiqueSinistres,
        projectionSP: ao.projectionSP, estimationPepm: ao.estimationPepm, estimationFondsRoulement: ao.estimationFondsRoulement,
        statut: ao.statut, dateCreation: ao.dateCreation,
        propositions: { create: ao.propositions },
      },
    });
  }

  for (const cot of cotations) {
    const { garanties, ...champs } = cot;
    await prisma.cotation.create({ data: { ...champs, garanties: { create: garanties } } });
  }

  await prisma.journalEntry.createMany({ data: journalEntries });
  await prisma.gedDocument.createMany({ data: gedDocuments });

  await prisma.fondsDeRoulement.createMany({ data: fondsDeRoulement });
  await prisma.honorairesGestion.createMany({ data: honorairesGestion });
  await prisma.scoringFraude.createMany({ data: scoringFraude });
  await prisma.auditLog.createMany({ data: auditLogs });
  await prisma.notification.createMany({ data: notifications });

  console.log(`Seed complete: ${mockUsers.length} users (password: ${DEMO_PASSWORD}), ${clients.length} clients, ${compagnies.length} compagnies, ${contrats.length} contrats santé, and all secondary domains (health insurance operating model: ${appelsOffres.length} appels d'offres, ${prestataires.length} prestataires, ${accordsPrealables.length} accords préalables, ${actesMedicaux.length} actes médicaux).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
