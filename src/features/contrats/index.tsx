import { useEffect, useRef, useState } from "react";
import { FileText, Filter, Plus, List, CheckCircle2, RefreshCw, XCircle, Ban, Trash2, Users, Calculator, ShieldCheck, Upload, X, UserCog, FileDown, AlertTriangle, ArrowRightLeft, History, Receipt, Smartphone, ClipboardCheck, Pencil, Check, Search, Unlock, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { DerniereModification } from "@/components/shared/DerniereModification";
import { ImportEnMasseModal } from "@/components/shared/ImportEnMasseModal";
import { fmt } from "@/lib/format";
import { toNumber } from "@/lib/decimal";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import GestionPopulationModal from "@/features/contrats/GestionPopulationModal";
import BasculerPopulationModal from "@/features/contrats/BasculerPopulationModal";
import ExercicePrimeModal from "@/features/contrats/ExercicePrimeModal";
import HistoriqueMouvementsTab from "@/features/contrats/HistoriqueMouvementsTab";
import ConsommationsTab from "@/features/contrats/ConsommationsTab";
import PrisesEnChargeTab from "@/features/contrats/PrisesEnChargeTab";
import PopulationPanel from "@/features/contrats/PopulationPanel";
import GenerationComptesMobileModal from "@/features/contrats/GenerationComptesMobileModal";
import {
  getContrats, createContrat, updateContrat, deleteContrat, replaceGaranties, getHistoriqueCompagnie, recalibrerExercice, getProchainNumeroPolice, toggleDerogationSaisie,
  telechargerModeleImportContrats, apercuImportContrats, confirmerImportContrats, joursRestants,
  type ContratUpsertInput, type GarantieInput, type ExerciceCompagnie, type ImportContratRow,
} from "@/services/contrats.service";
import { getClients } from "@/services/clients.service";
import { getCompagnies, getCompagniesAutoGestion } from "@/services/compagnies.service";
import { getMonAbonnement } from "@/services/societes.service";
import type { MonAbonnement } from "@/types/societes";
import { getAssuresSante, createAssure, importPopulation, readPopulationFile, downloadPopulationTemplate, type ImportPopulationResult } from "@/services/sante.service";
import { getGarantieCatalogue } from "@/services/garantieCatalogue.service";
import type { Contrat } from "@/types/contrats";
import type { Client } from "@/types/clients";
import type { Compagnie } from "@/types/compagnies";
import type { AssureSante } from "@/types/sante";
import type { GarantieCatalogueItem } from "@/types/garantieCatalogue";

import {
  CalculPrimeSection, calculerPrime, TAUX_TAXE_GABON, primeUnitairesAvecSurprime, tallyByType,
  type PersonneAvecAge,
} from "@/features/contrats/CalculPrimeSection";

// Portail d'accès rapide depuis un autre écran (2026-08) — voir onglet
// "Contrats" de CompagnieParamsDrawer, même mécanisme que
// CLE_AVENANT_A_OUVRIR (Renouvellements → Avenants) : l'écran d'origine
// dépose l'id visé en sessionStorage puis bascule la vue ; ici on le
// consomme au montage pour ouvrir directement la fiche contrat.
const CLE_CONTRAT_A_OUVRIR = "medassur:open-contrat";

const STATUT_ASSURE_BADGE: Record<string, "success" | "warning" | "danger"> = { Actif: "success", Suspendu: "warning", Radié: "danger" };

const brancheHint: Record<string, string> = {
  Maladie: "Contrat santé de base : territorialité (pays de souscription + extensions) et garanties santé.",
  Assistance: "Droit à l'évacuation sanitaire hors du pays de souscription vers l'une des extensions de territorialité.",
};

type TabId = "general" | "population" | "prime" | "historique" | "consommations" | "prisesEnCharge" | "garanties";

// La prime ne se fixe qu'à la mise en place du contrat ou lors d'un
// mouvement ultérieur (avenant) — jamais en modifiant directement la fiche
// une fois créée. En édition, "Calcul de la prime" cède donc la place à
// "Historique des mouvements" (qui fusionne aussi l'ancien onglet
// "Documents" : chaque document se rattache à son mouvement, voir
// HistoriqueMouvementsTab), "Consommations" (factures prestataires du
// contrat, voir ConsommationsTab) et "Prises en Charge" (Entente Préalable,
// voir PrisesEnChargeTab — notion distincte des Consommations malgré la
// proximité de vocabulaire).
function buildTabs(editing: boolean) {
  return [
    { id: "general" as const, label: "Informations générales", icon: FileText },
    { id: "population" as const, label: "Population", icon: Users },
    editing
      ? { id: "historique" as const, label: "Historique des mouvements", icon: History }
      : { id: "prime" as const, label: "Calcul de la prime", icon: Calculator },
    ...(editing ? [{ id: "consommations" as const, label: "Consommations", icon: Receipt }] : []),
    ...(editing ? [{ id: "prisesEnCharge" as const, label: "Prises en Charge", icon: ClipboardCheck }] : []),
    { id: "garanties" as const, label: "Garanties", icon: ShieldCheck },
  ];
}

interface PopulationRow {
  nom: string;
  dateNaissance: string;
  cotisation: number;
  beneficiaires: number;
}

// Tableau de garanties standard "Collège Cadres" (santé Gabon) — chargeable
// en un clic dans l'onglet Garanties, puis personnalisable.
const STANDARD_GARANTIES: GarantieInput[] = [
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
  // Consultation dentaire : frais réels selon BTAM, illimitée — ne consomme
  // pas le plafond partagé. Orthodontie et Soins conservateurs & prothétiques
  // partagent, eux, un même plafond de 500 000 F CFA/an (voir note catégorie).
  { categorie: "Dentisterie", libelle: "Consultation", tauxAssure: 80, tauxAyantsDroit: 100, plafond: "80% frais réels selon BTAM" },
  { categorie: "Dentisterie", libelle: "Orthodontie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM 500 000 F CFA / AN — plafond partagé avec Soins conservateurs & prothétiques", plafondMontant: 500_000, plafondPeriode: "An" },
  { categorie: "Dentisterie", libelle: "Soins conservateurs & prothétiques", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM 500 000 F CFA / AN — plafond partagé avec Orthodontie", plafondMontant: 500_000, plafondPeriode: "An" },
  { categorie: "Hospitalisation", libelle: "Hébergement", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "50 000 F CFA BTAM" },
  { categorie: "Hospitalisation", libelle: "Frais de traitement médicaux & chirurgicaux", tauxAssure: 100, tauxAyantsDroit: 100, plafond: undefined },
  { categorie: "Maternité", libelle: "Frais pré & Natals", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "BTAM" },
  { categorie: "Maternité", libelle: "Accouchement Simple", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "400 000 F CFA" },
  { categorie: "Maternité", libelle: "Accouchement Multiple", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "800 000 F CFA" },
  { categorie: "Optique", libelle: "Verres + Montures", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / 2 ANS" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Kinésithérapie & Cure Thermale", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Orthophonie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Kinésithérapie & Cure thermale", libelle: "Orthoptie", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "200 000 F CFA / AN" },
  { categorie: "Transport", libelle: "Ambulance", tauxAssure: 100, tauxAyantsDroit: 100, plafond: "70 000 F CFA" },
];

// Garanties du contrat d'Assistance (évacuation sanitaire hors du pays de
// souscription) — structurellement différentes de la Maladie : pas de
// taux Structures Privées/Publiques, juste une rubrique + un plafond.
const STANDARD_GARANTIES_ASSISTANCE: GarantieInput[] = [
  { categorie: "Assistance", libelle: "Transport sanitaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Transport du corps en cas de décès du bénéficiaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Retour après convalescence", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Accompagnement du bénéficiaire", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Voyage en cas de décès d'un proche parent", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Billet de visite", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Frais d'avocat", plafond: "Prise en charge intégrale" },
  { categorie: "Assistance", libelle: "Avance de caution pénale", plafond: "Prise en charge intégrale" },
];

function emptyForm(): ContratUpsertInput {
  return {
    clientId: "", compagnieId: "", branche: "Maladie", dateDebut: "", dateFin: "", prime: 0, statut: "Actif",
    numeroPolice: "",
    periodicite: "Annuel",
    produit: "",
    paysSouscription: "Gabon", extensionsTerritorialite: [],
    tauxCouvertureAmbulatoire: "", tauxCouvertureHospitalisation: "",
    tauxAmbulatoirePublique: "", tauxAmbulatoirePrivee: "", tauxHospitalisationPublique: "", tauxHospitalisationPrivee: "",
    tauxAmbulatoirePubliqueAyantDroit: "", tauxAmbulatoirePriveeAyantDroit: "", tauxHospitalisationPubliqueAyantDroit: "", tauxHospitalisationPriveeAyantDroit: "",
    nombreAssuresPrincipaux: 0, primeUnitaireAssurePrincipal: 0,
    nombreConjoints: 0, primeUnitaireConjoint: 0,
    nombreEnfants: 0, primeUnitaireEnfant: 0,
    nombreCouples: 0, primeUnitaireCouple: 0,
    tauxTerritorialite: 0, limiteAgeAdulte: 65, limiteAgeEnfant: 21, limiteAgeEnfantScolarise: 28, limitePersFamille: 21,
    plafondAdherent: undefined, plafondFamille: undefined, plafondPolice: undefined,
    tauxMinoMajoration: 0, tauxReductionCommerciale: 0, montantAccessoires: 0, tauxCommission: 0,
  };
}

function contratToForm(c: Contrat, clients: Client[], compagnies: Compagnie[]): ContratUpsertInput {
  return {
    clientId: clients.find((cl) => cl.nom === c.client)?.id ?? "",
    compagnieId: compagnies.find((co) => co.nom === c.compagnie)?.id ?? "",
    branche: c.branche === "Assistance" ? "Assistance" : "Maladie",
    dateDebut: c.dateDebut, dateFin: c.dateFin, prime: c.prime,
    statut: c.statut as ContratUpsertInput["statut"],
    numeroPolice: c.numeroPolice ?? "",
    periodicite: (c.periodicite as ContratUpsertInput["periodicite"]) ?? "Annuel",
    produit: c.produit ?? "",
    paysSouscription: c.paysSouscription || "Gabon",
    extensionsTerritorialite: c.extensionsTerritorialite ?? [],
    contratMaladieLieId: c.contratMaladieLieId ?? undefined,
    tauxCouvertureAmbulatoire: c.tauxCouvertureAmbulatoire ?? "",
    tauxCouvertureHospitalisation: c.tauxCouvertureHospitalisation ?? "",
    tauxAmbulatoirePublique: c.tauxAmbulatoirePublique ?? "",
    tauxAmbulatoirePrivee: c.tauxAmbulatoirePrivee ?? "",
    tauxHospitalisationPublique: c.tauxHospitalisationPublique ?? "",
    tauxHospitalisationPrivee: c.tauxHospitalisationPrivee ?? "",
    tauxAmbulatoirePubliqueAyantDroit: c.tauxAmbulatoirePubliqueAyantDroit ?? "",
    tauxAmbulatoirePriveeAyantDroit: c.tauxAmbulatoirePriveeAyantDroit ?? "",
    tauxHospitalisationPubliqueAyantDroit: c.tauxHospitalisationPubliqueAyantDroit ?? "",
    tauxHospitalisationPriveeAyantDroit: c.tauxHospitalisationPriveeAyantDroit ?? "",
    nombreAssuresPrincipaux: c.nombreAssuresPrincipaux ?? 0,
    primeUnitaireAssurePrincipal: c.primeUnitaireAssurePrincipal ?? 0,
    nombreConjoints: c.nombreConjoints ?? 0,
    primeUnitaireConjoint: c.primeUnitaireConjoint ?? 0,
    nombreEnfants: c.nombreEnfants ?? 0,
    primeUnitaireEnfant: c.primeUnitaireEnfant ?? 0,
    nombreCouples: c.nombreCouples ?? 0,
    primeUnitaireCouple: c.primeUnitaireCouple ?? 0,
    tauxTerritorialite: c.tauxTerritorialite ?? 0,
    limiteAgeAdulte: c.limiteAgeAdulte ?? 65,
    limiteAgeEnfant: c.limiteAgeEnfant ?? 21,
    limiteAgeEnfantScolarise: c.limiteAgeEnfantScolarise ?? 28,
    limitePersFamille: c.limitePersFamille ?? 21,
    plafondAdherent: c.plafondAdherent ?? undefined,
    plafondFamille: c.plafondFamille ?? undefined,
    plafondPolice: c.plafondPolice ?? undefined,
    tauxMinoMajoration: c.tauxMinoMajoration ?? 0,
    tauxReductionCommerciale: c.tauxReductionCommerciale ?? 0,
    montantAccessoires: c.montantAccessoires ?? 0,
    tauxCommission: c.tauxCommission ?? 0,
  };
}

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Filtre par échéance (2026-08) — comparaison de dates JJ/MM/AAAA, jamais
// lexicographique (non fiable sur ce format — "05/01/2026" > "12/12/2025"
// en comparaison de chaînes, alors que la vraie date est antérieure).
function parseDateFrFiltre(s: string): Date | null {
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

interface ImportedPersonRow {
  matricule: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  typeAssure: string;
  telephone: string;
  photo: string;
}

function formatNom(s: string): string {
  return s.trim().toUpperCase();
}

// Applique la règle "première lettre en majuscule, le reste en minuscule"
// mot par mot (prénoms composés : "Nehemie Abigail" reste "Nehemie Abigail").
function formatPrenomMots(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Le fichier réel fusionne Nom et Prénom dans une seule colonne ("Noms &
// Prénoms") : les mots intégralement en capitales forment le Nom
// (patronyme), le reste forme le Prénom — ex. "LOUSSOU OBISSA Francis"
// → Nom "LOUSSOU OBISSA", Prénom "Francis".
function splitNomPrenom(full: string): { nom: string; prenom: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { nom: "", prenom: "" };
  const isAllCaps = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
  let i = 0;
  while (i < words.length && isAllCaps(words[i])) i++;
  if (i === 0) i = 1;
  if (i >= words.length) i = Math.max(1, words.length - 1);
  return { nom: formatNom(words.slice(0, i).join(" ")), prenom: formatPrenomMots(words.slice(i).join(" ")) };
}

// Colonnes du fichier réel (export compagnie/courtier) : Matricule;Noms &
// Prénoms;Nationalité;Dat Nais;Sexe;Type assuré;Date de
// souscription;Période de PEC;Référence contrat;Produit;Adresse — le nom
// complet (colonne 2) est scindé automatiquement en Nom/Prénom. Téléphone
// (12) et Photo (13) sont ajoutés en fin de ligne — absents sur un fichier
// réel existant, ils restent simplement vides (comportement inchangé).
// Chaque ligne reste ensuite éditable dans l'aperçu avant l'import définitif.
function parseImportRows(csv: string): ImportedPersonRow[] {
  const lines = csv.split(/\r\n|\r|\n/).slice(1);
  return lines
    .map((line) => line.split(";"))
    .filter((cells) => !!cells[1]?.trim())
    .map((cells) => {
      const { nom, prenom } = splitNomPrenom(cells[1] ?? "");
      return {
        matricule: (cells[0] ?? "").trim(),
        nom, prenom,
        dateNaissance: (cells[3] ?? "").trim(),
        sexe: (cells[4] ?? "").trim().toUpperCase(),
        typeAssure: (cells[5] ?? "").trim().toUpperCase(),
        telephone: (cells[11] ?? "").trim(),
        photo: (cells[12] ?? "").trim(),
      };
    });
}

interface IndexedImportRow {
  row: ImportedPersonRow;
  index: number;
}

interface ImportedFamily {
  principal: IndexedImportRow;
  ayants: IndexedImportRow[];
}

// Toutes les fois qu'on retombe sur "AS", c'est une nouvelle famille — les
// CJ/EF qui suivent jusqu'au prochain AS sont les ayants droit de cette
// famille (même règle que le regroupement fait côté serveur à l'import).
// L'index d'origine est conservé pour pouvoir éditer chaque ligne en place.
function groupImportRowsByFamily(rows: ImportedPersonRow[]): ImportedFamily[] {
  const families: ImportedFamily[] = [];
  rows.forEach((row, index) => {
    if (row.typeAssure === "AS" || families.length === 0) {
      families.push({ principal: { row, index }, ayants: [] });
    } else {
      families[families.length - 1].ayants.push({ row, index });
    }
  });
  return families;
}

// Le résumé global (Ambulatoires/Hospitalisations) doit impacter les
// rubriques itemisées correspondantes, à l'exception des rubriques qui
// restent fixées à 100% par défaut (précisé par l'utilisateur) :
// Dentisterie, Optique, Kinésithérapie & Cure thermale, Transport, EVASAN
// en entier, et uniquement les 2 lignes "Accouchement" dans Maternité
// ("Frais pré & Natals" reste, lui, piloté par Ambulatoires).
const GARANTIES_FIXEES_100 = ["Dentisterie", "Optique", "Kinésithérapie & Cure thermale", "Transport", "EVASAN"];
const LIBELLES_MATERNITE_FIXES = ["Accouchement Simple", "Accouchement Multiple"];

// Le plafond de certaines catégories est UNE SEULE enveloppe partagée entre
// plusieurs rubriques (pas un plafond par ligne) — affiché comme note sous
// l'en-tête de catégorie. Le montant numérique (plafondMontant) saisi sur
// ces rubriques sert au blocage automatique des prises en charge une fois
// l'enveloppe atteinte sur l'exercice courant (voir SanteService.verifierPlafondPartage).
const CATEGORIES_PLAFOND_PARTAGE: Record<string, string> = {
  Dentisterie: "Plafond de 500 000 F CFA/an partagé entre Orthodontie et Soins conservateurs & prothétiques uniquement — la Consultation est en frais réels, illimitée, hors de cette enveloppe.",
};
const RUBRIQUES_HORS_ENVELOPPE: Record<string, string[]> = { Dentisterie: ["Consultation"] };

function estDansEnveloppePartagee(categorie: string, libelle: string): boolean {
  if (!CATEGORIES_PLAFOND_PARTAGE[categorie]) return false;
  return !(RUBRIQUES_HORS_ENVELOPPE[categorie] ?? []).includes(libelle.trim());
}

type GarantieBucket = "ambulatoire" | "hospitalisation" | "fixe";

function bucketForGarantie(categorie: string, libelle: string): GarantieBucket {
  const cat = categorie.trim();
  if (cat.toLowerCase().includes("hospit")) return "hospitalisation";
  if (GARANTIES_FIXEES_100.some((c) => c.toLowerCase() === cat.toLowerCase())) return "fixe";
  if (cat.toLowerCase() === "maternité" && LIBELLES_MATERNITE_FIXES.includes(libelle.trim())) return "fixe";
  return "ambulatoire";
}

// tauxAssure = Structures Privées, tauxAyantsDroit = Structures Publiques
// (libellés internes conservés — seul l'affichage a changé). Une saisie à
// une seule valeur (ex: "90") ne fixe que les Structures Privées ; les
// Structures Publiques défautent à 100%, pas à la même valeur.
function parseTauxCouverture(value: string): { tauxAssure?: number; tauxAyantsDroit?: number } {
  const matches = value.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length === 0) return {};
  const nums = matches.map((m) => Number.parseFloat(m.replace(",", ".")));
  return { tauxAssure: nums[0], tauxAyantsDroit: nums[1] ?? 100 };
}

const FRAIS_REELS_BTAM_PATTERN = /frais réels selon BTAM/i;

function plafondFraisReelsBTAM(tauxPrive?: number, tauxPublic?: number): string {
  return `${tauxPrive ?? 0}% / ${tauxPublic ?? 0}% frais réels selon BTAM`;
}

function applyResumeGlobalToRows(rows: GarantieInput[], ambulatoire: string, hospitalisation: string): GarantieInput[] {
  const ambu = parseTauxCouverture(ambulatoire);
  const hosp = parseTauxCouverture(hospitalisation);
  return rows.map((row) => {
    const bucket = bucketForGarantie(row.categorie, row.libelle);
    if (bucket === "fixe") return row;
    const taux = bucket === "hospitalisation" ? hosp : ambu;
    if (taux.tauxAssure === undefined) return row;
    const plafond = row.plafond && FRAIS_REELS_BTAM_PATTERN.test(row.plafond)
      ? plafondFraisReelsBTAM(taux.tauxAssure, taux.tauxAyantsDroit)
      : row.plafond;
    return { ...row, tauxAssure: taux.tauxAssure, tauxAyantsDroit: taux.tauxAyantsDroit, plafond };
  });
}

export default function ContratsView() {
  const { shellActionRequest } = useShellNavigation();
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [compagniesAutoGestion, setCompagniesAutoGestion] = useState<Compagnie[]>([]);
  const [typeGestion, setTypeGestion] = useState<"Classique" | "AutoGestion">("Classique");
  // Type de société (2026-09) — voir demande utilisateur : "une compagnie
  // n'a pas besoin de choisir une compagnie sur ses contrats puisqu'elle
  // EST la compagnie." Une société Mutuelle/Compagnie a une compagnie
  // interne auto-provisionnée (voir SocieteAssurance.compagnieInterneId) :
  // le sélecteur Compagnie du formulaire ci-dessous se masque à sa place.
  const [moi, setMoi] = useState<MonAbonnement | null>(null);
  useEffect(() => { getMonAbonnement().then(setMoi).catch(() => undefined); }, []);
  const [historiqueCompagnie, setHistoriqueCompagnie] = useState<ExerciceCompagnie[]>([]);
  // Correction manuelle d'un exercice (2026-08) — voir demande utilisateur :
  // "il peut arriver que les données de l'import de date d'un exercice ne
  // soit pas correct... récalibrage au niveau des échéances et des dates
  // d'effet". Un seul exercice éditable à la fois (numéro visé + brouillon
  // de dates), le serveur renvoie l'historique COMPLET déjà recalibré.
  const [exerciceEnEdition, setExerciceEnEdition] = useState<number | null>(null);
  const [brouillonExercice, setBrouillonExercice] = useState<{ dateDebut: string; dateFin: string }>({ dateDebut: "", dateFin: "" });
  const [recalibrageEnCours, setRecalibrageEnCours] = useState(false);
  // Prime détaillée d'un exercice passé (2026-09) — voir ExercicePrimeModal.
  const [exercicePrimeCible, setExercicePrimeCible] = useState<ExerciceCompagnie | null>(null);
  const [derogationEnCours, setDerogationEnCours] = useState(false);
  const [catalogue, setCatalogue] = useState<GarantieCatalogueItem[]>([]);
  const [gestionPopulationContrat, setGestionPopulationContrat] = useState<Contrat | null>(null);
  const [comptesMobileContrat, setComptesMobileContrat] = useState<Contrat | null>(null);
  const [basculePopulationContrat, setBasculePopulationContrat] = useState<Contrat | null>(null);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [brancheFilter, setBrancheFilter] = useState<"Tous" | "Maladie" | "Assistance">("Tous");
  // "Résilié" (2026-08 — voir demande utilisateur : import de contrats,
  // statut "Terminé" de l'ancien système = "inactif dans le sens du
  // contrat résilié") — un contrat importé peut désormais porter ce statut
  // directement (sans passer par le workflow Avenant "Résiliation"),
  // visible et filtrable ici comme les autres.
  const statuts = ["Tous", "Actif", "En renouvellement", "Expiré", "Résilié"];
  // Recherche + filtres compagnie/échéance (2026-08 — voir demande
  // utilisateur : "mettre une barre de recherche des contrats, permettre
  // aussi le filtre de contrat par échéance, par compagnie"). Tout
  // client-side — la liste complète est déjà chargée en mémoire (comme le
  // statut/branche existants), pas de requête serveur dédiée.
  const [rechercheContrat, setRechercheContrat] = useState("");
  const [compagnieFilter, setCompagnieFilter] = useState<Compagnie | null>(null);
  const [echeanceDu, setEcheanceDu] = useState("");
  const [echeanceAu, setEcheanceAu] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [editing, setEditing] = useState<Contrat | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<ContratUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [existingPopulation, setExistingPopulation] = useState<AssureSante[]>([]);
  const [newPopulationRows, setNewPopulationRows] = useState<PopulationRow[]>([]);
  const [garantieRows, setGarantieRows] = useState<GarantieInput[]>([]);
  const [importFile, setImportFile] = useState<{ name: string; rows: ImportedPersonRow[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [importRejected, setImportRejected] = useState<ImportPopulationResult["rejected"]>([]);
  const [manualPopulationEntry, setManualPopulationEntry] = useState(false);
  const [appliquerSurprimeAge, setAppliquerSurprimeAge] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => getContrats().then(setContrats);

  useEffect(() => {
    refresh();
    getClients().then(setClients);
    getCompagnies().then(setCompagnies);
    getCompagniesAutoGestion().then(setCompagniesAutoGestion);
    getGarantieCatalogue().then(setCatalogue);
  }, []);

  const rechercheNorm = rechercheContrat.trim().toLowerCase();
  const echeanceDuDate = parseDateFrFiltre(echeanceDu);
  const echeanceAuDate = parseDateFrFiltre(echeanceAu);
  const filtered = contrats.filter((c) => {
    if (statusFilter !== "Tous" && c.statut !== statusFilter) return false;
    if (brancheFilter !== "Tous" && c.branche !== brancheFilter) return false;
    if (compagnieFilter && c.compagnie !== compagnieFilter.nom) return false;
    if (rechercheNorm) {
      const cible = `${c.id} ${c.client} ${c.compagnie} ${c.numeroPolice ?? ""}`.toLowerCase();
      if (!cible.includes(rechercheNorm)) return false;
    }
    if (echeanceDuDate || echeanceAuDate) {
      const echeance = parseDateFrFiltre(c.dateFin);
      if (!echeance) return false;
      if (echeanceDuDate && echeance < echeanceDuDate) return false;
      if (echeanceAuDate && echeance > echeanceAuDate) return false;
    }
    return true;
  });
  const statusIcon: Record<string, React.ElementType> = {
    "Tous": List,
    "Actif": CheckCircle2,
    "En renouvellement": RefreshCw,
    "Expiré": XCircle,
    "Résilié": Ban,
  };

  // Depuis l'unification du modèle famille, chaque ligne AssureSante EST une
  // personne (principal ou membre) — plus de comptage via l'ancien champ
  // "beneficiaires" (vestige des affiliations manuelles, voir PopulationRow).
  const existingPopulationCount = existingPopulation.length;
  const newPopulationCount = newPopulationRows.reduce((sum, r) => sum + 1 + r.beneficiaires, 0);
  const importedCount = importFile?.rows.length ?? 0;
  const totalPopulation = existingPopulationCount + newPopulationCount + importedCount;

  // La population déjà affiliée (fiche en édition) et celle du fichier
  // importé sont catégorisées AS/CJ/EF — ces effectifs remontent
  // automatiquement dans le calcul de la prime, sauf activation de la
  // saisie manuelle.
  const existingTally = tallyByType(existingPopulation);
  const importedTally = tallyByType(importFile?.rows ?? []);
  const importedFamilies = importFile ? groupImportRowsByFamily(importFile.rows) : [];
  const flatImportRows = importedFamilies.flatMap((fam) => [fam.principal, ...fam.ayants]);
  const importSearchQuery = importSearch.trim().toLowerCase();
  const filteredImportRows = importSearchQuery
    ? flatImportRows.filter(({ row }) =>
        row.nom.toLowerCase().includes(importSearchQuery) ||
        row.prenom.toLowerCase().includes(importSearchQuery) ||
        row.matricule.toLowerCase().includes(importSearchQuery),
      )
    : flatImportRows;
  const visibleImportRows = filteredImportRows.slice(0, 200);
  const computedAS = existingTally.AS + importedTally.AS;
  const computedCJ = existingTally.CJ + importedTally.CJ;
  const computedEF = existingTally.EF + importedTally.EF;
  const hasCategorizedPopulation = computedAS + computedCJ + computedEF > 0;
  const populationSourceIsAuto = hasCategorizedPopulation && !manualPopulationEntry;

  useEffect(() => {
    if (!populationSourceIsAuto) return;
    setForm((v) =>
      v.nombreAssuresPrincipaux === computedAS && v.nombreConjoints === computedCJ && v.nombreEnfants === computedEF
        ? v
        : { ...v, nombreAssuresPrincipaux: computedAS, nombreConjoints: computedCJ, nombreEnfants: computedEF },
    );
  }, [populationSourceIsAuto, computedAS, computedCJ, computedEF]);

  const openCreate = () => {
    setEditing(null);
    // Société Mutuelle/Compagnie : compagnie interne assignée d'emblée,
    // le sélecteur reste masqué (voir bloc Compagnie plus bas).
    setForm(moi?.type && moi.type !== "Courtier" && moi.compagnieInterneId ? { ...emptyForm(), compagnieId: moi.compagnieInterneId } : emptyForm());
    setNewPopulationRows([]);
    setExistingPopulation([]);
    setGarantieRows([]);
    setImportFile(null);
    setImportSearch("");
    setImportRejected([]);
    setManualPopulationEntry(false);
    setAppliquerSurprimeAge(false);
    setTypeGestion("Classique");
    setHistoriqueCompagnie([]);
    setFormError(null);
    setActiveTab("general");
    setShowCreate(true);
  };

  // Raccourci d'accès rapide depuis le bandeau (2026-08) — voir AdminShell.tsx.
  useEffect(() => {
    if (shellActionRequest?.view === "contrats" && shellActionRequest.label === "Nouveau contrat") openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellActionRequest]);

  const openEdit = (c: Contrat) => {
    setEditing(c);
    // Le nom peut correspondre à une vraie compagnie ou à un profil
    // Auto-Gestion (voir toggle "Type de gestion") — chercher dans les deux.
    const f = contratToForm(c, clients, [...compagnies, ...compagniesAutoGestion]);
    setForm(f);
    setTypeGestion(compagniesAutoGestion.some((ag) => ag.id === f.compagnieId) ? "AutoGestion" : "Classique");
    setNewPopulationRows([]);
    setGarantieRows(c.garanties.map((g) => ({ categorie: g.categorie, libelle: g.libelle, tauxAssure: g.tauxAssure ?? undefined, tauxAyantsDroit: g.tauxAyantsDroit ?? undefined, plafond: g.plafond ?? undefined })));
    // Assistance liée : jamais sa propre population, toujours celle de son
    // contrat Maladie lié (voir handleContratMaladieLieChange).
    const popSourceId = c.branche === "Assistance" && c.contratMaladieLieId ? c.contratMaladieLieId : c.id;
    getAssuresSante().then((all) => setExistingPopulation(all.filter((a) => a.police === popSourceId)));
    setImportFile(null);
    setImportSearch("");
    setImportRejected([]);
    setManualPopulationEntry(false);
    setAppliquerSurprimeAge(false);
    setFormError(null);
    setActiveTab("general");
    setShowCreate(true);
    setExerciceEnEdition(null);
    getHistoriqueCompagnie(c.id).then(setHistoriqueCompagnie);
  };

  const ouvrirEditionExercice = (ex: ExerciceCompagnie) => {
    setExerciceEnEdition(ex.numero);
    setBrouillonExercice({ dateDebut: ex.dateDebut, dateFin: ex.dateFin });
  };

  const enregistrerRecalibrageExercice = async () => {
    if (!editing || exerciceEnEdition === null) return;
    if (!brouillonExercice.dateDebut || !brouillonExercice.dateFin) { toast.error("Date d'effet et date d'échéance obligatoires."); return; }
    setRecalibrageEnCours(true);
    try {
      const historique = await recalibrerExercice(editing.id, exerciceEnEdition, brouillonExercice);
      setHistoriqueCompagnie(historique);
      const dernier = historique[historique.length - 1];
      if (dernier) setEditing((v) => (v ? { ...v, dateDebut: dernier.dateDebut, dateFin: dernier.dateFin, exerciceNumero: dernier.numero } : v));
      setExerciceEnEdition(null);
      toast.success("Exercice corrigé — les exercices suivants ont été recalibrés.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Correction impossible.");
    } finally {
      setRecalibrageEnCours(false);
    }
  };

  const deepLinkConsomme = useRef(false);
  useEffect(() => {
    if (deepLinkConsomme.current) return;
    const id = sessionStorage.getItem(CLE_CONTRAT_A_OUVRIR);
    if (!id) return;
    if (contrats.length === 0 || clients.length === 0) return; // attend le chargement des référentiels nécessaires à openEdit
    deepLinkConsomme.current = true;
    sessionStorage.removeItem(CLE_CONTRAT_A_OUVRIR);
    const trouve = contrats.find((c) => c.id === id);
    if (trouve) openEdit(trouve);
    else toast.error("Contrat introuvable.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrats, clients]);

  const closeModal = () => {
    setShowCreate(false);
    setEditing(null);
    setFormError(null);
    setExerciceEnEdition(null);
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await readPopulationFile(file);
      const rows = parseImportRows(content);
      if (rows.length === 0) {
        toast.error("Aucune ligne exploitable détectée dans ce fichier.");
        return;
      }
      setImportFile({ name: file.name, rows });
      toast.success(`${rows.length} ligne(s) détectée(s) dans ${file.name} — vérifiez et corrigez si besoin ci-dessous avant l'import.`);
    } catch {
      toast.error("Impossible de lire ce fichier.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearImportFile = () => { setImportFile(null); setImportSearch(""); };

  const updateImportRow = (index: number, patch: Partial<ImportedPersonRow>) => {
    setImportFile((f) => (f ? { ...f, rows: f.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : f));
  };

  // Le taux de commission par défaut est paramétré dans la fiche compagnie
  // (un taux par branche, Maladie/Assistance) — repris automatiquement à la
  // sélection de la compagnie ou de la branche, sans empêcher un ajustement
  // manuel ensuite.
  const tauxCommissionCompagnie = (compagnieId: string, branche: string) => {
    const compagnie = [...compagnies, ...compagniesAutoGestion].find((c) => c.id === compagnieId);
    if (!compagnie) return undefined;
    const taux = branche === "Assistance" ? compagnie.tauxCommissionAssistance : compagnie.tauxCommissionMaladie;
    return taux ?? undefined;
  };

  const handleCompagnieChange = (compagnieId: string) => {
    const taux = tauxCommissionCompagnie(compagnieId, form.branche);
    setForm((v) => ({ ...v, compagnieId, tauxCommission: taux !== undefined ? taux : v.tauxCommission }));
    // Numéro de police (2026-08) — suggestion auto-calculée uniquement à la
    // création (jamais en édition, où le numéro déjà attribué ne doit pas
    // être silencieusement remplacé) — voir demande utilisateur : reste
    // éditable ensuite pour la reprise d'antériorité.
    if (!editing && compagnieId) {
      getProchainNumeroPolice(compagnieId).then((numeroPolice) => setForm((v) => ({ ...v, numeroPolice })));
    }
  };

  // Auto-Gestion — le souscripteur est sa propre "compagnie" : pas de
  // sélection libre, on résout son profil (créé depuis l'écran
  // Auto-Gestion) et on fixe compagnieId dessus, exactement comme le ferait
  // le sélecteur Compagnie classique.
  const profilAutoGestion = compagniesAutoGestion.find((c) => c.clientId === form.clientId);
  const appliquerAutoGestion = (clientId: string) => {
    const profil = compagniesAutoGestion.find((c) => c.clientId === clientId);
    if (!profil) {
      setForm((v) => ({ ...v, compagnieId: "" }));
      return;
    }
    const taux = tauxCommissionCompagnie(profil.id, form.branche);
    setForm((v) => ({ ...v, compagnieId: profil.id, tauxCommission: taux !== undefined ? taux : v.tauxCommission }));
  };

  const selectedCompagnie = [...compagnies, ...compagniesAutoGestion].find((c) => c.id === form.compagnieId);

  // Assistance liée (2026-08) — un contrat Assistance lié à un contrat
  // Maladie n'a jamais sa propre population : elle est lue depuis le
  // contrat Maladie choisi ici (même mécanisme existingPopulation que
  // l'édition d'un contrat existant, voir openEdit), jamais ré-importée.
  const handleContratMaladieLieChange = (contratMaladieLieId: string) => {
    setForm((v) => ({ ...v, contratMaladieLieId: contratMaladieLieId || undefined }));
    if (contratMaladieLieId) {
      getAssuresSante().then((all) => setExistingPopulation(all.filter((a) => a.police === contratMaladieLieId)));
    } else {
      setExistingPopulation([]);
    }
  };
  // Contrats Maladie éligibles à un lien Assistance (2026-09) — voir demande
  // utilisateur : "l'assistance n'existe que si un contrat a l'extension de
  // territorialité" : un contrat Maladie SANS extension de territorialité
  // n'a rien à couvrir en Assistance et ne doit donc pas apparaître dans ce
  // sélecteur — même règle déjà appliquée à l'indicateur de la liste des
  // contrats (voir plus bas, "c.branche === 'Maladie' && extensionsTerritorialite...").
  // Comparaison par clientId (pas par nom, fragile si deux clients
  // partagent le même nom).
  const contratsMaladieDuClient = contrats.filter(
    (c) => c.branche === "Maladie" && c.clientId === form.clientId && (c.extensionsTerritorialite?.length ?? 0) > 0,
  );

  // Population individualisée (avec date de naissance) disponible pour le
  // calcul de la surprime d'âge — assurés déjà affiliés (édition), lignes
  // du fichier importé, et le principal de chaque ligne ajoutée à la main
  // (ses éventuels bénéficiaires n'ont pas d'âge individuel connu, voir
  // montantCategorie dans CalculPrimeSection).
  const populationAvecAge: PersonneAvecAge[] = [
    ...existingPopulation
      .filter((a): a is AssureSante & { typeAssure: "AS" | "CJ" | "EF" } => a.typeAssure === "AS" || a.typeAssure === "CJ" || a.typeAssure === "EF")
      .map((a) => ({ categorie: a.typeAssure, dateNaissance: a.dateNaissance })),
    ...(importFile?.rows ?? [])
      .filter((r): r is ImportedPersonRow & { typeAssure: "AS" | "CJ" | "EF" } => r.typeAssure === "AS" || r.typeAssure === "CJ" || r.typeAssure === "EF")
      .map((r) => ({ categorie: r.typeAssure, dateNaissance: r.dateNaissance })),
    ...newPopulationRows.map((r) => ({ categorie: "AS" as const, dateNaissance: r.dateNaissance })),
  ];
  const surprimeAgeOptions = {
    actif: appliquerSurprimeAge,
    grille: selectedCompagnie?.surprimesAge ?? [],
    population: populationAvecAge,
  };

  const toggleExtension = (ext: string) => {
    setForm((v) => ({
      ...v,
      extensionsTerritorialite: v.extensionsTerritorialite?.includes(ext)
        ? v.extensionsTerritorialite.filter((e) => e !== ext)
        : [...(v.extensionsTerritorialite ?? []), ext],
    }));
  };

  const addPopulationRow = () => {
    setNewPopulationRows((rows) => [...rows, { nom: "", dateNaissance: "", cotisation: form.primeUnitaireAssurePrincipal ?? 0, beneficiaires: 0 }]);
  };
  const updatePopulationRow = (index: number, patch: Partial<PopulationRow>) => {
    setNewPopulationRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const removePopulationRow = (index: number) => {
    setNewPopulationRows((rows) => rows.filter((_, i) => i !== index));
  };

  const addGarantieRow = () => {
    const categorie = form.branche === "Assistance" ? "Assistance" : "";
    setGarantieRows((rows) => [...rows, { categorie, libelle: "", tauxAssure: undefined, tauxAyantsDroit: undefined, plafond: "" }]);
  };
  const updateGarantieRow = (index: number, patch: Partial<GarantieInput>) => {
    setGarantieRows((rows) => rows.map((r, i) => {
      if (i !== index) return r;
      const next = { ...r, ...patch };
      if (("tauxAssure" in patch || "tauxAyantsDroit" in patch) && next.plafond && FRAIS_REELS_BTAM_PATTERN.test(next.plafond)) {
        next.plafond = plafondFraisReelsBTAM(next.tauxAssure, next.tauxAyantsDroit);
      }
      return next;
    }));
  };
  const removeGarantieRow = (index: number) => {
    setGarantieRows((rows) => rows.filter((_, i) => i !== index));
  };
  const loadStandardGaranties = () => {
    if (form.branche === "Assistance") {
      setGarantieRows(STANDARD_GARANTIES_ASSISTANCE.map((g) => ({ ...g })));
      toast.success("Garanties standard d'Assistance chargées — personnalisez-les si besoin.");
      return;
    }
    const rows = STANDARD_GARANTIES.map((g) => ({ ...g }));
    setGarantieRows(applyResumeGlobalToRows(rows, form.tauxCouvertureAmbulatoire ?? "", form.tauxCouvertureHospitalisation ?? ""));
    toast.success("Tableau de garanties standard chargé — personnalisez-le si besoin.");
  };

  // Une rubrique créée dans le catalogue (Paramètres) peut être rattachée
  // à n'importe quel contrat — on l'ajoute avec ses valeurs par défaut,
  // puis le résumé global l'ajuste comme n'importe quelle autre ligne.
  const addFromCatalogue = (catalogueId: string) => {
    const item = catalogue.find((c) => c.id === catalogueId);
    if (!item) return;
    const row: GarantieInput = {
      categorie: item.categorie, libelle: item.libelle,
      tauxAssure: item.tauxAssureDefaut, tauxAyantsDroit: item.tauxAyantsDroitDefaut,
      plafond: item.plafondDefaut ?? "",
    };
    setGarantieRows((rows) => [...rows, applyResumeGlobalToRows([row], form.tauxCouvertureAmbulatoire ?? "", form.tauxCouvertureHospitalisation ?? "")[0]]);
  };

  // Le résumé global doit "systématiquement" impacter les rubriques
  // itemisées de la catégorie correspondante, y compris sur un tableau
  // déjà chargé.
  const handleResumeGlobalChange = (field: "tauxCouvertureAmbulatoire" | "tauxCouvertureHospitalisation", value: string) => {
    const nextAmbu = field === "tauxCouvertureAmbulatoire" ? value : (form.tauxCouvertureAmbulatoire ?? "");
    const nextHosp = field === "tauxCouvertureHospitalisation" ? value : (form.tauxCouvertureHospitalisation ?? "");
    setForm((v) => ({ ...v, [field]: value }));
    setGarantieRows((rows) => applyResumeGlobalToRows(rows, nextAmbu, nextHosp));
  };

  // Même formule que withComputedPrime côté serveur (voir
  // CalculPrimeSection.tsx) — recalculée à chaque frappe pour l'aperçu en
  // direct, le serveur restant la source d'autorité finale au submit.
  const calc = calculerPrime(form, surprimeAgeOptions);

  const validate = () => {
    if (!form.clientId || !form.compagnieId || !form.dateDebut || !form.dateFin) {
      return "Souscripteur, compagnie et dates sont obligatoires (onglet Informations générales).";
    }
    // La prime (population × primes unitaires, ou prime manuelle) n'est
    // PAS obligatoire pour enregistrer un contrat — voir demande
    // utilisateur : "on doit pouvoir créer les garanties sans forcément
    // avoir déjà calculé la prime." Un contrat peut donc être créé/modifié
    // à 0 (garanties, population) et tarifé plus tard (onglet Calcul de la
    // prime), sans blocage.
    if (newPopulationRows.some((r) => !r.nom)) {
      return "Chaque ligne de la population doit avoir un nom (onglet Population).";
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }
    try {
      setSubmitting(true);
      const payload: ContratUpsertInput = {
        ...form,
        ...(appliquerSurprimeAge ? primeUnitairesAvecSurprime(form, surprimeAgeOptions) : {}),
        prime: calc.primeTotaleTTC > 0 ? calc.primeTotaleTTC : form.prime,
      };
      const contrat = editing ? await updateContrat(editing.id, payload) : await createContrat(payload);

      for (const row of newPopulationRows) {
        await createAssure({
          nom: row.nom, contratId: contrat.id,
          beneficiaires: row.beneficiaires, cotisation: row.cotisation,
          dateNaissance: row.dateNaissance || undefined,
          dateAffiliation: form.dateDebut,
        });
      }

      let importSummary: ImportPopulationResult | null = null;
      if (importFile) {
        setImporting(true);
        try {
          importSummary = await importPopulation(contrat.id, importFile.rows);
        } finally {
          setImporting(false);
        }
      }

      await replaceGaranties(contrat.id, garantieRows.filter((g) => g.categorie && g.libelle));

      const parts = [
        newPopulationRows.length > 0 ? `${newPopulationRows.length} affilié(s) ajouté(s)` : null,
        importSummary ? `${importSummary.imported} ligne(s) importée(s)${importSummary.updated ? `, ${importSummary.updated} mise(s) à jour` : ""}${importSummary.rejected.length ? ` (${importSummary.rejected.length} rejetée(s) — voir le rapport)` : ""}` : null,
      ].filter(Boolean);
      toast.success(editing ? "Contrat mis à jour." : `Contrat créé avec succès${parts.length ? " — " + parts.join(", ") : ""}.`);
      refresh();
      // Une ligne rejetée à l'import : on garde la fenêtre ouverte (sur la
      // fiche du contrat désormais enregistré) pour que le rapport reste
      // visible, plutôt que de fermer et perdre l'information.
      if (importSummary && importSummary.rejected.length > 0) {
        setImportRejected(importSummary.rejected);
        setEditing(contrat);
        setImportFile(null);
      } else {
        closeModal();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur d'enregistrement du contrat.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Contrat) => {
    const ok = window.confirm(`Supprimer le contrat ${c.id} ?`);
    if (!ok) return;
    try {
      await deleteContrat(c.id);
      refresh();
      toast.success("Contrat supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  // Dérogation de saisie post-résiliation (2026-09) — voir demande
  // utilisateur : bouton "Permettre la saisie des prestations et des
  // prises en charge après la date de résiliation ou fermeture des
  // droits." Action immédiate (comme "Recalibrer l'exercice"), pas liée au
  // bouton Enregistrer du formulaire — met à jour `editing` directement
  // pour refléter le nouvel état sans fermer la fiche.
  const handleToggleDerogation = async () => {
    if (!editing) return;
    try {
      setDerogationEnCours(true);
      const maj = await toggleDerogationSaisie(editing.id, !editing.saisieApresResiliationAutorisee);
      setEditing(maj);
      toast.success(maj.saisieApresResiliationAutorisee ? "Saisie après résiliation autorisée." : "Saisie après résiliation de nouveau bloquée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier la dérogation.");
    } finally {
      setDerogationEnCours(false);
    }
  };

  const garantiesParCategorie = garantieRows.reduce<Record<string, { row: GarantieInput; index: number }[]>>((acc, row, index) => {
    const key = row.categorie || "Autre";
    (acc[key] ??= []).push({ row, index });
    return acc;
  }, {});

  const catalogueParCategorie = catalogue.filter((item) => item.branche === form.branche).reduce<Record<string, GarantieCatalogueItem[]>>((acc, item) => {
    (acc[item.categorie] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <ModuleHeader title="Production — Contrats" subtitle="Gestion des polices d'assurance Maladie et Assistance en portefeuille" icon={FileText}
        actions={
          <>
            <Btn variant="secondary" onClick={() => setBrancheFilter(brancheFilter === "Tous" ? "Assistance" : "Tous")}><Filter className="w-4 h-4" />{brancheFilter === "Tous" ? "Toutes branches" : brancheFilter}</Btn>
            <Btn variant="secondary" onClick={() => setShowImport(true)}><Upload className="w-4 h-4" />Import en masse</Btn>
            <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouveau contrat</Btn>
          </>
        }
      />
      {/* Recherche + filtres compagnie/échéance (2026-08 — voir demande
          utilisateur : "mettre une barre de recherche des contrats,
          permettre aussi le filtre de contrat par échéance, par
          compagnie"). */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-colors"
            placeholder="Rechercher par n° police, souscripteur, compagnie, référence…"
            value={rechercheContrat}
            onChange={(e) => setRechercheContrat(e.target.value)}
          />
        </div>
        <Combobox<Compagnie>
          options={[...compagnies, ...compagniesAutoGestion]}
          value={compagnieFilter}
          onChange={setCompagnieFilter}
          getLabel={(c) => c.nom} getId={(c) => c.id}
          placeholder="Compagnie"
          allowClear clearLabel="Toutes les compagnies"
          className="w-56"
        />
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground whitespace-nowrap">Échéance du</span>
          <DateInput value={echeanceDu} onChange={setEcheanceDu} placeholder="JJ/MM/AAAA" className="w-36 border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" />
          <span className="text-[12px] text-muted-foreground">au</span>
          <DateInput value={echeanceAu} onChange={setEcheanceAu} placeholder="JJ/MM/AAAA" className="w-36 border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" />
        </div>
        {/* Bouton de recherche explicite (2026-09 — voir demande
            utilisateur : "ajouter des filtres de recherche avancée...
            prenant en compte plusieurs facteurs de recherche et le bouton
            de recherche") — les filtres ci-dessus s'appliquent déjà en
            direct pendant la saisie ; ce bouton relance en plus une
            recherche fraîche côté serveur (utile si des contrats ont été
            modifiés/créés depuis le dernier chargement). */}
        <Btn variant="primary" onClick={refresh}><Search className="w-4 h-4" />Rechercher</Btn>
        {(rechercheContrat || compagnieFilter || echeanceDu || echeanceAu) && (
          <button
            type="button"
            onClick={() => { setRechercheContrat(""); setCompagnieFilter(null); setEcheanceDu(""); setEcheanceAu(""); }}
            className="text-[12px] text-muted-foreground hover:text-primary underline whitespace-nowrap"
          >
            Réinitialiser
          </button>
        )}
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {statuts.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {(() => {
              const Icon = statusIcon[s] ?? FileText;
              return <Icon className="w-4 h-4" />;
            })()}
            {s}
            {s !== "Tous" && <span className="text-xs opacity-70">{contrats.filter((c) => c.statut === s).length}</span>}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm med-data-table">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap med-sticky-col">N° Police</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Souscripteur</th>
              <th className="hidden md:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Branche</th>
              <th className="hidden lg:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Compagnie</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Période</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Prime Annuelle</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Échéance</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => openEdit(c)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap med-num med-col-ref med-sticky-col">
                  {c.numeroPolice || c.id}
                  <div className="md:hidden mt-1 space-y-0.5 text-[10px] leading-4 text-muted-foreground whitespace-normal">
                    <p className="med-num text-foreground">{fmt(c.prime)}</p>
                    <p>{c.statut}</p>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.client}</td>
                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <Badge variant={c.branche === "Assistance" ? "info" : "neutral"}>{c.branche}</Badge>
                    {c.branche === "Maladie" && (c.extensionsTerritorialite?.length ?? 0) > 0 && !contrats.some((a) => a.branche === "Assistance" && a.contratMaladieLieId === c.id) && (
                      <span title="Territorialité hors Gabon Uniquement — contrat d'Assistance lié manquant"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Contrat d'Assistance lié manquant" /></span>
                    )}
                  </div>
                </td>
                <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">{c.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num med-col-period">
                  {c.dateDebut} → {c.dateFin}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap med-num med-col-money">{fmt(c.prime)}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap med-col-days">
                  {(() => {
                    // Urgence de la colonne "Échéance" (2026-09) — calculée
                    // sur le VRAI nombre de jours restants (jr), jamais sur
                    // une recherche de sous-chaîne dans le libellé affiché
                    // ("150 jours".includes("15") déclenchait auparavant à
                    // tort la couleur rouge — même défaut pour "60").
                    const jr = joursRestants(c.dateFin);
                    const couleur = Number.isNaN(jr) ? "text-muted-foreground" : jr <= 15 ? "text-red-400" : jr <= 60 ? "text-amber-400" : "text-muted-foreground";
                    return <span className={`text-xs font-semibold med-num ${couleur}`}>{c.jours}</span>;
                  })()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap med-col-status">
                  <Badge variant={c.statut === "Actif" ? "success" : c.statut === "En renouvellement" ? "warning" : c.statut === "Expiré" || c.statut === "Résilié" ? "danger" : "neutral"}>{c.statut}</Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setGestionPopulationContrat(c); }} title="Gérer les assurés" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                    <UserCog className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setComptesMobileContrat(c); }} title="Accès au portail assuré" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">Aucun contrat pour ce filtre</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {editing ? `Modifier le contrat ${editing.id}` : "Créer un contrat"}
                  {editing?.numeroPolice && <span className="ml-2 text-[12px] font-normal text-muted-foreground">— N° police {editing.numeroPolice}</span>}
                </h3>
                {editing && <div className="mt-0.5"><DerniereModification entite="contrats" entiteId={editing.id} /></div>}
              </div>
              <button type="button" onClick={closeModal} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>

            <div className="flex items-center gap-1 px-5 pt-3 border-b border-border flex-shrink-0 overflow-x-auto">
              {buildTabs(!!editing).map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 border-b-2 transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />{t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {activeTab === "general" && (
                <>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Branche</div>
                    <div className="flex border border-border rounded-xl overflow-hidden w-fit mb-2">
                      {(["Maladie", "Assistance"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            const taux = tauxCommissionCompagnie(form.compagnieId, b);
                            setForm((v) => ({ ...v, branche: b, tauxCommission: taux !== undefined ? taux : v.tauxCommission }));
                          }}
                          className={`px-4 py-2 text-sm transition-colors ${form.branche === b ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:text-foreground"}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground">{brancheHint[form.branche]}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <div className={labelCls}>Souscripteur</div>
                      <Combobox
                        options={clients}
                        value={clients.find((c) => c.id === form.clientId) ?? null}
                        onChange={(c) => {
                          const clientId = c?.id ?? "";
                          setForm((v) => ({ ...v, clientId }));
                          if (typeGestion === "AutoGestion") appliquerAutoGestion(clientId);
                        }}
                        getLabel={(c) => c.nom} getId={(c) => c.id}
                        placeholder="Rechercher…"
                      />
                    </label>
                    <div className="block">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[12px] text-muted-foreground">Compagnie</div>
                        {/* Société Mutuelle/Compagnie (2026-09) — pas de sens à
                            choisir une compagnie EXTERNE ni à basculer en
                            Auto-Gestion : la compagnie interne tient déjà
                            cette place, voir openCreate(). */}
                        {(!moi?.type || moi.type === "Courtier") && (
                          <div className="flex border border-border rounded-lg overflow-hidden text-[11px] flex-shrink-0">
                            {(["Classique", "AutoGestion"] as const).map((tg) => (
                              <button key={tg} type="button" onClick={() => {
                                setTypeGestion(tg);
                                if (tg === "AutoGestion") appliquerAutoGestion(form.clientId);
                                else setForm((v) => ({ ...v, compagnieId: "" }));
                              }}
                                className={`px-2.5 py-1 transition-colors ${typeGestion === tg ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:text-foreground"}`}
                              >
                                {tg === "Classique" ? "Classique" : "Auto-Gestion"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {moi?.type && moi.type !== "Courtier" ? (
                        <div className="h-[38px] px-3 flex items-center rounded-lg border border-primary/30 bg-primary/5 text-[13px] text-foreground">
                          Compagnie interne — {moi.societeNom}
                        </div>
                      ) : typeGestion === "Classique" ? (
                        <Combobox
                          options={compagnies}
                          value={compagnies.find((c) => c.id === form.compagnieId) ?? null}
                          onChange={(c) => handleCompagnieChange(c?.id ?? "")}
                          getLabel={(c) => c.nom} getId={(c) => c.id}
                          placeholder="Rechercher…"
                        />
                      ) : profilAutoGestion ? (
                        <div className="h-[38px] px-3 flex items-center rounded-lg border border-primary/30 bg-primary/5 text-[13px] text-foreground">
                          Auto-Gestion — {profilAutoGestion.nom}
                        </div>
                      ) : (
                        <div className="px-3 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 text-[11.5px] text-amber-600">
                          {form.clientId
                            ? "Ce souscripteur n'est pas encore en auto-gestion — configurez-le depuis l'écran Auto-Gestion."
                            : "Sélectionnez d'abord un souscripteur."}
                        </div>
                      )}
                    </div>
                    <label className="block">
                      <div className={labelCls}>Numéro de police</div>
                      <input value={form.numeroPolice ?? ""} onChange={(e) => setForm((v) => ({ ...v, numeroPolice: e.target.value }))} className={fieldCls} placeholder="ex. 1000652" />
                      <p className="text-[11px] text-muted-foreground mt-1">Suggéré automatiquement selon la compagnie — modifiable pour une reprise d'antériorité.</p>
                    </label>
                    <label className="block">
                      <div className={labelCls}>Produit</div>
                      <input value={form.produit ?? ""} onChange={(e) => setForm((v) => ({ ...v, produit: e.target.value }))} className={fieldCls} placeholder="ex. PEC UPEGA COLLEGE 1" />
                      <p className="text-[11px] text-muted-foreground mt-1">Figure sur le Bordereau de Production — laissez vide pour un libellé générique.</p>
                    </label>
                    <label className="block"><div className={labelCls}>Date d'effet</div><DateInput value={form.dateDebut} onChange={(v) => setForm((f) => ({ ...f, dateDebut: v }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Date d'échéance</div><DateInput value={form.dateFin} onChange={(v) => setForm((f) => ({ ...f, dateFin: v }))} className={fieldCls} /></label>
                    {form.branche === "Assistance" && (
                      <label className="block">
                        <div className={labelCls}>Contrat Maladie lié</div>
                        <select value={form.contratMaladieLieId ?? ""} onChange={(e) => handleContratMaladieLieChange(e.target.value)} className={fieldCls}>
                          <option value="">— Aucun (population saisie séparément) —</option>
                          {contratsMaladieDuClient.map((c) => <option key={c.id} value={c.id}>{c.numeroPolice ?? c.id} · {c.client}</option>)}
                        </select>
                        <p className="text-[10.5px] text-muted-foreground mt-1">Dès qu'un contrat Maladie a une territorialité hors Gabon, son Assistance est obligatoire et partage exactement sa population — aucun import séparé.</p>
                      </label>
                    )}
                    <label className="block">
                      <div className={labelCls}>Statut</div>
                      <select value={form.statut} onChange={(e) => setForm((v) => ({ ...v, statut: e.target.value as ContratUpsertInput["statut"] }))} className={fieldCls}>
                        <option>Actif</option><option>En renouvellement</option><option>Expiré</option><option>Résilié</option>
                      </select>
                    </label>
                    {editing && editing.statut === "Résilié" && (
                      <div className="block md:col-span-2">
                        <div className={labelCls}>Saisie après résiliation</div>
                        <button
                          type="button"
                          onClick={handleToggleDerogation}
                          disabled={derogationEnCours}
                          className={`w-full h-9 rounded-lg text-[12px] font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                            editing.saisieApresResiliationAutorisee
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                              : "bg-secondary text-foreground border border-border hover:bg-secondary/70"
                          }`}
                        >
                          {editing.saisieApresResiliationAutorisee ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {editing.saisieApresResiliationAutorisee
                            ? "Saisie autorisée après résiliation — cliquer pour rebloquer"
                            : "Permettre la saisie des prestations et des prises en charge après la date de résiliation ou fermeture des droits"}
                        </button>
                        <p className="text-[10.5px] text-muted-foreground mt-1">
                          Contrat résilié le {editing.dateFin} : toute prestation ou prise en charge datée après cette échéance est bloquée à la saisie, sauf dérogation temporaire ci-dessus.
                        </p>
                      </div>
                    )}
                    <label className="block">
                      <div className={labelCls}>Périodicité</div>
                      <select value={form.periodicite ?? "Annuel"} onChange={(e) => setForm((v) => ({ ...v, periodicite: e.target.value as ContratUpsertInput["periodicite"] }))} className={fieldCls}>
                        <option>Mensuel</option><option>Trimestriel</option><option>Semestriel</option><option>Annuel</option>
                      </select>
                    </label>
                    {editing && (
                      <div className="rounded-lg border border-border px-3 py-2.5 self-end">
                        <span className="text-[12px] text-muted-foreground">Type d'affaire : </span>
                        <span className="text-[13px] font-semibold text-foreground">{editing.typeAffaire ?? "Affaire Nouvelle"}</span>
                        {editing.exerciceNumero !== null && editing.exerciceNumero !== undefined && (
                          <span className="text-[12px] text-muted-foreground"> — Exercice n°{editing.exerciceNumero}</span>
                        )}
                      </div>
                    )}
                    {calc.periode !== null && (
                      <div className="rounded-lg border border-border px-3 py-2.5 self-end">
                        <span className="text-[12px] text-muted-foreground">Période de couverture : </span>
                        <span className="text-[13px] font-semibold text-foreground med-num">{calc.periode} jours</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Territorialité</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className={labelCls}>Pays de souscription</div><input value={form.paysSouscription ?? ""} onChange={(e) => setForm((v) => ({ ...v, paysSouscription: e.target.value }))} className={fieldCls} /></label>
                      <div>
                        <div className={labelCls}>{form.branche === "Assistance" ? "Extensions couvertes (évacuation vers)" : "Extensions de territorialité"}</div>
                        {/* Options reprises du paramétrage RÉEL de la compagnie
                            (2026-08 — voir demande utilisateur : "il faut
                            remplacer l'extensions de territorialité et faire
                            remonter ce qui est paramétré dans la compagnie
                            d'assurance") — plus de liste générique fixe
                            (Zone CEMAC/Afrique/Europe/France/International) :
                            chaque compagnie a ses propres libellés
                            (Compagnie.territorialites, onglet dédié de sa
                            fiche), potentiellement très différents d'une
                            compagnie à l'autre — l'ancien paragraphe "Repères
                            de la compagnie" les affichait déjà en lecture
                            seule juste en dessous ; devenu redondant,
                            supprimé. */}
                        {selectedCompagnie && selectedCompagnie.territorialites.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedCompagnie.territorialites.map((t) => {
                              const active = form.extensionsTerritorialite?.includes(t.libelle) ?? false;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleExtension(t.libelle)}
                                  className={`px-3 py-1.5 rounded-lg border text-[12px] transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground"}`}
                                >
                                  {t.libelle}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[12px] text-muted-foreground italic">
                            {selectedCompagnie ? "Aucune territorialité paramétrée pour cette compagnie (voir sa fiche, onglet Territorialité)." : "Choisissez d'abord une compagnie."}
                          </p>
                        )}
                      </div>
                    </div>
                    {form.branche === "Maladie" && (form.extensionsTerritorialite?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-amber-500 mt-2 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2">
                        Une extension de territorialité implique systématiquement un contrat d'Assistance (évacuation sanitaire) pour ce souscripteur — pensez à créer le contrat d'Assistance correspondant si ce n'est pas déjà fait.
                      </p>
                    )}
                  </div>

                  {editing && historiqueCompagnie.length > 0 && (
                    <div>
                      {/* Un exercice = une période de 12 mois AU PLUS, à
                          cheval sur deux années civiles possible (voir
                          demande utilisateur). Une ligne à la souscription,
                          une nouvelle à chaque Renouvellement — ou plusieurs
                          d'emblée si l'import repris couvrait plus de 12
                          mois en une seule ligne (voir
                          ContratsService.decouperEnExercices). */}
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        Exercices {historiqueCompagnie.length > 1 && `(${historiqueCompagnie.length})`}
                      </div>
                      {/* overflow-hidden coupait le calendrier déroulant de
                          DateInput (position absolute, s'étend sous la ligne
                          éditée) — voir demande utilisateur : "afficher
                          correctement le calendrier". Retiré tant qu'une
                          ligne est en édition ; remis sinon (coins arrondis
                          propres sur la liste au repos). */}
                      <div className={`rounded-lg border border-border divide-y divide-border/50 ${exerciceEnEdition === null ? "overflow-hidden" : "overflow-visible"}`}>
                        {historiqueCompagnie.map((ex) => (
                          exerciceEnEdition === ex.numero ? (
                            <div key={ex.id} className="flex items-center gap-2 px-3 py-2 text-[12px] bg-primary/5">
                              <span className="flex-shrink-0 text-[11px] font-semibold text-muted-foreground med-num">N°{ex.numero}</span>
                              <DateInput value={brouillonExercice.dateDebut} onChange={(v) => setBrouillonExercice((b) => ({ ...b, dateDebut: v }))} className="border border-border rounded-md px-2 py-1 bg-background text-[12px] text-foreground flex-1 min-w-0" />
                              <span className="text-muted-foreground flex-shrink-0">→</span>
                              <DateInput value={brouillonExercice.dateFin} onChange={(v) => setBrouillonExercice((b) => ({ ...b, dateFin: v }))} className="border border-border rounded-md px-2 py-1 bg-background text-[12px] text-foreground flex-1 min-w-0" />
                              <button type="button" onClick={enregistrerRecalibrageExercice} disabled={recalibrageEnCours} title="Enregistrer et recalibrer les exercices suivants" className="flex-shrink-0 p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => setExerciceEnEdition(null)} disabled={recalibrageEnCours} title="Annuler" className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div key={ex.id} className="group flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 text-[11px] font-semibold text-muted-foreground med-num">N°{ex.numero}</span>
                                <span className="text-foreground truncate">{ex.compagnie?.nom ?? selectedCompagnie?.nom ?? "—"}</span>
                              </div>
                              <span className="flex-shrink-0 text-muted-foreground med-num">{ex.dateDebut} → {ex.dateFin}</span>
                              <span className="flex-shrink-0 text-foreground font-medium med-num" title={ex.primeNette !== null && ex.primeNette !== undefined ? `Prime nette détaillée saisie — utilisée pour le S/P de cette période : ${fmt(toNumber(ex.primeNette))}` : undefined}>
                                {fmt(toNumber(ex.prime))}
                                {ex.primeNette !== null && ex.primeNette !== undefined && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" />}
                              </span>
                              <Badge variant={ex.statut === "Actif" ? "success" : "neutral"}>{ex.statut}</Badge>
                              <button
                                type="button" onClick={() => setExercicePrimeCible(ex)}
                                title="Saisir la prime détaillée de cet exercice (par personne + accessoires) — nécessaire pour le calcul du S/P sur cette période"
                                className="flex-shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-opacity"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button" onClick={() => ouvrirEditionExercice(ex)}
                                title="Corriger les dates de cet exercice — les exercices suivants seront recalibrés"
                                className="flex-shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-opacity"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Une date d'import erronée ? Corrigez l'exercice concerné — les suivants sont recalculés automatiquement.
                      </p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "population" && (form.branche === "Assistance" && form.contratMaladieLieId ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-[13px] font-semibold text-foreground">Population identique au contrat Maladie {form.contratMaladieLieId}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-1">{existingPopulation.length} personne(s) — gérée exclusivement depuis ce contrat Maladie (module Participants ou son propre onglet Population). Aucun import séparé n'est possible ici, pour éviter toute duplication.</p>
                  </div>
                  {existingPopulation.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto divide-y divide-border/50">
                      {existingPopulation.map((a) => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                          <span className="text-foreground">{a.nom} {a.prenom ?? ""}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground med-num">{a.matricule || "—"} · {a.typeAssure || "—"}</span>
                            <Badge variant={STATUT_ASSURE_BADGE[a.statut] ?? "neutral"}>{a.statut}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[12px] text-muted-foreground">
                    Liste des assurés principaux et de leurs ayants droit communiquée par le souscripteur à la mise en place du contrat.
                    Le numéro de matricule est généré automatiquement par l'application.
                  </p>

                  {editing && (
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-[12px] text-foreground font-semibold">{existingPopulationCount} personne(s) déjà affiliée(s)</p>
                        <button
                          type="button"
                          onClick={() => setBasculePopulationContrat(editing)}
                          className="flex-shrink-0 text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                          title="Basculer tout ou partie de cette population vers un autre contrat, sans recréer les fiches"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />Basculer la population
                        </button>
                      </div>
                      <PopulationPanel contrat={editing} onUpdated={() => refresh()} />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Import d'un fichier population</div>
                      <button type="button" onClick={downloadPopulationTemplate} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                        <FileDown className="w-3.5 h-3.5" />Télécharger le modèle
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                    {importFile ? (
                      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{importFile.name}</p>
                          <p className="text-[11px] text-muted-foreground">{importFile.rows.length} ligne(s) prête(s) à importer{importing ? " — import en cours…" : ""}</p>
                        </div>
                        <button type="button" onClick={clearImportFile} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-4 text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        <Upload className="w-4 h-4" />Importer un fichier CSV (Matricule;Noms &amp; Prénoms;Nationalité;Dat Nais;Sexe;Type assuré;…)
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      La colonne "Noms &amp; Prénoms" du fichier (nom et prénom fusionnés, ex: "Gabon" en colonne Nationalité n'est pas confondu) est scindée
                      automatiquement en Nom (capitales) / Prénom (initiale majuscule). Chaque retour à "AS" démarre une nouvelle famille : les CJ/EF qui
                      suivent deviennent ses ayants droit, jusqu'au prochain "AS".
                    </p>
                  </div>

                  {importFile && importedFamilies.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-secondary/30 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Personnes détectées — table éditable (corrigez si besoin avant l'import)</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">AS: {importedTally.AS} · CJ: {importedTally.CJ} · EF: {importedTally.EF}</span>
                          <input
                            value={importSearch}
                            onChange={(e) => setImportSearch(e.target.value)}
                            placeholder="Rechercher (nom, prénom, matricule)…"
                            className="h-7 w-56 border border-border rounded-lg px-2 bg-background text-[12px] text-foreground"
                          />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-[11.5px]">
                          <thead className="sticky top-0 bg-card z-10">
                            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                              <th className="text-left px-2 py-1.5 whitespace-nowrap">Matricule</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap">Nom</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap">Prénom</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap w-16">Sexe</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap w-28">Date naiss.</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap w-20">Type</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap w-28">Téléphone</th>
                              <th className="text-left px-2 py-1.5 whitespace-nowrap w-28">Photo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {visibleImportRows.map(({ row, index }) => {
                              const isAS = row.typeAssure === "AS";
                              const inputCls = `w-full bg-transparent px-1.5 py-1 border border-transparent hover:border-border focus:border-primary rounded text-[11.5px] text-foreground ${isAS ? "font-semibold" : ""}`;
                              return (
                                <tr key={index} className={isAS ? "bg-primary/10 border-l-2 border-l-primary" : ""}>
                                  <td className="px-1 py-0.5"><input value={row.matricule} onChange={(e) => updateImportRow(index, { matricule: e.target.value })} className={inputCls} /></td>
                                  <td className="px-1 py-0.5"><input value={row.nom} onChange={(e) => updateImportRow(index, { nom: e.target.value })} className={inputCls} /></td>
                                  <td className="px-1 py-0.5"><input value={row.prenom} onChange={(e) => updateImportRow(index, { prenom: e.target.value })} className={inputCls} /></td>
                                  <td className="px-1 py-0.5">
                                    <select value={row.sexe} onChange={(e) => updateImportRow(index, { sexe: e.target.value })} className={inputCls}>
                                      <option value="">—</option><option value="M">M</option><option value="F">F</option>
                                    </select>
                                  </td>
                                  <td className="px-1 py-0.5"><DateInput value={row.dateNaissance} onChange={(v) => updateImportRow(index, { dateNaissance: v })} className={inputCls} /></td>
                                  <td className="px-1 py-0.5">
                                    <select value={row.typeAssure} onChange={(e) => updateImportRow(index, { typeAssure: e.target.value })} className={inputCls}>
                                      <option value="AS">AS</option><option value="CJ">CJ</option><option value="EF">EF</option>
                                    </select>
                                  </td>
                                  <td className="px-1 py-0.5">{isAS ? <input value={row.telephone} onChange={(e) => updateImportRow(index, { telephone: e.target.value })} className={inputCls} placeholder="—" /> : <span className="text-muted-foreground px-1.5">—</span>}</td>
                                  <td className="px-1 py-0.5"><input value={row.photo} onChange={(e) => updateImportRow(index, { photo: e.target.value })} className={inputCls} placeholder="—" /></td>
                                </tr>
                              );
                            })}
                            {visibleImportRows.length === 0 && (
                              <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">Aucun résultat pour "{importSearch}".</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {filteredImportRows.length > 200 && (
                        <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-t border-border">Édition limitée aux 200 premières lignes affichées ({importFile.rows.length} ligne(s) au total) — affinez la recherche pour retrouver une personne précise ; l'import complet sera bien enregistré tel quel au-delà.</p>
                      )}
                    </div>
                  )}

                  {importRejected.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
                      <div className="px-3 py-2 border-b border-destructive/20 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-destructive">{importRejected.length} ligne(s) rejetée(s) à l'import</span>
                        <button type="button" onClick={() => setImportRejected([])} className="text-[11px] text-muted-foreground hover:text-foreground">Masquer</button>
                      </div>
                      <div className="max-h-48 overflow-auto divide-y divide-border/40">
                        {importRejected.map((r, i) => (
                          <div key={i} className="px-3 py-1.5 text-[11.5px]">
                            <span className="text-muted-foreground">Ligne {r.ligne}{r.nom ? ` (${r.nom})` : ""}{r.matricule ? ` · ${r.matricule}` : ""} — </span>
                            <span className="text-foreground">{r.motif}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!editing && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nouvelles affiliations (saisie manuelle)</div>
                        <button type="button" onClick={addPopulationRow} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une personne</button>
                      </div>

                      <div className="space-y-2">
                        {newPopulationRows.map((row, i) => (
                          <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1.2fr_1fr_0.8fr_auto] gap-2 items-center border border-border rounded-lg p-2.5">
                            <input value={row.nom} onChange={(e) => updatePopulationRow(i, { nom: e.target.value })} placeholder="Nom de l'assuré principal" className={fieldCls} />
                            <DateInput value={row.dateNaissance} onChange={(v) => updatePopulationRow(i, { dateNaissance: v })} placeholder="Date de naissance" className={fieldCls} />
                            <input type="number" value={row.cotisation} onChange={(e) => updatePopulationRow(i, { cotisation: Number(e.target.value) })} placeholder="Cotisation/mois" className={fieldCls} />
                            <input type="number" value={row.beneficiaires} onChange={(e) => updatePopulationRow(i, { beneficiaires: Number(e.target.value) })} placeholder="Ayants droit" className={fieldCls} />
                            <button type="button" onClick={() => removePopulationRow(i)} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 justify-self-end">×</button>
                          </div>
                        ))}
                        {newPopulationRows.length === 0 && (
                          <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucune affiliation ajoutée</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center justify-between">
                        <span className="text-[12px] text-foreground">Population totale (assurés + ayants droit)</span>
                        <span className="text-[15px] font-bold text-primary med-num">{totalPopulation}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {activeTab === "prime" && (
                <CalculPrimeSection
                  form={form}
                  setForm={setForm}
                  calc={calc}
                  showManualPrimeFallback
                  accessoiresTranches={selectedCompagnie?.accessoires}
                  surprimeAge={{
                    actif: appliquerSurprimeAge,
                    onToggle: () => setAppliquerSurprimeAge((v) => !v),
                    disabled: !selectedCompagnie || selectedCompagnie.surprimesAge.length === 0 || populationAvecAge.length === 0,
                    raison: !selectedCompagnie
                      ? "Sélectionnez une compagnie (onglet Informations générales) pour activer la surprime d'âge."
                      : selectedCompagnie.surprimesAge.length === 0
                        ? "Cette compagnie n'a pas de grille de surprimes d'âge paramétrée (fiche Compagnie)."
                        : populationAvecAge.length === 0
                          ? "Nécessite une population individualisée avec date de naissance (import ou assurés déjà affiliés) — la saisie manuelle des effectifs seuls ne permet pas de déterminer l'âge de chaque personne."
                          : undefined,
                  }}
                  populationLock={hasCategorizedPopulation ? {
                    computedAS, computedCJ, computedEF,
                    manualEntry: manualPopulationEntry,
                    onToggleManual: () => setManualPopulationEntry((m) => !m),
                  } : undefined}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="block"><div className={labelCls}>Taux territorialité (%)</div><input type="number" step="0.1" value={form.tauxTerritorialite ?? 0} onChange={(e) => setForm((v) => ({ ...v, tauxTerritorialite: Number(e.target.value) }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Limite âge adulte</div><input type="number" value={form.limiteAgeAdulte ?? 0} onChange={(e) => setForm((v) => ({ ...v, limiteAgeAdulte: Number(e.target.value) }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Limite âge enfant</div><input type="number" value={form.limiteAgeEnfant ?? 0} onChange={(e) => setForm((v) => ({ ...v, limiteAgeEnfant: Number(e.target.value) }))} className={fieldCls} /></label>
                    <label className="block">
                      <div className={labelCls} title="Ne s'applique qu'aux enfants marqués « scolarisé » sur leur fiche — sinon la limite âge enfant ci-dessus reste la règle.">Limite âge enfant scolarisé</div>
                      <input type="number" value={form.limiteAgeEnfantScolarise ?? 0} onChange={(e) => setForm((v) => ({ ...v, limiteAgeEnfantScolarise: Number(e.target.value) }))} className={fieldCls} />
                    </label>
                    <label className="block"><div className={labelCls}>Limite personnes/famille</div><input type="number" value={form.limitePersFamille ?? 0} onChange={(e) => setForm((v) => ({ ...v, limitePersFamille: Number(e.target.value) }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Plafond / Adhérent (FCFA)</div><input type="number" value={form.plafondAdherent ?? ""} onChange={(e) => setForm((v) => ({ ...v, plafondAdherent: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Plafond / Famille (FCFA)</div><input type="number" value={form.plafondFamille ?? ""} onChange={(e) => setForm((v) => ({ ...v, plafondFamille: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Plafond / Police (FCFA)</div><input type="number" value={form.plafondPolice ?? ""} onChange={(e) => setForm((v) => ({ ...v, plafondPolice: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} /></label>
                  </div>
                </CalculPrimeSection>
              )}

              {activeTab === "historique" && editing && <HistoriqueMouvementsTab contrat={editing} />}

              {activeTab === "consommations" && editing && <ConsommationsTab contrat={editing} />}

              {activeTab === "prisesEnCharge" && editing && <PrisesEnChargeTab contrat={editing} />}

              {activeTab === "garanties" && form.branche === "Assistance" && (
                <div className="space-y-5">
                  <p className="text-[12px] text-muted-foreground">
                    Le contrat d'Assistance ne nécessite pas de taux de couverture (Structures Privées/Publiques) — chaque rubrique est une prestation d'évacuation/assistance avec son propre plafond.
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Garanties d'Assistance</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {catalogue.filter((c) => c.branche === "Assistance").length > 0 && (
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) addFromCatalogue(e.target.value); }}
                          className="h-8 border border-border rounded-lg px-2 bg-background text-[12px] text-foreground"
                        >
                          <option value="">+ Depuis le catalogue…</option>
                          {catalogue.filter((c) => c.branche === "Assistance").map((item) => <option key={item.id} value={item.id}>{item.libelle}</option>)}
                        </select>
                      )}
                      <button type="button" onClick={loadStandardGaranties} className="text-[12px] text-primary hover:underline">Charger les garanties standard</button>
                      <button type="button" onClick={addGarantieRow} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une rubrique</button>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground -mt-3">Les rubriques du catalogue se gèrent dans Paramètres → Catalogue de garanties.</p>

                  <div className="hidden md:grid grid-cols-[2.5fr_2fr_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Rubrique</span>
                    <span>Plafond</span>
                    <span></span>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="divide-y divide-border/50">
                      {garantieRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[2.5fr_2fr_auto] gap-2 items-center px-3 py-2">
                          <input value={row.libelle} onChange={(e) => updateGarantieRow(index, { libelle: e.target.value })} placeholder="Rubrique (ex: Transport sanitaire)" className={fieldCls} />
                          <input value={row.plafond ?? ""} onChange={(e) => updateGarantieRow(index, { plafond: e.target.value })} placeholder="ex: Prise en charge intégrale" className={fieldCls} />
                          <button type="button" onClick={() => removeGarantieRow(index)} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 justify-self-end">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {garantieRows.length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">Aucune garantie — chargez les garanties standard ou ajoutez une rubrique.</p>
                  )}
                </div>
              )}

              {activeTab === "garanties" && form.branche === "Maladie" && (
                <div className="space-y-5">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Résumé global</div>
                    {(selectedCompagnie?.tauxCouverture.length ?? 0) > 0 && (
                      <label className="block mb-3">
                        <div className={labelCls}>Grille de la compagnie</div>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const t = selectedCompagnie!.tauxCouverture.find((x) => x.id === e.target.value);
                            if (!t) return;
                            handleResumeGlobalChange("tauxCouvertureAmbulatoire", t.tauxAmbulatoire);
                            handleResumeGlobalChange("tauxCouvertureHospitalisation", t.tauxHospitalisation);
                            e.target.value = "";
                          }}
                          className={fieldCls}
                        >
                          <option value="">— Appliquer un taux de couverture suggéré —</option>
                          {selectedCompagnie!.tauxCouverture.map((t) => (
                            <option key={t.id} value={t.id}>{t.tauxHospitalisation} HOSPITALISATION-{t.tauxAmbulatoire} AMBULATOIRES</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className={labelCls}>Ambulatoires</div><input value={form.tauxCouvertureAmbulatoire ?? ""} onChange={(e) => handleResumeGlobalChange("tauxCouvertureAmbulatoire", e.target.value)} className={fieldCls} placeholder="80% / 100% (Structures privées / publiques)" /></label>
                      <label className="block"><div className={labelCls}>Hospitalisations</div><input value={form.tauxCouvertureHospitalisation ?? ""} onChange={(e) => handleResumeGlobalChange("tauxCouvertureHospitalisation", e.target.value)} className={fieldCls} placeholder="100% / 100% (Structures privées / publiques)" /></label>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-1.5">Renseigner ces taux impacte automatiquement les rubriques concernées ci-dessous (y compris sur le tableau standard déjà chargé) — sauf Dentisterie, Optique, Kinésithérapie &amp; Cure thermale, Transport, EVASAN et les 2 lignes Accouchement (Maternité), fixées à 100%.</p>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Taux par type de structure (carte d'assurance)</div>
                    <p className="text-[10.5px] text-muted-foreground mb-2">Affiché en 2 lignes sur la carte d'assurance de chaque assuré, pour indiquer au personnel soignant le taux à appliquer selon qu'il consulte un établissement public ou privé — utilisé aussi pour calculer automatiquement le remboursement d'une prise en charge.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className={labelCls}>Ambulatoire — Structure publique</div><input value={form.tauxAmbulatoirePublique ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAmbulatoirePublique: e.target.value }))} className={fieldCls} placeholder="ex. 80%" /></label>
                      <label className="block"><div className={labelCls}>Ambulatoire — Structure privée</div><input value={form.tauxAmbulatoirePrivee ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAmbulatoirePrivee: e.target.value }))} className={fieldCls} placeholder="ex. 70%" /></label>
                      <label className="block"><div className={labelCls}>Hospitalisation — Structure publique</div><input value={form.tauxHospitalisationPublique ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxHospitalisationPublique: e.target.value }))} className={fieldCls} placeholder="ex. 100%" /></label>
                      <label className="block"><div className={labelCls}>Hospitalisation — Structure privée</div><input value={form.tauxHospitalisationPrivee ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxHospitalisationPrivee: e.target.value }))} className={fieldCls} placeholder="ex. 100%" /></label>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Taux ayants droit (optionnel)</div>
                    <p className="text-[10.5px] text-muted-foreground mb-2">Laissez vide dans la plupart des cas — la règle par défaut est qu'un conjoint ou un enfant (CJ/EF) suit exactement le même taux que l'assuré principal ci-dessus. Ne renseigner ces 4 champs QUE si ce contrat prévoit explicitement un taux différent pour les ayants droit.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className={labelCls}>Ambulatoire — Structure publique (ayant droit)</div><input value={form.tauxAmbulatoirePubliqueAyantDroit ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAmbulatoirePubliqueAyantDroit: e.target.value }))} className={fieldCls} placeholder="vide = même taux que l'assuré principal" /></label>
                      <label className="block"><div className={labelCls}>Ambulatoire — Structure privée (ayant droit)</div><input value={form.tauxAmbulatoirePriveeAyantDroit ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAmbulatoirePriveeAyantDroit: e.target.value }))} className={fieldCls} placeholder="vide = même taux que l'assuré principal" /></label>
                      <label className="block"><div className={labelCls}>Hospitalisation — Structure publique (ayant droit)</div><input value={form.tauxHospitalisationPubliqueAyantDroit ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxHospitalisationPubliqueAyantDroit: e.target.value }))} className={fieldCls} placeholder="vide = même taux que l'assuré principal" /></label>
                      <label className="block"><div className={labelCls}>Hospitalisation — Structure privée (ayant droit)</div><input value={form.tauxHospitalisationPriveeAyantDroit ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxHospitalisationPriveeAyantDroit: e.target.value }))} className={fieldCls} placeholder="vide = même taux que l'assuré principal" /></label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tableau de garanties (rubrique par rubrique)</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {catalogue.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) addFromCatalogue(e.target.value); }}
                          className="h-8 border border-border rounded-lg px-2 bg-background text-[12px] text-foreground"
                        >
                          <option value="">+ Depuis le catalogue…</option>
                          {Object.entries(catalogueParCategorie).map(([cat, items]) => (
                            <optgroup key={cat} label={cat}>
                              {items.map((item) => <option key={item.id} value={item.id}>{item.libelle}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      )}
                      <button type="button" onClick={loadStandardGaranties} className="text-[12px] text-primary hover:underline">Charger le tableau standard</button>
                      <button type="button" onClick={addGarantieRow} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une rubrique</button>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground -mt-3">Les rubriques du catalogue se gèrent dans Paramètres → Catalogue de garanties.</p>

                  <div className="hidden md:grid grid-cols-[1.3fr_2fr_0.8fr_0.8fr_1.4fr_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Catégorie</span>
                    <span>Rubrique</span>
                    <span>Structures Privées</span>
                    <span>Structures Publiques</span>
                    <span>Plafond de remboursement</span>
                    <span></span>
                  </div>

                  {Object.entries(garantiesParCategorie).map(([categorie, rows]) => (
                    <div key={categorie} className="rounded-xl border border-border overflow-hidden">
                      <div className="px-4 py-2 bg-secondary/30 border-b border-border text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{categorie}</div>
                      {CATEGORIES_PLAFOND_PARTAGE[categorie] && (
                        <p className="px-4 py-2 text-[11px] text-muted-foreground bg-amber-500/5 border-b border-border">{CATEGORIES_PLAFOND_PARTAGE[categorie]}</p>
                      )}
                      <div className="divide-y divide-border/50">
                        {rows.map(({ row, index }) => (
                          <div key={index} className="px-3 py-2">
                            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_2fr_0.8fr_0.8fr_1.4fr_auto] gap-2 items-center">
                              <input value={row.categorie} onChange={(e) => updateGarantieRow(index, { categorie: e.target.value })} placeholder="Catégorie" className={fieldCls} />
                              <input value={row.libelle} onChange={(e) => updateGarantieRow(index, { libelle: e.target.value })} placeholder="Rubrique (ex: Consultation Généraliste)" className={fieldCls} />
                              <input type="number" value={row.tauxAssure ?? ""} onChange={(e) => updateGarantieRow(index, { tauxAssure: e.target.value ? Number(e.target.value) : undefined })} placeholder="Structures Privées %" className={fieldCls} />
                              <input type="number" value={row.tauxAyantsDroit ?? ""} onChange={(e) => updateGarantieRow(index, { tauxAyantsDroit: e.target.value ? Number(e.target.value) : undefined })} placeholder="Structures Publiques %" className={fieldCls} />
                              <input value={row.plafond ?? ""} onChange={(e) => updateGarantieRow(index, { plafond: e.target.value })} placeholder="Plafond de remboursement" className={fieldCls} />
                              <button type="button" onClick={() => removeGarantieRow(index)} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 justify-self-end">×</button>
                            </div>
                            {estDansEnveloppePartagee(row.categorie, row.libelle) && (
                              <div className="mt-1.5 flex items-center gap-2 pl-1">
                                <span className="text-[10.5px] text-muted-foreground whitespace-nowrap">Enveloppe partagée :</span>
                                <input
                                  type="number"
                                  value={row.plafondMontant ?? ""}
                                  onChange={(e) => updateGarantieRow(index, { plafondMontant: e.target.value ? Number(e.target.value) : undefined })}
                                  placeholder="Montant FCFA"
                                  className="h-7 w-32 border border-border rounded-lg px-2 bg-background text-[11.5px] text-foreground"
                                />
                                <select
                                  value={row.plafondPeriode ?? "An"}
                                  onChange={(e) => updateGarantieRow(index, { plafondPeriode: e.target.value })}
                                  className="h-7 border border-border rounded-lg px-2 bg-background text-[11.5px] text-foreground"
                                >
                                  <option value="An">/ An</option>
                                  <option value="2 Ans">/ 2 Ans</option>
                                </select>
                                <span className="text-[10.5px] text-muted-foreground">— déclenche le blocage automatique des prises en charge au dépassement</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {garantieRows.length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">Aucune garantie — chargez le tableau standard ou ajoutez une rubrique.</p>
                  )}

                  <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                    La structuration fine des rubriques (impact sur la saisie des prestations santé) et l'état de garanties remis au client seront ajoutés dans une prochaine étape.
                  </p>
                </div>
              )}

            </div>

            <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeModal} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleSubmit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">{importing ? "Import en cours…" : editing ? "Enregistrer" : "Créer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gestionPopulationContrat && (
        <GestionPopulationModal
          contrat={gestionPopulationContrat}
          onClose={() => setGestionPopulationContrat(null)}
          onUpdated={() => refresh()}
        />
      )}

      {basculePopulationContrat && (
        <BasculerPopulationModal
          contrat={basculePopulationContrat}
          contrats={contrats}
          onClose={() => setBasculePopulationContrat(null)}
          onDone={() => {
            refresh();
            if (editing) getAssuresSante().then((all) => setExistingPopulation(all.filter((a) => a.police === editing.id)));
          }}
        />
      )}

      {comptesMobileContrat && (
        <GenerationComptesMobileModal contrat={comptesMobileContrat} onClose={() => setComptesMobileContrat(null)} />
      )}

      {exercicePrimeCible && editing && (
        <ExercicePrimeModal
          contratId={editing.id}
          exercice={exercicePrimeCible}
          onClose={() => setExercicePrimeCible(null)}
          onDone={(historique) => setHistoriqueCompagnie(historique)}
        />
      )}

      {showImport && (
        <ImportEnMasseModal<ImportContratRow>
          titre="Import en masse de contrats"
          onClose={() => setShowImport(false)}
          onImported={refresh}
          telechargerModele={telechargerModeleImportContrats}
          apercu={apercuImportContrats}
          confirmer={confirmerImportContrats}
          colonnes={[
            { key: "souscripteur", label: "Souscripteur" },
            { key: "compagnie", label: "Compagnie" },
            { key: "branche", label: "Branche" },
            { key: "dateDebut", label: "Effet" },
            { key: "dateFin", label: "Échéance" },
            { key: "prime", label: "Prime" },
            { key: "numeroPolice", label: "N° Police" },
          ]}
        />
      )}
    </div>
  );
}
