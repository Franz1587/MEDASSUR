import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import * as QRCode from "qrcode";
import ExcelJS from "exceljs";
import {
  Document as DocxDocument, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType,
  Header, Footer, ImageRun, PageNumber, AlignmentType, ShadingType, BorderStyle, HeightRule, PageBreak, VerticalAlign,
} from "docx";
import type { Response } from "express";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";
import { groupeDeFamille } from "../actes-medicaux/groupes-actes.util";
import { StatistiquesService } from "../statistiques/statistiques.service";
import type { RubriqueId, StatistiquesPayload } from "../statistiques/statistiques.types";
import { BordereauxService, type BordereauSinistresPayload, type BordereauProductionPayload } from "../bordereaux/bordereaux.service";
import { CotationService } from "../cotation/cotation.service";
import { CourrierService } from "../courrier/courrier.service";
import { CrmService } from "../crm/crm.service";
import { ReglementComptableService } from "../reglement-comptable/reglement-comptable.service";
import { ReglementPrestataireService } from "../reglement-prestataire/reglement-prestataire.service";
import { RenouvellementsService } from "../renouvellements/renouvellements.service";
import { AccordPrealableService } from "../accord-prealable/accord-prealable.service";
import { PrestatairesService } from "../prestataires/prestataires.service";
import { DocumentSignatureService } from "./document-signature.service";
import { UPLOADS_ROOT, ASSETS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { genererGraphiqueBarres, genererGraphiqueBarresEtiquetees, genererGraphiqueCamembert } from "./graphiques.util";
import { montantEnLettresFcfa } from "../lib/montant-en-lettres.util";
import { TAUX_TPS } from "../sante/sante.service";
import { reconstituerPopulation } from "../mouvements/population-historique.util";
import type { Prisma, ParametresEntreprise } from "@prisma/client";

// Groupes d'actes considérés "Examen" (bon d'examen) — le reste (Consultation,
// Pharmacie, Dentaire, Kinésithérapie, Hospitalisation, Actes de Spécialités)
// relève de la Feuille de Soins — voir groupes-actes.util.ts.
const GROUPES_EXAMEN = new Set(["Analyse", "Imagerie"]);

// Types de la section Feuille de Soins / Feuille d'Examen (voir
// genererFormulaire/lignesFormulaireDe ci-dessous).
type FormulairePec = {
  date: string; type: string; createdAt: Date;
  assure: {
    id: string;
    nom: string; prenom: string | null; matricule: string; numeroAssure: string | null; dateNaissance: string | null; familleId: string | null;
    famille: { nom: string; prenom: string | null } | null;
    contrat: {
      client: { nom: string }; compagnie: { nom: string };
      tauxCouvertureAmbulatoire: string | null; tauxCouvertureHospitalisation: string | null;
      tauxAmbulatoirePublique: string | null; tauxAmbulatoirePrivee: string | null;
      tauxHospitalisationPublique: string | null; tauxHospitalisationPrivee: string | null;
      tauxAmbulatoirePubliqueAyantDroit: string | null; tauxAmbulatoirePriveeAyantDroit: string | null;
      tauxHospitalisationPubliqueAyantDroit: string | null; tauxHospitalisationPriveeAyantDroit: string | null;
    };
  };
  prestataireRef: { id: string; nom: string; secteur: string | null } | null;
  prescriptionOrigine: {
    medecin: { id: string; nom: string; prenom: string | null; titre: string | null; specialite: string | null; codePraticien: string | null };
    numeroBonExamen: string | null;
    // Médicaments RÉELLEMENT prescrits par le médecin (PrescriptionLigne,
    // ordonnance) — voir demande utilisateur : "il faut que l'application
    // fasse remonter les produits pharmaceutiques prescrits... seul
    // lorsque la pharmacie va traiter la feuille de soins que les prix
    // vont remonter". `montant`/`baseRemboursement` = null tant qu'aucune
    // pharmacie n'a réellement traité la ligne (PrescriptionLigneTraitement),
    // jamais une valeur inventée.
    medicaments: { libelle: string; quantite: number; posologie: string | null; montant: number | null; baseRemboursement: number | null }[];
  } | null;
};
type LigneFormulaire = {
  // `montant` null = ligne pas encore traitée par un prestataire (bon
  // d'examen émis directement depuis la prescription, voir
  // renderFeuilleExamenPrescription) — affichée "En attente" plutôt qu'un
  // montant inventé.
  libelle: string; quantite: number; montant: number | null; baseRemboursement: number | null;
  tauxRemboursement: number | null; codeAffection: string | null; lettreCleCode: string | null; type: string; createdAt: Date;
  familleActe: string | null;
};

// UPLOADS_ROOT (process.cwd()-based, voir uploads-dir.util.ts) plutôt que
// __dirname (2026-09 — bug réel trouvé en testant le logo/modèle de carte :
// `nest start --watch` compile vers backend/dist/src/documents, où
// `__dirname` pointe — path.join(__dirname, "..", "..", ...) y visait donc
// backend/dist/uploads/, un dossier qui n'existe même pas, jamais
// backend/uploads/ où les fichiers sont réellement écrits par tous les
// AUTRES services de l'application. Corrigé pour les 3 dossiers, y compris
// UPLOADS_PHOTOS_DIR qui portait ce même bug depuis toujours — aucune
// photo de carte ne s'affichait jamais, silencieusement remplacée par le
// silhouette générique.
const UPLOADS_PHOTOS_DIR = path.join(UPLOADS_ROOT, "photos");
const UPLOADS_LOGOS_ENTREPRISES_DIR = path.join(UPLOADS_ROOT, "logos-entreprises");
// Logo de la COMPAGNIE (distinct de logos-entreprises = MedAssur elle-même)
// — voir CompagniesService.uploadLogo, catégorie "logos".
const UPLOADS_LOGOS_COMPAGNIES_DIR = path.join(UPLOADS_ROOT, "logos");
const UPLOADS_MODELES_CARTE_DIR = path.join(UPLOADS_ROOT, "modeles-carte");
const UPLOADS_PAGES_GARDE_STATISTIQUES_DIR = path.join(UPLOADS_ROOT, "pages-garde-statistiques");
const UPLOADS_SIGNATURES_DIR = path.join(UPLOADS_ROOT, "signatures");

// Taille UNIQUE de toute image de signature dessinée sur un document
// (2026-09) — voir demande utilisateur : "toutes les signatures dans
// l'application [doivent avoir] cette taille, médecin, assuré, agent (peu
// importe le type d'agent)". Une seule constante réutilisée par TOUTES les
// méthodes qui dessinent une signature (médecin, assuré, prestataire/agent
// traitant, gestionnaire) — jamais une taille différente selon le document.
const TAILLE_SIGNATURE: [number, number] = [150, 45];

// FCFA sans sous-unité utilisée en pratique — jamais de virgule affichée.
// Espace ASCII normal (pas le séparateur "narrow no-break space" que produit
// Intl.NumberFormat("fr-FR") par défaut) — Helvetica n'a pas ce glyphe et
// l'affiche comme un caractère de remplacement ("/") dans pdfkit.
function fmt(n: Prisma.Decimal | number | string | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return v < 0 ? `-${s}` : s;
}

// Éclaircit une couleur hex en la mélangeant avec du blanc (0 = inchangée,
// 1 = blanc pur) — voir "Evolution du S/P" du rapport Statistiques, dont
// la ligne d'info du modèle de référence est en bleu CLAIR (pas la couleur
// primaire pleine), dérivée dynamiquement plutôt que codée en dur pour
// rester valable avec les couleurs de n'importe quelle société.
function eclaircir(hex: string, melange: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * melange);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const TAUX_TAXE_GABON = 0.08;

const TYPE_ASSURE_LABELS: Record<string, string> = { AS: "Assuré Principal", CJ: "Conjoint", EF: "Enfant" };

// Tracés SVG lucide-react (viewBox 24×24) repris à l'identique pour les
// icônes de contact au verso de la carte d'assurance.
const ICONE_GLOBE = [
  { circle: [12, 12, 10] as [number, number, number] },
  { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" },
  { d: "M2 12h20" },
];
const ICONE_TELEPHONE = [
  { d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" },
];
const ICONE_QRCODE = [
  { rect: [3, 3, 5, 5, 1] as [number, number, number, number, number] },
  { rect: [16, 3, 5, 5, 1] as [number, number, number, number, number] },
  { rect: [3, 16, 5, 5, 1] as [number, number, number, number, number] },
  { d: "M21 16h-3a2 2 0 0 0-2 2v3" },
  { d: "M21 21v.01" },
  { d: "M12 7v3a2 2 0 0 1-2 2H7" },
  { d: "M3 12h.01" },
  { d: "M12 3h.01" },
  { d: "M12 16v.01" },
  { d: "M16 12h1" },
  { d: "M21 12v.01" },
  { d: "M12 21v-1" },
];

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

function daysBetween(a?: string | null, b?: string | null): number {
  const debut = parseDateFr(a);
  const fin = parseDateFr(b);
  if (!debut || !fin) return 0;
  return Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
}

// "01/01/2024" → "01 - 01 - 2024" (format des lignes Effet/Echéance de la Quittance)
function dateTirets(s?: string | null): string {
  return (s ?? "").split("/").join(" - ");
}

// Rendu label/valeur sûr : deux appels .text() positionnés explicitement
// (jamais de chaînage `continued`, qui hérite la largeur du premier appel
// et provoque un retour à la ligne prématuré + chevauchement des lignes
// suivantes dès que la valeur dépasse cette largeur). Retourne le y suivant,
// calculé sur la hauteur réellement occupée (gère les valeurs longues).
function champ(
  doc: PDFKit.PDFDocument, x: number, y: number, label: string, valeur: string, labelW: number, valW: number,
  opts?: { boldLabel?: boolean; boldValeur?: boolean; alignValeur?: "left" | "right"; fontSize?: number; lineGap?: number },
): number {
  const size = opts?.fontSize ?? 9;
  doc.fontSize(size).font(opts?.boldLabel ? "Helvetica-Bold" : "Helvetica").text(label, x, y, { width: labelW });
  doc.fontSize(size).font(opts?.boldValeur ? "Helvetica-Bold" : "Helvetica").text(valeur, x + labelW, y, { width: valW, align: opts?.alignValeur ?? "left" });
  const h = Math.max(doc.heightOfString(label, { width: labelW }), doc.heightOfString(valeur, { width: valW }), size + 2);
  return y + h + (opts?.lineGap ?? 2);
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function dateLettres(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${MOIS_FR[d.getMonth()]}-${d.getFullYear()}`;
}

function heureColon(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function heureVerbeuse(d: Date): string {
  return `${d.getHours()} H ${d.getMinutes()} Mn ${d.getSeconds()} S`;
}

// Référence de facture lisible (2026-09) — voir demande utilisateur :
// "s'il est possible de déchiffrer ce code et le raccourcir, fais-le".
// Les factures réellement télétransmises depuis le système externe d'un
// prestataire portent une référence "MS-PRESTA-<uuid>-<horodatage
// numérique>" (voir import.service.ts, REGEX_REFERENCE_TELETRANSMISE) —
// illisible affichée telle quelle. L'UUID est un identifiant opaque, sans
// rien à déchiffrer ; l'horodatage final, lui, encode une vraie date/heure
// (AAAAMMJJHHmmssSSS) — c'est la seule partie réellement "déchiffrable",
// affichée à la place du bloc complet. Le champ `referenceFacture` original
// n'est jamais modifié en base, seul l'AFFICHAGE sur le document change.
function referenceLisible(reference: string): string {
  const m = reference.match(/^(MS-PRESTA)-[0-9a-f-]{36}-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\d*$/i);
  if (!m) return reference;
  const [, prefixe, annee, mois, jour, heure, minute] = m;
  return `${prefixe} · ${jour}/${mois}/${annee} ${heure}:${minute}`;
}

// Référence de quittance/police lisible, dérivée de façon stable de l'id
// (même document régénéré → même numéro affiché).
function refNumerique(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(100000 + (h % 900000));
}

// Chaque pièce (Quittance, Avenant, Tableau de garanties) est imprimée en
// 4 exemplaires physiques dans le même PDF : 2 pour la compagnie, 1 pour la
// comptabilité, 1 pour le client — la mention en bas à droite de chaque
// exemplaire (à la place du "Pour la Compagnie" fixe) l'identifie.
const EXEMPLAIRES = ["Pour la Compagnie", "Pour la Compagnie", "Pour la Comptabilité", "Pour le Client"];

// Portail client (2026-09) — voir demande utilisateur : "il ne faut que
// l'application ne génère que l'exemplaire du client et non les
// exemplaires comme du côté de l'assurance". `exemplaireClientSeul` restreint
// à la seule mention "Pour le Client", jamais les 4 exemplaires internes.
function exemplairesA(exemplaireClientSeul: boolean): string[] {
  return exemplaireClientSeul ? ["Pour le Client"] : EXEMPLAIRES;
}

type MouvementKind = "AffaireNouvelle" | "Renouvellement" | "Incorporation" | "Retrait" | "Ajustement de Prime" | "Régularisation de Prime";

const AVENANT_META: Record<string, { code: string; suffixe: string; estRistourne: boolean }> = {
  "Renouvellement": { code: "02", suffixe: "DE RENOUVELLEMENT", estRistourne: false },
  "Incorporation": { code: "03", suffixe: "D'INCORPORATION", estRistourne: false },
  "Retrait": { code: "09", suffixe: "DE RETRAIT", estRistourne: true },
  "Ajustement de Prime": { code: "04", suffixe: "D'AJUSTEMENT DE PRIME", estRistourne: false },
  "Régularisation de Prime": { code: "05", suffixe: "DE RÉGULARISATION DE PRIME", estRistourne: false },
};

interface DocContrat {
  id: string; branche: string; typeAffaire: string; dateDebut: string; dateFin: string; prime: Prisma.Decimal;
  primeNette: Prisma.Decimal | null; primeTotaleHT: Prisma.Decimal | null;
  montantAccessoires: Prisma.Decimal | null; montantTaxe: Prisma.Decimal | null; tauxCommission: Prisma.Decimal | null;
  paysSouscription: string | null; extensionsTerritorialite: string[];
  tauxCouvertureAmbulatoire: string | null; tauxCouvertureHospitalisation: string | null;
  nombreAssuresPrincipaux: number | null; nombreConjoints: number | null; nombreEnfants: number | null; nombreCouples: number | null;
  primeUnitaireAssurePrincipal: Prisma.Decimal | null; primeUnitaireConjoint: Prisma.Decimal | null;
  primeUnitaireEnfant: Prisma.Decimal | null; primeUnitaireCouple: Prisma.Decimal | null;
  numeroQuittance: number | null;
  client: { id: string; nom: string; pays: string | null; ville?: string | null; adresse?: string | null; boitePostale?: string | null; tel: string | null };
  compagnie: { id: string; nom: string; pays: string };
  garanties: { categorie: string; libelle: string; tauxAssure: Prisma.Decimal | null; plafond: string | null }[];
}

interface DocAvenant {
  id: string; contratId: string; type: string; description: string;
  primeAvant: Prisma.Decimal; primeApres: Prisma.Decimal; dateEffet: string; createdAt: Date;
  numeroQuittance: number | null;
  contrat: DocContrat;
}

// "{Branche} {Souscripteur}" — ex. "MALADIE BGFI BANK GABON".
function risqueTexte(contrat: DocContrat): string {
  return `${contrat.branche.toUpperCase()} ${contrat.client.nom.toUpperCase()}`;
}

// Pays de souscription seul ("GABON UNIQUEMENT") si aucune extension de
// territorialité, sinon pays + liste des extensions couvertes.
function territorialiteTexte(contrat: DocContrat, tiret = false): string {
  const pays = (contrat.paysSouscription ?? "GABON").toUpperCase();
  if (!contrat.extensionsTerritorialite || contrat.extensionsTerritorialite.length === 0) {
    return `${pays} ${tiret ? "- " : ""}UNIQUEMENT`;
  }
  return [pays, ...contrat.extensionsTerritorialite.map((e) => e.toUpperCase())].join(" - ");
}

// Ajoute "%" si la valeur ne le porte pas déjà (certains contrats stockent
// un taux nu ("80"), d'autres une phrase déjà porteuse de son propre "%").
function pourcent(v: string): string {
  return v.includes("%") ? v : `${v}%`;
}

// Taux court pour le bandeau recto de la carte ("80%") — certains contrats
// stockent une phrase descriptive complète ("Consultation généraliste 80%,
// ...") plutôt qu'un taux nu ; on retient le premier nombre trouvé comme
// taux d'ensemble affiché, faute de place pour la liste détaillée.
function tauxCourt(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.match(/\d+(\.\d+)?/);
  return m ? `${m[0]}%` : v;
}

// Notes légales — libellés reproduits à l'identique pour Affaire Nouvelle /
// Renouvellement / Retrait (fournis) ; les 3 autres types d'avenant suivent
// la même formulation/structure, adaptée au mouvement.
function noteLegale(kind: MouvementKind, ctx: { dateEffet: string; dateFin: string; jours: number }): string[] {
  switch (kind) {
    case "AffaireNouvelle":
      return [
        "D'un commun accord entre les parties, il est convenu et agréé que la présente police est",
        "souscrite pour la période et les garanties indiquées au présent contrat.",
        "",
        "Conformément aux dispositions des conditions générales, les garanties ne seront",
        "effectivement acquises à l'assuré qu'à compter du paiement de la prime.",
        "",
        "La police expirera de plein droit à son échéance.",
        "",
        "L'assuré reconnaît avoir reçu les conditions générales régissant le contrat.",
      ];
    case "Renouvellement":
      return [
        "D'un commun accord entre les parties, il est convenu et agrée que la présente police est",
        `renouvelée dans son ensemble pour une durée de ${ctx.jours} jours du ${ctx.dateEffet} au ${ctx.dateFin}.`,
        "",
        "Rien d'autre n'est changé aux conditions tant Particulières que Générales.",
        "",
        `Il est rappelé que l'échéance du présent avenant est fixée au ${ctx.dateFin}`,
      ];
    case "Retrait":
      return [
        "D'un commun accord entre les parties, il est convenu et agrée que les ayants droits cités",
        `sont retirés de la présente police à compter du ${ctx.dateEffet} au ${ctx.dateFin}.`,
        "",
        "Il n'est rien changé aux autres clauses et conditions du contrat.",
        "",
        `Il est rappelé que l'échéance du présent avenant est fixée au ${ctx.dateFin}.`,
      ];
    case "Incorporation":
      return [
        "D'un commun accord entre les parties, il est convenu et agrée que les personnes citées",
        `sont incorporées à la présente police à compter du ${ctx.dateEffet} au ${ctx.dateFin}.`,
        "",
        "Il n'est rien changé aux autres clauses et conditions du contrat.",
        "",
        `Il est rappelé que l'échéance du présent avenant est fixée au ${ctx.dateFin}.`,
      ];
    case "Ajustement de Prime":
      return [
        "D'un commun accord entre les parties, il est convenu et agrée que la prime de la présente",
        `police est ajustée à compter du ${ctx.dateEffet} au ${ctx.dateFin}.`,
        "",
        "Il n'est rien changé aux autres clauses et conditions du contrat.",
        "",
        `Il est rappelé que l'échéance du présent avenant est fixée au ${ctx.dateFin}.`,
      ];
    case "Régularisation de Prime":
      return [
        "D'un commun accord entre les parties, il est convenu et agrée que la prime de la présente",
        `police fait l'objet d'une régularisation à compter du ${ctx.dateEffet} au ${ctx.dateFin}.`,
        "",
        "Il n'est rien changé aux autres clauses et conditions du contrat.",
        "",
        `Il est rappelé que l'échéance du présent avenant est fixée au ${ctx.dateFin}.`,
      ];
  }
}

// Ligne d'un état détaillé de factures (2026-09) — voir
// DocumentsService.dessinerEtatFactures, partagé par renderLettreCheque
// (Règlement Comptable) et renderReglement (Règlement Maladie).
type LigneEtatFacture = {
  montant: Prisma.Decimal; montantRejete: Prisma.Decimal | null; baseRemboursement: Prisma.Decimal | null; montantTps: Prisma.Decimal | null;
  date: string; facture: { referenceFacture: string } | null; assure: { nom: string; prenom: string | null };
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService, private parametresEntreprise: ParametresEntrepriseService,
    private statistiques: StatistiquesService, private bordereaux: BordereauxService,
    private cotation: CotationService, private courrier: CourrierService, private crm: CrmService,
    private reglementComptable: ReglementComptableService, private reglementPrestataire: ReglementPrestataireService,
    private renouvellements: RenouvellementsService, private accordPrealable: AccordPrealableService,
    private prestataires: PrestatairesService, private storage: StorageService,
    private documentSignature: DocumentSignatureService,
  ) {}

  // Charge une image (logo/page de garde/modèle de carte/photo) depuis
  // Supabase Storage si configuré, sinon depuis le disque local — voir
  // StorageService. PDFKit `doc.image()` accepte indifféremment un Buffer
  // OU un chemin de fichier (string), donc les deux branches restent
  // directement utilisables par tous les appelants sans changement de
  // signature. `null` = fichier absent, jamais une exception (comportement
  // identique à l'ancien `fs.existsSync` avant chaque `doc.image()`).
  private async chargerImage(categorie: string, nomFichier: string | null | undefined, dossierLocal: string): Promise<Buffer | string | null> {
    if (!nomFichier) return null;
    if (this.storage.actif) return this.storage.download(categorie, nomFichier);
    const chemin = path.join(dossierLocal, nomFichier);
    return fs.existsSync(chemin) ? chemin : null;
  }

  // Photo d'assuré → miniature carte (2026-09) — voir demande utilisateur :
  // "je veux la rapidité, la fluidité". Les photos uploadées (souvent
  // directement une photo de téléphone, plusieurs Mo) étaient embarquées
  // TELLES QUELLES par pdfkit malgré un affichage final de 50×60pt à peine
  // — chaque carte pesait ~1,8 Mo rien que pour la photo, mesuré en
  // production : 25-40s pour UNE carte sur le réseau. 300px de large est
  // déjà largement suffisant pour l'impression sur cette taille de vignette
  // (300 DPI sur 50pt ≈ 208px) ; ré-encodage JPEG qualité 80. Échec de
  // lecture (fichier corrompu/format exotique) → repli sur l'image brute,
  // jamais bloquant.
  private async redimensionnerPhoto(image: Buffer | string): Promise<Buffer | string> {
    try {
      // flatten fond blanc (2026-09) — voir capture utilisateur : "on ne
      // doit pas avoir de fond noir". Une photo PNG avec zones
      // transparentes (bords irréguliers, recadrage antérieur...) devient
      // NOIR par défaut lors de la conversion JPEG (sharp remplit la
      // transparence en noir si aucun fond n'est précisé — JPEG ne
      // supporte pas l'alpha). Fond blanc explicite, cohérent avec le
      // reste de la carte.
      // position: "top" (2026-09 — voir capture utilisateur : têtes
      // coupées sur les cartes) — le recadrage RÉEL se fait ICI (sharp,
      // avant que pdfkit ne dessine quoi que ce soit) : "cover" par défaut
      // centre le rognage (haut ET bas coupés à égalité), alors que le
      // visage se trouve presque toujours dans la moitié haute d'une photo
      // — ancrer le rognage en haut ne coupe plus jamais la tête, seul le
      // bas (épaules/torse, sans importance sur une carte) est rogné.
      return await sharp(image).rotate().resize({ width: 300, height: 360, fit: "cover", position: "top" }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
    } catch {
      return image;
    }
  }

  private async findContrat(id: string): Promise<DocContrat> {
    const contrat = await this.prisma.contrat.findUnique({
      where: { id },
      include: { client: true, compagnie: true, garanties: true },
    });
    if (!contrat) throw new NotFoundException(`Contrat ${id} introuvable`);
    return contrat;
  }

  private async findAvenant(id: string): Promise<DocAvenant> {
    const avenant = await this.prisma.avenant.findUnique({
      where: { id },
      include: { contrat: { include: { client: true, compagnie: true, garanties: true } } },
    });
    if (!avenant) throw new NotFoundException(`Avenant ${id} introuvable`);
    return avenant;
  }

  private async numeroAvenant(avenant: DocAvenant): Promise<number> {
    return this.prisma.avenant.count({ where: { contratId: avenant.contratId, createdAt: { lte: avenant.createdAt } } });
  }

  // Compteur global d'émission de pièces — incrémenté atomiquement une seule
  // fois par contrat/avenant (à la première génération), puis simplement
  // relu ensuite : le numéro affiché reste stable d'un téléchargement à l'autre.
  private async prochainNumeroQuittance(): Promise<number> {
    const compteur = await this.prisma.compteurDocument.upsert({
      where: { id: "quittance" },
      update: { valeur: { increment: 1 } },
      create: { id: "quittance", valeur: 846605 },
    });
    return compteur.valeur;
  }

  private async numeroQuittanceContrat(contrat: DocContrat): Promise<number> {
    if (contrat.numeroQuittance !== null) return contrat.numeroQuittance;
    const n = await this.prochainNumeroQuittance();
    await this.prisma.contrat.update({ where: { id: contrat.id }, data: { numeroQuittance: n } });
    return n;
  }

  private async numeroQuittanceAvenant(avenant: DocAvenant): Promise<number> {
    if (avenant.numeroQuittance !== null) return avenant.numeroQuittance;
    const n = await this.prochainNumeroQuittance();
    await this.prisma.avenant.update({ where: { id: avenant.id }, data: { numeroQuittance: n } });
    return n;
  }

  // ── Numérotation Feuille de Soins / Feuille d'Examen ────────────────────
  // "FS-000001/2026" / "FE-000001/2026" — même mécanisme de compteur
  // atomique que prochainNumeroQuittance ci-dessus (CompteurDocument),
  // préfixe + séquence sur 6 chiffres + année d'émission. Voir demande
  // utilisateur : "la consultation est l'origine de la feuille de soins...
  // lorsque le médecin fera sa prescription, la feuille de soins va se
  // compléter" — numeroFeuilleSoinsDe() ci-dessous garantit que le numéro
  // reste STABLE entre le premier PDF émis et la prescription qui vient
  // ensuite le compléter (jamais régénéré à chaque impression).
  async prochainNumeroFormulaire(kind: "feuille-soins" | "feuille-examen"): Promise<string> {
    const prefixe = kind === "feuille-soins" ? "FS" : "FE";
    const compteur = await this.prisma.compteurDocument.upsert({
      where: { id: kind },
      update: { valeur: { increment: 1 } },
      create: { id: kind, valeur: 1 },
    });
    return `${prefixe}-${String(compteur.valeur).padStart(6, "0")}/${new Date().getFullYear()}`;
  }

  async numeroFeuilleSoinsDe(priseEnChargeId: string): Promise<string> {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: priseEnChargeId }, select: { numeroFeuilleSoins: true } });
    if (!ligne) throw new NotFoundException(`Prise en charge ${priseEnChargeId} introuvable`);
    if (ligne.numeroFeuilleSoins) return ligne.numeroFeuilleSoins;
    const numero = await this.prochainNumeroFormulaire("feuille-soins");
    await this.prisma.priseEnCharge.update({ where: { id: priseEnChargeId }, data: { numeroFeuilleSoins: numero } });
    return numero;
  }

  // Personnes concernées par un avenant Incorporation/Retrait — retrouvées
  // via la date d'effet du mouvement (matricule/nom réels, pas de texte
  // reconstitué), pour lister les noms comme sur les modèles fournis.
  private async personnesConcernees(avenant: DocAvenant): Promise<{ nom: string; prenom?: string | null; typeAssure?: string | null }[]> {
    if (avenant.type === "Retrait") {
      return this.prisma.assureSante.findMany({
        where: { contratId: avenant.contratId, statut: "Radié", dateRadiation: avenant.dateEffet },
        select: { nom: true, prenom: true, typeAssure: true },
      });
    }
    if (avenant.type === "Incorporation") {
      return this.prisma.assureSante.findMany({
        where: { contratId: avenant.contratId, dateAffiliation: avenant.dateEffet },
        select: { nom: true, prenom: true, typeAssure: true },
      });
    }
    return [];
  }

  // ── Quittance (Affaire Nouvelle et avenants) ────────────────────────────
  // Modèle : lettre à en-tête courtier, bandeau titre bleu, bloc police/
  // souscripteur en 2 colonnes, désignation risque/assurés, garanties et
  // primes, récapitulatif prime, note légale, signatures.

  // `fmt`/`exemplaireClientSeul` (2026-09) — voir demande utilisateur :
  // portail client, "il ne faut que l'application ne génère que l'exemplaire
  // du client... [format] pdf/docx". `fmt` non reconnu retombe sur "pdf".
  async renderQuittance(contratId: string, format: string, res: Response, exemplaireClientSeul = false) {
    const contrat = await this.findContrat(contratId);
    if (format === "docx") return this.genererQuittanceDocx(res, { kind: "AffaireNouvelle", contrat, avenant: null, numero: 0, personnes: [] });
    await this.genererQuittance(res, { kind: "AffaireNouvelle", contrat, avenant: null, numero: 0, personnes: [], exemplaireClientSeul });
  }

  async renderQuittanceAvenant(avenantId: string, format: string, res: Response, exemplaireClientSeul = false) {
    const avenant = await this.findAvenant(avenantId);
    const [numero, personnes] = await Promise.all([this.numeroAvenant(avenant), this.personnesConcernees(avenant)]);
    if (format === "docx") return this.genererQuittanceDocx(res, { kind: avenant.type as MouvementKind, contrat: avenant.contrat, avenant, numero, personnes });
    await this.genererQuittance(res, { kind: avenant.type as MouvementKind, contrat: avenant.contrat, avenant, numero, personnes, exemplaireClientSeul });
  }

  private async genererQuittance(res: Response, opts: {
    kind: MouvementKind; contrat: DocContrat; avenant: DocAvenant | null; numero: number;
    personnes: { nom: string; prenom?: string | null; typeAssure?: string | null }[]; exemplaireClientSeul?: boolean;
  }) {
    const { kind, contrat, avenant, numero, personnes } = opts;
    const numeroQuittance = avenant ? await this.numeroQuittanceAvenant(avenant) : await this.numeroQuittanceContrat(contrat);
    const meta = kind === "AffaireNouvelle" ? { code: "01", suffixe: "", estRistourne: false } : AVENANT_META[kind];
    const titreDroite = kind === "AffaireNouvelle" ? "AFFAIRE NOUVELLE" : `AVENANT ${meta.suffixe}`;

    const dateEffet = avenant ? avenant.dateEffet : contrat.dateDebut;
    const dateFin = contrat.dateFin;
    const jours = daysBetween(dateEffet, dateFin);
    const primeNette = Number(avenant ? avenant.primeApres : (contrat.primeNette ?? contrat.prime));
    const montantAccessoires = Number(contrat.montantAccessoires ?? 0) * (meta.estRistourne ? -1 : 1);
    const montantTaxe = Math.round((primeNette + montantAccessoires) * TAUX_TAXE_GABON);
    const primeTotale = primeNette + montantAccessoires + montantTaxe;
    // "Stat" = taux de commission paramétré sur la compagnie et son montant
    // (prélèvement du courtier sur la prime nette de cette pièce précise).
    const tauxCommission = Number(contrat.tauxCommission ?? 0);
    const montantCommission = Math.round(primeNette * (tauxCommission / 100));
    const now = new Date();
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${meta.estRistourne ? "Ristourne" : "Quittance"}-${avenant?.id ?? contrat.id}.pdf"`);
    doc.pipe(res);

    const dessinerCorps = (exemplaire: string) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    // En-tête courtier (identité de l'entreprise exploitant l'application)
    this.dessinerLogoEntete(doc, logoImage, left, 8);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#333").text(p.sousTitre, left, 56);
    doc.fontSize(8).font("Helvetica").fillColor("#333");
    doc.text(`Tél.: ${p.telephone}`, right - 200, 40, { width: 200, align: "right" });
    doc.text(`${p.boitePostale} ${p.ville} - ${p.pays}`, right - 200, 51, { width: 200, align: "right" });
    doc.text(`E-mail: ${p.email}`, right - 200, 62, { width: 200, align: "right" });

    let y = 100;
    doc.rect(left, y, 230, 18).fill(p.couleurPrimaire);
    doc.fillColor("#fff").fontSize(10).font("Helvetica-Bold").text(meta.estRistourne ? "EMISSION DE RISTOURNE" : "EMISSION DE QUITTANCE", left + 8, y + 5);
    doc.fillColor("#000").fontSize(10).font("Helvetica-Bold").text(`${meta.code} ${titreDroite}`, left + 240, y + 5);
    doc.fillColor("#000");
    y += 30;
    doc.moveTo(left, y).lineTo(right, y).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
    y += 4;
    doc.fontSize(9).font("Helvetica").text(`Compagnie : ${contrat.compagnie.id}  ${contrat.compagnie.nom}     Courtier : ${p.nom}`, left, y);
    y += 12;
    doc.moveTo(left, y).lineTo(right, y).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
    y += 8;

    const colGap = 16;
    const colWidth = (width - colGap) / 2;
    const rightColX = left + colWidth + colGap;
    const topInfo = y;

    const infoLignes: [string, string][] = [
      ["Branche :", contrat.branche],
      ["Police :", `POLICE N° ${contrat.id}`],
      ["Emission :", `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`],
      ["Effet :", `${dateTirets(dateEffet)}  A 0 Heure`],
      ["Echéance :", `${dateTirets(dateFin)}  A Minuit`],
      ["Quittance :", String(numeroQuittance)],
      ["Durée :", `${jours} Jour(s)`],
      ["Stat :", `${tauxCommission.toFixed(2)}%   ${fmt(montantCommission)}`],
    ];
    let yy = topInfo;
    for (const [label, valeur] of infoLignes) {
      yy = champ(doc, left, yy, label, valeur, 62, colWidth - 62);
    }

    doc.moveTo(rightColX - 8, topInfo - 2).lineTo(rightColX - 8, topInfo + 200).strokeColor("#999").stroke();
    let sy = champ(doc, rightColX, topInfo, "SOUSCRIPTEUR", `N° Client : ${refNumerique(contrat.client.id)}`, 100, colWidth - 100, { boldLabel: true });
    doc.moveTo(rightColX, sy - 1).lineTo(right, sy - 1).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
    sy += 4;
    doc.font("Helvetica-Bold").fontSize(9).text(contrat.client.nom, rightColX, sy, { width: colWidth });
    sy += doc.heightOfString(contrat.client.nom, { width: colWidth }) + 4;
    sy = champ(doc, rightColX, sy, "BP :", contrat.client.boitePostale ?? "—", 30, colWidth - 30);
    sy = champ(doc, rightColX, sy, contrat.client.ville ?? "", contrat.client.pays ?? "", colWidth / 2, colWidth / 2);
    sy = champ(doc, rightColX, sy, "TEL :", `${contrat.client.tel ?? ""}    Fax :`, 30, colWidth - 30);

    y = Math.max(yy, sy) + 8;
    doc.fontSize(9).font("Helvetica-Bold").text("DESIGNATION DU RISQUE", left, y);
    doc.font("Helvetica-Bold").text("ASSURE(S)", rightColX, y);
    y += 4;
    doc.moveTo(left, y + 8).lineTo(rightColX - 16, y + 8).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
    doc.moveTo(rightColX, y + 8).lineTo(right, y + 8).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
    y += 14;
    doc.font("Helvetica").fontSize(9).text(risqueTexte(contrat), left, y, { width: colWidth });

    const assureLignes = this.buildAssureSection(kind, contrat, avenant, numero, personnes);
    let ay = y;
    for (const ligne of assureLignes) {
      doc.font("Helvetica").fontSize(9).text(ligne, rightColX, ay, { width: colWidth });
      ay += ligne ? doc.heightOfString(ligne, { width: colWidth }) + 2 : 8;
    }
    doc.moveTo(rightColX - 8, y - 6).lineTo(rightColX - 8, Math.max(ay, y + 90)).strokeColor("#999").stroke();

    y = Math.max(y + 90, ay) + 20;
    doc.fontSize(9).font("Helvetica-Bold").text("DESIGNATION DES GARANTIES", left, y, { underline: true });
    doc.text("GARANTIES", rightColX, y, { underline: true });
    doc.text("PRIMES", right - 100, y, { width: 100, align: "right", underline: true });
    y += 14;
    doc.font("Helvetica").fontSize(9);
    const designationLignes = kind === "AffaireNouvelle"
      ? ["AFFAIRE NOUVELLE", territorialiteTexte(contrat), ...this.resumeTauxLignes(contrat), contrat.branche.toUpperCase()]
      : [`AVENANT N°${numero} ${AVENANT_META[kind].suffixe}`, territorialiteTexte(contrat, true), ...this.resumeTauxLignes(contrat), contrat.branche.toUpperCase()];
    let dy = y;
    for (const l of designationLignes) {
      doc.font("Helvetica").fontSize(9).text(l, left, dy, { width: colWidth });
      dy += doc.heightOfString(l, { width: colWidth }) + 2;
    }
    champ(doc, rightColX, y, "R.O.", fmt(primeNette), 70, colWidth - 70, { alignValeur: "right" });

    y = Math.max(dy, y + 20) + 30;
    const boxW = 230;
    const boxX = right - boxW;
    const recap: [string, string, boolean][] = [
      ["PRIME NETTE", fmt(primeNette), false],
      ["ACCESSOIRES", fmt(montantAccessoires), false],
      ["TAXES", fmt(montantTaxe), false],
      ["PRIME TOTALE A PAYER", fmt(primeTotale), true],
    ];
    for (const [label, valeur, bold] of recap) {
      const ny = champ(doc, boxX, y, label, valeur, 150, boxW - 150, { boldLabel: bold, boldValeur: bold, alignValeur: "right" });
      if (!bold) doc.moveTo(boxX, ny - 3).lineTo(right, ny - 3).dash(1, { space: 1 }).strokeColor("#999").stroke().undash();
      y = ny;
    }

    y += 20;
    doc.fontSize(9).font("Helvetica");
    for (const ligne of noteLegale(kind, { dateEffet, dateFin, jours })) {
      if (ligne === "") { y += 8; continue; }
      doc.text(ligne, left, y, { width });
      y += 13;
    }

    const footerY = doc.page.height - 90;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor("#ccc").stroke();
    doc.fontSize(9).font("Helvetica-Oblique").text("Le Souscripteur", left, footerY + 20);
    doc.font("Helvetica").text(`Fait à Libreville le ${now.toLocaleDateString("fr-FR")} à ${heureColon(now)}`, right - 220, footerY + 12, { width: 220, align: "right" });
    doc.font("Helvetica-Oblique").text(exemplaire, right - 220, footerY + 26, { width: 220, align: "right" });
    };

    const exemplaires = exemplairesA(opts.exemplaireClientSeul ?? false);
    for (let i = 0; i < exemplaires.length; i++) {
      if (i > 0) doc.addPage();
      dessinerCorps(exemplaires[i]);
    }
    doc.end();
  }

  // Reprend tel quel le texte saisi dans l'onglet Garanties (Résumé global)
  // — mêmes champs que ceux affichés sur la carte d'assurance.
  private resumeTauxLignes(contrat: DocContrat): string[] {
    const lignes: string[] = [];
    if (contrat.tauxCouvertureAmbulatoire) lignes.push(`Ambulatoires : ${pourcent(contrat.tauxCouvertureAmbulatoire)}`);
    if (contrat.tauxCouvertureHospitalisation) lignes.push(`Hospitalisations : ${pourcent(contrat.tauxCouvertureHospitalisation)}`);
    return lignes.length > 0 ? lignes : ["GARANTIES SELON TABLEAU JOINT"];
  }

  private buildAssureSection(
    kind: MouvementKind, contrat: DocContrat, avenant: DocAvenant | null, numero: number,
    personnes: { nom: string; prenom?: string | null; typeAssure?: string | null }[],
  ): string[] {
    const totalPop = (contrat.nombreAssuresPrincipaux ?? 0) + (contrat.nombreConjoints ?? 0) + (contrat.nombreEnfants ?? 0) + (contrat.nombreCouples ?? 0);
    if (kind === "AffaireNouvelle") {
      return ["AFFAIRE NOUVELLE", "", `CONCERNE: ${totalPop} PERSONNES`, "( voir liste annexée)"];
    }
    const titre = `AVENANT N°${numero} ${AVENANT_META[kind].suffixe}`;
    if (kind === "Retrait") {
      return [
        titre, "", `CONCERNE: ${personnes.length} PERSONNE(S)`,
        ...personnes.map((p) => `-${p.nom} ${p.prenom ?? ""} ( ${TYPE_ASSURE_LABELS[p.typeAssure ?? ""] ?? "Ayant droit"} )`),
      ];
    }
    if (kind === "Incorporation") {
      return [titre, "", `CONCERNE: ${personnes.length} PERSONNE(S)`, ...personnes.map((p) => `-${p.nom} ${p.prenom ?? ""} ( ${TYPE_ASSURE_LABELS[p.typeAssure ?? ""] ?? ""} )`)];
    }
    return [titre, "", `CONCERNE: ${totalPop} PERSONNES`];
  }

  // ── Avenant (document contractuel, en-tête compagnie) ───────────────────

  async renderAvenant(avenantId: string, format: string, res: Response, exemplaireClientSeul = false) {
    const avenant = await this.findAvenant(avenantId);
    const numero = await this.numeroAvenant(avenant);
    const meta = AVENANT_META[avenant.type];
    if (!meta) throw new BadRequestException(`Type d'avenant "${avenant.type}" non pris en charge pour la génération de document.`);
    if (format === "docx") return this.genererAvenantDocx(res, avenant, numero, meta);

    const contrat = avenant.contrat;
    const dateFin = contrat.dateFin;
    const jours = daysBetween(avenant.dateEffet, dateFin);
    const primeNette = Number(avenant.primeApres);
    const montantAccessoires = Number(contrat.montantAccessoires ?? 0) * (meta.estRistourne ? -1 : 1);
    const montantTaxe = Math.round((primeNette + montantAccessoires) * TAUX_TAXE_GABON);
    const primeTotale = primeNette + montantAccessoires + montantTaxe;
    const now = new Date();
    const p = await this.parametresEntreprise.findOne();

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Avenant-${avenant.id}.pdf"`);
    doc.pipe(res);

    const dessinerCorps = (exemplaire: string) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#c0392b").text(contrat.compagnie.nom.toUpperCase(), left, 40);
    doc.fontSize(7).font("Helvetica").fillColor("#333");
    doc.text("Entreprise régie par le Code des Assurances CIMA", left, 58);
    doc.text(`Siège social : Libreville (${contrat.compagnie.pays})`, left, 68);
    doc.fillColor(p.couleurPrimaire).fontSize(12).font("Helvetica-Bold").text(`AVENANT ${meta.suffixe} N° ${String(numero).padStart(3, "0")}`, left + 260, 45, { width: width - 260, align: "right" });
    doc.fillColor("#000");

    let y = 100;
    const tableTop = y;
    const midX = left + width * 0.42;
    const rowH = [16, 16, 16, 16, 40];
    const totalTableH = rowH.reduce((a, b) => a + b, 0);
    doc.rect(left, tableTop, width, totalTableH).stroke();
    doc.moveTo(midX, tableTop).lineTo(midX, tableTop + totalTableH).stroke();
    let ry = tableTop;
    for (const h of rowH.slice(0, 4)) { doc.moveTo(left, ry + h).lineTo(right, ry + h).stroke(); ry += h; }

    const leftCellW = midX - left - 8;
    const rightCellW = right - midX - 8;
    ry = tableTop;
    champ(doc, left + 4, ry + 4, "POLICE :", contrat.id, 44, leftCellW - 44, { boldLabel: true, fontSize: 8 });
    champ(doc, midX + 4, ry + 4, "SOUSCRIPTEUR", `${refNumerique(contrat.client.id)}  ${contrat.client.nom}`, 74, rightCellW - 74, { boldLabel: true, fontSize: 8 });
    ry += rowH[0];
    champ(doc, left + 4, ry + 4, "EFFET :", avenant.dateEffet, 44, leftCellW - 44, { boldLabel: true, boldValeur: true, fontSize: 8 });
    doc.font("Helvetica").fontSize(7).text(`BP : ${contrat.client.boitePostale ?? "—"}     ADRESSE : ${contrat.client.adresse ?? "—"}`, midX + 4, ry + 4, { width: rightCellW });
    ry += rowH[1];
    champ(doc, left + 4, ry + 4, "ECHEANCE :", dateFin, 60, leftCellW - 60, { boldLabel: true, boldValeur: true, fontSize: 8 });
    doc.font("Helvetica").fontSize(7).text(`VILLE : ${contrat.client.ville ?? "—"}     PAYS : ${contrat.client.pays ?? "—"}     TEL : ${contrat.client.tel ?? "—"}`, midX + 4, ry + 4, { width: rightCellW });
    doc.fontSize(8).font("Helvetica-Bold").text("ASSURE (S)", midX + 4, ry + 16);
    ry += rowH[2];
    champ(doc, left + 4, ry + 4, "DUREE CONTRAT :", `${jours} Jour(s)`, 80, leftCellW - 80, { boldLabel: true, fontSize: 8 });
    ry += rowH[3];
    doc.font("Helvetica-Bold").fontSize(8).text("RISQUE", left + 4, ry + 4);
    doc.font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(risqueTexte(contrat), left + 4, ry + 16, { width: leftCellW });
    doc.fillColor("#000");
    champ(doc, midX + 4, ry + 4, "COMPAGNIE", contrat.compagnie.nom, 62, rightCellW - 62, { boldValeur: true, fontSize: 8 });
    doc.font("Helvetica").fontSize(7).text(`AGENCE   ${p.nom}`, midX + 4, ry + 16, { width: rightCellW });
    y = tableTop + totalTableH + 12;

    const decompteColW = [width * 0.32, width * 0.14, width * 0.13, width * 0.14, width * 0.13, width * 0.14];
    let cx = left;
    const decompteHeaders = ["Décompte de la prime au comptant", "Prime nette", "Frais quitt.", "Frais de gestion", "Taxes", "TOTAL payable comptant"];
    const rowHeaderH = 22;
    doc.rect(left, y, width, rowHeaderH).stroke();
    doc.fontSize(7).font("Helvetica-Bold");
    for (let i = 0; i < decompteHeaders.length; i++) {
      doc.rect(cx, y, decompteColW[i], rowHeaderH).stroke();
      doc.text(decompteHeaders[i], cx + 3, y + 5, { width: decompteColW[i] - 6, align: i === 0 ? "center" : "center" });
      cx += decompteColW[i];
    }
    y += rowHeaderH;
    const rowDataH = 16;
    cx = left;
    const decompteValeurs = [`du ${avenant.dateEffet}  au  ${dateFin}`, fmt(primeNette), fmt(montantAccessoires), "", fmt(montantTaxe), fmt(primeTotale)];
    doc.fontSize(8).font("Helvetica-Bold");
    for (let i = 0; i < decompteValeurs.length; i++) {
      doc.rect(cx, y, decompteColW[i], rowDataH).stroke();
      doc.text(decompteValeurs[i], cx + 3, y + 4, { width: decompteColW[i] - 6, align: i === 0 ? "left" : "right" });
      cx += decompteColW[i];
    }
    y += rowDataH;

    const noteH = 30;
    doc.rect(left, y, width * 0.65, noteH).stroke();
    doc.rect(left + width * 0.65, y, width * 0.35, noteH).stroke();
    doc.fontSize(7).font("Helvetica").text("Echéances : Principale | Secondaire\nMontant de la prime nette (frais et taxes en sus) à payer : Annuellement | Par échéance", left + 4, y + 4, { width: width * 0.65 - 8 });
    doc.text("Sont nulles toutes adjonctions ou modifications non revêtues du visa de la Direction ou de SON REPRESENTANT AUTORISE", left + width * 0.65 + 4, y + 4, { width: width * 0.35 - 8 });
    y += noteH + 20;

    doc.fontSize(9).font("Helvetica");
    for (const ligne of noteLegale(avenant.type as MouvementKind, { dateEffet: avenant.dateEffet, dateFin, jours })) {
      if (ligne === "") { y += 8; continue; }
      doc.text(ligne, left, y, { width });
      y += 13;
    }

    const footerY = doc.page.height - 90;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor("#ccc").stroke();
    doc.fontSize(9).font("Helvetica").text(`Fait à Libreville le ${dateTirets(now.toLocaleDateString("fr-FR"))} à ${heureVerbeuse(now)}`, left, footerY + 12);
    doc.text("en 4 exemplaires", right - 150, footerY + 12, { width: 150, align: "right" });
    doc.font("Helvetica-Bold").text("Le souscripteur", left, footerY + 30);
    doc.text(exemplaire, right - 150, footerY + 30, { width: 150, align: "right" });
    };

    const exemplairesAvenant = exemplairesA(exemplaireClientSeul);
    for (let i = 0; i < exemplairesAvenant.length; i++) {
      if (i > 0) doc.addPage();
      dessinerCorps(exemplairesAvenant[i]);
    }
    doc.end();
  }

  // ── Tableau de garanties ────────────────────────────────────────────────

  async renderTableauGaranties(contratId: string, format: string, res: Response, exemplaireClientSeul = false) {
    const contrat = await this.findContrat(contratId);
    if (format === "docx") return this.genererTableauGarantiesDocx(res, contrat);
    const numeroQuittance = await this.numeroQuittanceContrat(contrat);
    const now = new Date();
    const primeNette = Number(contrat.primeNette ?? contrat.prime);
    const montantAccessoires = Number(contrat.montantAccessoires ?? 0);
    const montantTaxe = Number(contrat.montantTaxe ?? Math.round((primeNette + montantAccessoires) * TAUX_TAXE_GABON));
    const primeTotale = Number(contrat.prime);
    const jours = daysBetween(contrat.dateDebut, contrat.dateFin);
    const p = await this.parametresEntreprise.findOne();

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Tableau-Garanties-${contrat.id}.pdf"`);
    doc.pipe(res);

    const dessinerCorps = (exemplaire: string) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    const drawHeader = (titreCentre: string) => {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#c0392b").text(contrat.compagnie.nom.toUpperCase(), left, 40);
      doc.fontSize(7).font("Helvetica").fillColor("#333");
      doc.text("Entreprise régie par le Code des Assurances CIMA", left, 58);
      doc.text(`Siège social : Libreville (${contrat.compagnie.pays})`, left, 68);

      doc.rect(left + 260, 40, width - 260, 16).fill("#5b7a9d");
      doc.fillColor("#fff").fontSize(10).font("Helvetica-Bold").text(`ASSURANCE ${contrat.branche.toUpperCase()}`, left + 260, 44, { width: width - 260, align: "center" });
      doc.fillColor(p.couleurPrimaire).fontSize(9).text(titreCentre, left + 260, 60, { width: width - 260, align: "center" });
      doc.fillColor("#000").fontSize(8).font("Helvetica");
      const infos = [
        `POLICE N°   ${contrat.id}`,
        `QUITTANCE N° ${numeroQuittance}`,
        `A EFFET DU : ${dateTirets(contrat.dateDebut)} A 0 HEURE`,
        `ECHEANCE AU  ${dateTirets(contrat.dateFin)} A MINUIT`,
      ];
      let iy = 74;
      for (const l of infos) { doc.text(l, left + 260, iy, { width: width - 260, align: "left" }); iy += 11; }
      return Math.max(iy + 8, 100);
    };

    const titreMouvement = contrat.typeAffaire?.toUpperCase() || "AFFAIRE NOUVELLE";
    let y = drawHeader(titreMouvement);

    const boxH = 90;
    doc.rect(left, y, width * 0.45, boxH).stroke();
    doc.rect(left + width * 0.45, y, width * 0.55, boxH).stroke();
    doc.fontSize(9).font("Helvetica-Bold").text("TERRITORIALITE", left + 6, y + 6);
    doc.font("Helvetica").text(territorialiteTexte(contrat), left + 6, y + 18, { width: width * 0.45 - 12 });
    doc.font("Helvetica-Bold").text("SOUSCRIPTEUR", left + 6, y + 40);
    doc.font("Helvetica").text(contrat.client.nom, left + 6, y + 52);
    doc.text(`BP :${contrat.client.boitePostale ?? "—"} ${contrat.client.ville ?? ""}`, left + 6, y + 64);
    doc.text(`TEL: ${contrat.client.tel ?? "—"}     Fax :`, left + 6, y + 76);

    const dx = left + width * 0.45 + 6;
    const dw = width * 0.55 - 12;
    doc.font("Helvetica-Bold").fontSize(8).text(`DECOMPTE (${contrat.id})`, dx, y + 6);
    const decCols = [dw * 0.4, dw * 0.3, dw * 0.3];
    const decHeaderY = y + 20;
    doc.fontSize(7);
    doc.text("", dx, decHeaderY);
    doc.text("Prime / Adhérent", dx + decCols[0], decHeaderY, { width: decCols[1], align: "right" });
    doc.text("Nbr", dx + decCols[0] + decCols[1], decHeaderY, { width: decCols[2] * 0.4, align: "right" });
    doc.text("Montant", dx + decCols[0] + decCols[1] + decCols[2] * 0.4, decHeaderY, { width: decCols[2] * 0.6, align: "right" });
    const decRows: [string, number | null, number, number][] = [
      ["Ass. Principaux /", contrat.primeUnitaireAssurePrincipal ? Number(contrat.primeUnitaireAssurePrincipal) : null, contrat.nombreAssuresPrincipaux ?? 0, (contrat.nombreAssuresPrincipaux ?? 0) * Number(contrat.primeUnitaireAssurePrincipal ?? 0)],
      ["Conjoints", contrat.primeUnitaireConjoint ? Number(contrat.primeUnitaireConjoint) : null, contrat.nombreConjoints ?? 0, (contrat.nombreConjoints ?? 0) * Number(contrat.primeUnitaireConjoint ?? 0)],
      ["Enfants", contrat.primeUnitaireEnfant ? Number(contrat.primeUnitaireEnfant) : null, contrat.nombreEnfants ?? 0, (contrat.nombreEnfants ?? 0) * Number(contrat.primeUnitaireEnfant ?? 0)],
      ["Couples", contrat.primeUnitaireCouple ? Number(contrat.primeUnitaireCouple) : null, contrat.nombreCouples ?? 0, (contrat.nombreCouples ?? 0) * Number(contrat.primeUnitaireCouple ?? 0)],
    ];
    let dry = decHeaderY + 12;
    doc.font("Helvetica");
    for (const [label, unitaire, nbr, montant] of decRows) {
      doc.text(label, dx, dry, { width: decCols[0] });
      doc.text(unitaire ? fmt(unitaire) : "-", dx + decCols[0], dry, { width: decCols[1], align: "right" });
      doc.text(nbr ? String(nbr) : "0", dx + decCols[0] + decCols[1], dry, { width: decCols[2] * 0.4, align: "right" });
      doc.text(montant ? fmt(montant) : "-", dx + decCols[0] + decCols[1] + decCols[2] * 0.4, dry, { width: decCols[2] * 0.6, align: "right" });
      dry += 11;
    }
    const totalPop = (contrat.nombreAssuresPrincipaux ?? 0) + (contrat.nombreConjoints ?? 0) + (contrat.nombreEnfants ?? 0) + (contrat.nombreCouples ?? 0);
    doc.font("Helvetica-Bold").text("Total Formule :", dx, dry, { width: decCols[0] });
    doc.text(String(totalPop), dx + decCols[0] + decCols[1], dry, { width: decCols[2] * 0.4, align: "right" });
    doc.text(fmt(primeNette), dx + decCols[0] + decCols[1] + decCols[2] * 0.4, dry, { width: decCols[2] * 0.6, align: "right" });

    y += boxH + 12;

    const prestCols = [width * 0.32, width * 0.18, width * 0.18, width * 0.32];
    const prestHeaders = ["Prestations", "Frais exposés", "Plafond annuel", "Observations"];
    const drawTableHeader = () => {
      doc.rect(left, y, width, 16).fill("#5b7a9d");
      let hx = left;
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      for (let i = 0; i < prestHeaders.length; i++) { doc.text(prestHeaders[i], hx + 4, y + 4, { width: prestCols[i] - 8 }); hx += prestCols[i]; }
      doc.fillColor("#000");
      y += 16;
    };
    drawTableHeader();

    doc.font("Helvetica").fontSize(8);
    const garanties = contrat.garanties.length > 0 ? contrat.garanties : [];
    if (garanties.length === 0) {
      doc.text("Aucune garantie renseignée sur ce contrat.", left + 4, y + 4);
      y += 16;
    }
    for (const g of garanties) {
      const fraisExpose = g.tauxAssure !== null ? `${g.tauxAssure}%\ndes frais réels` : "Selon garantie";
      const plafondTexte = g.plafond ?? "";
      const rowH = Math.max(
        28,
        doc.heightOfString(g.libelle, { width: prestCols[0] - 8 }),
        doc.heightOfString(fraisExpose, { width: prestCols[1] - 8 }),
        doc.heightOfString(plafondTexte, { width: prestCols[2] - 8 }),
      ) + 8;
      if (y + rowH > doc.page.height - 60) {
        doc.addPage();
        y = drawHeader(titreMouvement);
        drawTableHeader();
        doc.font("Helvetica").fontSize(8);
      }
      let cx = left;
      doc.text(g.libelle, cx + 4, y + 4, { width: prestCols[0] - 8 }); cx += prestCols[0];
      doc.text(fraisExpose, cx + 4, y + 4, { width: prestCols[1] - 8 }); cx += prestCols[1];
      doc.text(g.plafond ?? "", cx + 4, y + 4, { width: prestCols[2] - 8 }); cx += prestCols[2];
      doc.text("", cx + 4, y + 4, { width: prestCols[3] - 8 });
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#ccc").stroke();
      y += rowH;
    }

    doc.fontSize(8).font("Helvetica-Oblique").text("(Exclusion et délais de carence : Voir Conditions Générales)", left, y + 8);

    if (y > doc.page.height - 200) { doc.addPage(); y = drawHeader(titreMouvement); } else { y += 30; }

    doc.rect(left, y, width * 0.55, 16).fill("#5b7a9d");
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold").text("DECOMPTE DE LA PRIME", left, y + 4, { width: width * 0.55, align: "center" });
    doc.fillColor("#000");
    y += 16;
    const decompteFinal: [string, string, boolean][] = [
      ["DUREE", `${jours} Jour(s)`, true],
      ["PRIME NETTE", fmt(primeNette), true],
      ["ACCESSOIRES", fmt(montantAccessoires), true],
      [`TAXES ${(TAUX_TAXE_GABON * 100).toFixed(2)} %`, fmt(montantTaxe), true],
      ["PRIME TOTALE :", fmt(primeTotale), true],
    ];
    doc.rect(left, y, width * 0.55, decompteFinal.length * 15 + 6).stroke();
    let fy = y + 4;
    for (const [label, valeur] of decompteFinal) {
      champ(doc, left + 8, fy, label, valeur, (width * 0.55) - 100, 80, { boldLabel: true, boldValeur: true, alignValeur: "right" });
      fy += 15;
    }
    y += decompteFinal.length * 15 + 6 + 20;

    doc.fontSize(9).font("Helvetica").text(`Fait à Libreville le,  ${dateLettres(now)}`, left, y, { width, align: "center" });
    y += 20;
    doc.font("Helvetica-Bold").text("Le Souscripteur", left, y);
    doc.text(exemplaire, right - 150, y, { width: 150, align: "right" });
    };

    const exemplairesTableau = exemplairesA(exemplaireClientSeul);
    for (let i = 0; i < exemplairesTableau.length; i++) {
      if (i > 0) doc.addPage();
      dessinerCorps(exemplairesTableau[i]);
    }
    doc.end();
  }

  // ── Cartes d'assurance ────────────────────────────────────────────────
  // Format carte PVC standard CR80 (85,6 × 53,98 mm) compatible imprimantes
  // à badge type Evolis Primacy 1/2 — 1 assuré = 1 carte recto/verso, quel
  // que soit son âge (assuré principal, conjoint, enfant). Design inspiré
  // d'une carte d'assurance maladie de référence (bandeau couleur, zone
  // photo, QR, filigrane, encart réglementaire) adapté à l'identité MedAssur.

  private dessinerVagueBas(doc: PDFKit.PDFDocument, primaire: string, secondaire: string) {
    doc.save();
    doc.polygon([0, CARD_HEIGHT - 10], [CARD_WIDTH, CARD_HEIGHT - 16], [CARD_WIDTH, CARD_HEIGHT], [0, CARD_HEIGHT]).fill(primaire);
    doc.polygon([0, CARD_HEIGHT - 5], [CARD_WIDTH, CARD_HEIGHT - 10], [CARD_WIDTH, CARD_HEIGHT], [0, CARD_HEIGHT]).fill(secondaire);
    doc.restore();
  }

  // Chevron diagonal coin bas-droit (2026-09) — décoration du style
  // "la-ruche" (voir ModeleCarte.styleCode). Forme relevée PIXEL PAR PIXEL
  // sur le modèle RECTO réel fourni par l'utilisateur (voir demande : "les
  // bandes orange et bleu reproduisent exactement la même forme... même
  // coupe, même forme") : un triangle BLEU (primaire) dans le coin
  // bas-droit, et un ruban ORANGE (secondaire) qui part du bord droit,
  // descend en diagonale, PUIS se coude et court tout le long du bas de la
  // carte jusqu'au bord GAUCHE (pas un simple coin — la bande orange
  // occupe toute la largeur du bas de carte, sous le bandeau des taux).
  // ⚠️ Un premier relevé, qui excluait la zone de texte des taux en
  // limitant le balayage à x ≥ 74% de la largeur pour éviter les faux
  // positifs "orange"/"bleu" du texte lui-même, avait pris cette limite de
  // balayage pour un vrai coude du dessin — corrigé en balayant les lignes
  // sous le texte (donc non polluées) sur la largeur COMPLÈTE, ce qui
  // montre que la bande rejoint bien le bord gauche.
  // `hauteurDisponible` = distance (pt) entre le bas de la carte et le
  // point le plus haut où le dessin a le droit d'empiéter, mesurée depuis
  // l'appelant (sous le bandeau des taux) — les 4 points-clés sont ancrés
  // depuis le BAS de la carte, à l'échelle de cette hauteur plutôt qu'en
  // fractions fixes de `CARD_HEIGHT`, pour ne jamais chevaucher un bloc de
  // champs qui a grandi (nom sur 2 lignes, etc.).
  private dessinerChevronBas(doc: PDFKit.PDFDocument, hauteurDisponible: number) {
    // Géométrie ET couleurs RE-MESURÉES au pixel près sur le modèle RECTO
    // réel (8500×5400), par appariement de couleur EXACTE plutôt qu'une
    // plage approximative (voir demande utilisateur : "je veux que tu
    // mesures et calcules l'épaisseur et la disposition pour avoir
    // exactement le même rendu" + "il faut prendre exactement la même
    // couleur orange et la même couleur bleu que sur le modèle") :
    // - Bord haut du ruban orange : diagonale PARFAITEMENT rectiligne (r²
    //   vérifié par extrapolation, écart nul) du sommet (bord droit,
    //   46,96% de la hauteur) jusqu'au coude (74,68% de la largeur, 83,01%
    //   de la hauteur), PUIS chute verticale INSTANTANÉE (moins de 1px
    //   d'écart vertical mesuré) jusqu'au bord gauche — pas une 2e
    //   diagonale comme approximé précédemment.
    // - Bord bas du ruban orange / bord gauche du triangle bleu : autre
    //   diagonale rectiligne, du bord droit (70,93% de la hauteur)
    //   jusqu'au bord bas (80,53% de la largeur).
    // - Couleurs échantillonnées directement dans les bandes (loin des
    //   bords anticrénelés), constantes sur >10 points de mesure : orange
    //   #f37801, bleu #004a9f — sciemment PAS les couleurs paramétrables
    //   de la société (proches mais différentes : #f59105/#0672d0), cet
    //   habillage étant une reproduction fidèle d'un modèle réel fourni,
    //   pas un rendu générique.
    // `hauteurDisponible` met toujours le tout à l'échelle (k) depuis le
    // bas de la carte pour ne jamais chevaucher le bloc de champs
    // au-dessus (voir plus haut) — 81,16pt est la distance naturelle du
    // sommet au-dessus du bas, à l'échelle propre du modèle (153,01pt).
    const ORANGE = "#f37801", BLEU = "#004a9f";
    const k = Math.min(1, hauteurDisponible / 81.16);
    const depuisBas = (pt: number) => CARD_HEIGHT - pt * k;
    const ySommetOrange = depuisBas(81.16);  // pointe du ruban, bord droit
    const yCoude = depuisBas(26.00);         // coude, puis chute verticale
    const ySommetBleu = depuisBas(44.48);    // pointe du triangle bleu, bord droit
    doc.save();
    // Triangle bleu — coin bas-droit, sous le ruban orange.
    doc.polygon(
      [CARD_WIDTH, ySommetBleu], [CARD_WIDTH, CARD_HEIGHT], [CARD_WIDTH * 0.8053, CARD_HEIGHT],
    ).fill(BLEU);
    // Ruban orange — diagonale rectiligne puis chute verticale au bord gauche.
    doc.polygon(
      [CARD_WIDTH, ySommetOrange], [CARD_WIDTH * 0.7468, yCoude],
      [0, yCoude], [0, CARD_HEIGHT],
      [CARD_WIDTH * 0.8053, CARD_HEIGHT], [CARD_WIDTH, ySommetBleu],
    ).fill(ORANGE);
    doc.restore();
  }

  // Correctif du VERSO importé de LA RUCHE EXCELLENCE (2026-09) — voir
  // demande utilisateur : "le lien sera exactement celui de medassur et le
  // nom Medassur qui sera publié sur playstore et app store ainsi que le
  // logo de Medassur". Le verso fourni est utilisé tel quel comme fond
  // plein cadre (aucune donnée par personne à y superposer, voir plus
  // haut) — mais 2 de ses lignes portent le lien/logo/nom d'un AUTRE
  // éditeur (un concurrent), à remplacer par l'identité réelle de MedAssur. Zones
  // mesurées PIXEL PAR PIXEL sur l'image de référence (8500×5400) :
  // recouvertes d'un rectangle blanc puis redessinées par-dessus, plutôt
  // que de redemander un fichier corrigé à l'utilisateur (même principe
  // que le recto recodé plus haut).
  // Verso de LA RUCHE EXCELLENCE — lien/logo MedAssur FIXES (lignes 1-2)
  // et 3 blocs ÉDITABLES (intro, téléphone, explication QR), tous
  // dessinés PAR-DESSUS le fond importé (2026-09) — voir demande
  // utilisateur : "le lien sera exactement celui de medassur... le logo
  // de Medassur" + "il faudrait que l'application puisse générer ces
  // blocs de texte... éditables" + "il faut aussi rendre ce texte
  // éditable [explication QR]".
  //
  // ⚠️ Piège réel corrigé ici : les lignes 1-4 étaient auparavant réparties
  // sur DEUX méthodes séparées avec des coordonnées Y codées en dur —
  // décaler l'une (ex. le bandeau téléphone descendu pour "faire de la
  // place") a fait chevaucher/recouvrir la suivante (le logo MedAssur
  // partiellement repeint en blanc par le rectangle du téléphone, repéré
  // en relisant le rendu généré) sans qu'aucun calcul ne s'en aperçoive.
  // Fusionnées en UNE méthode avec un curseur Y séquentiel : chaque bloc
  // démarre après la fin RÉELLEMENT mesurée du précédent, jamais une
  // position absolue devinée — ne peut plus recouvrir le bloc au-dessus.
  private personnaliserVersoLaRuche(doc: PDFKit.PDFDocument, p: ParametresEntreprise) {
    try {
      if (p.carteVersoIntro) {
        // ⚠️ Rectangle blanc DYNAMIQUE, mesuré via `heightOfString` AVANT
        // de dessiner — un rectangle de taille fixe (calée sur le texte
        // d'ORIGINE, 3 lignes) laissait dépasser des fragments de l'ancien
        // texte importé dès que le nouveau texte saisi par l'admin était
        // plus long/large (police différente → plus de lignes).
        const largeur = CARD_WIDTH - 10;
        doc.fontSize(7.3).font("Helvetica-Bold");
        const hauteur = doc.heightOfString(p.carteVersoIntro, { width: largeur });
        doc.rect(3, 26, largeur + 4, hauteur + 6).fill("#ffffff");
        doc.fillColor("#1a1a1a").text(p.carteVersoIntro, 5, 28, { width: largeur });
      }

      // Rectangle blanc et contenu dessiné DÉCOUPLÉS — le lien/logo
      // IMPORTÉS à remplacer commencent à ≈41,25pt (mesuré pixel par
      // pixel), quasiment AU RAS des icônes d'origine (qui s'arrêtent à
      // ≈41,3-42,2pt selon la ligne). Un premier réglage (departRect=41)
      // couvrait bien l'ancien contenu mais restait TROP PRÈS du bord de
      // l'icône, la rognant visiblement d'un cheveu (voir retour
      // utilisateur : "les icônes sont coupées"). Reculé à 43 (au-delà
      // des DEUX bords mesurés) — laisse au pire ≈1,7pt de l'ancien texte
      // non recouvert, un simple liseré anticrénelé imperceptible sur
      // fond blanc, plutôt que de rogner l'icône elle-même. Le CONTENU
      // NEUF dessiné par-dessus démarre encore plus loin (departContenu=54)
      // pour une vraie clairière visuelle — voir demande utilisateur :
      // "déplace ce bloc vers la droite... les icônes sont coupées."
      const departRect = 43, departContenu = 54;

      // Ligne 1 (icône ordinateur déjà dans l'image, conservée) : lien.
      doc.rect(departRect, 61, CARD_WIDTH - departRect - 8, 14).fill("#ffffff");
      doc.fillColor("#1a1a1a").fontSize(8.2).font("Helvetica-Bold")
        .text("www.medassur.ga", departContenu, 65, { width: CARD_WIDTH - departContenu - 6, lineBreak: false });

      // Ligne 2 (icône téléphone déjà dans l'image, conservée) : logo +
      // nom de l'application MedAssur, à la place du logo/nom du concurrent d'origine.
      const y2 = 74;
      doc.rect(departRect, y2, CARD_WIDTH - departRect - 8, 22).fill("#ffffff");
      const logoMark = path.join(ASSETS_ROOT, "medassur-logo-mark.png");
      let decalageTexte = departContenu;
      let basLigne2 = y2 + 22;
      if (fs.existsSync(logoMark)) {
        doc.image(logoMark, departContenu, y2 + 1, { height: 20 });
        decalageTexte = departContenu + 24;
        basLigne2 = Math.max(basLigne2, y2 + 1 + 20);
      }
      doc.fillColor("#1a1a1a").fontSize(8.2).font("Helvetica-Bold")
        .text("MedAssur", decalageTexte, y2 + 7, { width: CARD_WIDTH - decalageTexte - 8, lineBreak: false });

      // Lignes 3-4 (éditables) — téléphone d'assistance puis explication du
      // QR Code. ⚠️ Piège réel corrigé ici : faire dépendre le rectangle
      // blanc de la ligne 4 du curseur dynamique (fin réelle de la ligne 3)
      // laissait un TROU au-dessus dès que la ligne 3 s'étalait sur 2
      // lignes (le curseur descend alors plus bas que la position FIXE de
      // l'ancienne ligne 4 dans l'image importée, ~113,7pt) — l'ancien
      // texte "Contact direct..." restait visible dans cet interstice
      // (repéré en relisant le rendu généré). Corrigé en effaçant D'ABORD,
      // EN UN SEUL rectangle, toute la zone dynamique connue (87 à 140pt —
      // couvre la position fixe des DEUX anciennes lignes, quel que soit
      // ensuite where le nouveau contenu retombe), puis en redessinant le
      // nouveau texte PAR-DESSUS avec le curseur habituel.
      // Le rectangle démarre à `basLigne2` (fin RÉELLE de la ligne 2, pas
      // une valeur fixe) — la ligne 2 a déjà son propre rectangle blanc
      // juste au-dessus (74 à basLigne2) ; partir plus haut ici
      // chevaucherait/effacerait l'icône MedAssur qu'on vient de dessiner.
      // ⚠️ Largeur calée sur le clip plus bas (CARD_WIDTH-8, le même bord
      // droit que `doc.rect(departRect, ..., CARD_WIDTH-departRect-8, ...)
      // .clip()`) — la caler séparément sur `departContenu` seul avait
      // laissé le texte déborder du clip d'environ 4pt, tronquant le
      // dernier caractère des lignes les plus longues (repéré en relisant
      // le rendu généré : "Numéro d'assistance" perdait sa parenthèse).
      const largeurTexte = CARD_WIDTH - 8 - departContenu;
      if (p.carteVersoTelephone || p.carteVersoQrExplication) {
        // ⚠️ Repéré en relisant CE rendu-ci : un rectangle pleine largeur
        // jusqu'à 140pt recouvrait le HAUT des logos Airtel/Moov Money
        // (qui commencent à 127,3pt, mesuré) — le logo Moov apparaissait
        // rogné/blanchi. Corrigé en 2 rectangles : pleine largeur jusqu'à
        // 127pt (avant les logos), puis largeur RÉDUITE (jusqu'à x=188,
        // avant leur colonne) pour la suite — efface bien l'ancien texte
        // sans jamais toucher les logos eux-mêmes.
        doc.rect(departRect, basLigne2, CARD_WIDTH - departRect - 8, 127 - basLigne2).fill("#ffffff");
        doc.rect(departRect, 127, 188 - departRect, 140 - 127).fill("#ffffff");
      }
      // ⚠️ Le partage dynamique de la hauteur restante entre les lignes 3
      // et 4 peut rester imprécis (texte saisi arbitrairement long) — un
      // CLIP garantit ici, par construction, qu'AUCUN pixel de texte ne
      // peut jamais apparaître sous y=127 (les logos de paiement), quelle
      // que soit l'imprécision du calcul de hauteur (repéré en relisant
      // ce rendu-ci : le texte de la ligne 4 débordait encore par-dessus
      // Airtel malgré le rétrécissement de police).
      const limiteBasse = 127;
      const budgetTotal = Math.max(limiteBasse - (basLigne2 + 3) - 2, 8);
      let curseurY = basLigne2 + 3;
      doc.save();
      doc.rect(departRect, basLigne2, CARD_WIDTH - departRect - 8, limiteBasse - basLigne2).clip();
      if (p.carteVersoTelephone) {
        const budget3 = p.carteVersoQrExplication ? budgetTotal * 0.42 : budgetTotal;
        doc.font("Helvetica-Bold");
        let taille = 8, hauteur = 0;
        for (;;) {
          doc.fontSize(taille);
          hauteur = doc.heightOfString(p.carteVersoTelephone, { width: largeurTexte });
          if (hauteur <= budget3 || taille <= 5.5) break;
          taille -= 0.5;
        }
        doc.fillColor("#1a1a1a").text(p.carteVersoTelephone, departContenu, curseurY, { width: largeurTexte });
        curseurY += hauteur + 3;
      } else {
        // Numéro d'origine effacé mais pas remplacé (seul le 4ᵉ champ a
        // été rempli) — avance quand même le curseur pour la ligne 4.
        curseurY += 14;
      }

      // Ligne 4 — même logique de rétrécissement, sur le budget restant.
      if (p.carteVersoQrExplication) {
        const budget4 = Math.max(limiteBasse - curseurY - 2, 6);
        doc.font("Helvetica");
        let taille = 7, hauteur = 0;
        for (;;) {
          doc.fontSize(taille);
          hauteur = doc.heightOfString(p.carteVersoQrExplication, { width: largeurTexte });
          if (hauteur <= budget4 || taille <= 5) break;
          taille -= 0.5;
        }
        doc.fillColor("#1a1a1a").text(p.carteVersoQrExplication, departContenu, curseurY, { width: largeurTexte });
      }
      doc.restore();
    } catch { /* jamais bloquant */ }
  }

  private dessinerFiligrane(doc: PDFKit.PDFDocument, primaire: string, nom: string) {
    doc.save();
    doc.fillOpacity(0.05);
    doc.fontSize(46).font("Helvetica-Bold").fillColor(primaire).text(nom, -20, 40, { width: CARD_WIDTH + 40, align: "center" });
    doc.restore();
    doc.fillOpacity(1);
  }

  // Tronque avec "…" au besoin — utilisé pour la raison sociale paramétrable
  // sur la carte, dont la longueur n'est pas connue à l'avance (contrairement
  // au "MedAssur" d'origine). doc.font()/.fontSize() doivent être positionnés
  // AVANT l'appel : la mesure se fait avec la police courante.
  private tronquer(doc: PDFKit.PDFDocument, texte: string, maxWidth: number): string {
    if (doc.widthOfString(texte) <= maxWidth) return texte;
    let t = texte;
    while (t.length > 1 && doc.widthOfString(`${t}…`) > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }

  // Vraie photo si elle a été uploadée (POST /sante/assures/:id/photo) et
  // que le fichier existe encore sur disque ; sinon, cadre + silhouette
  // générique en attendant — ne plante jamais si le fichier a disparu.
  private async dessinerPhoto(doc: PDFKit.PDFDocument, photo: string | null | undefined, x: number, y: number, w: number, h: number) {
    const brute = await this.chargerImage("photos", photo, UPLOADS_PHOTOS_DIR);
    const image = brute ? await this.redimensionnerPhoto(brute) : null;
    if (image) {
      doc.save();
      doc.roundedRect(x, y, w, h, 2).clip();
      // Le rognage "tête jamais coupée" se fait désormais dans
      // redimensionnerPhoto() (sharp, position: "top"), AVANT d'arriver
      // ici — l'image reçue a déjà exactement le ratio 300×360 = 5:6 de
      // la boîte (w×h ci-dessous), donc `cover`/`align` ne font plus
      // qu'une simple mise à l'échelle sans second rognage.
      doc.image(image, x, y, { width: w, height: h, cover: [w, h], align: "center" });
      doc.restore();
      doc.roundedRect(x, y, w, h, 2).lineWidth(0.7).strokeColor("#aab4c2").stroke();
      return;
    }
    this.dessinerZonePhoto(doc, x, y, w, h);
  }

  // Emplacement photo du bénéficiaire — utilisé comme repli par
  // dessinerPhoto() quand aucun fichier n'est disponible.
  private dessinerZonePhoto(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
    doc.save();
    doc.roundedRect(x, y, w, h, 2).fill("#eef1f6");
    doc.roundedRect(x, y, w, h, 2).lineWidth(0.7).strokeColor("#aab4c2").stroke();
    doc.fillColor("#c7cdd6");
    const cx = x + w / 2;
    const headR = w * 0.24;
    doc.circle(cx, y + h * 0.36, headR).fill("#c7cdd6");
    doc.moveTo(x + w * 0.12, y + h)
      .lineTo(x + w * 0.12, y + h * 0.82)
      .quadraticCurveTo(cx, y + h * 0.46, x + w * 0.88, y + h * 0.82)
      .lineTo(x + w * 0.88, y + h)
      .fill("#c7cdd6");
    doc.restore();
    doc.fillColor("#000");
  }

  // Icônes rondes (contact au verso) — traits simples, lisibles même à la
  // taille réduite d'une carte PVC imprimée.
  private dessinerIconeCercle(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, couleur: string) {
    doc.circle(cx, cy, r).lineWidth(0.6).strokeColor(couleur).stroke();
  }

  // Rendu fidèle des icônes Lucide (mêmes tracés SVG que lucide-react, viewBox
  // 24×24, traits arrondis) — mis à l'échelle et positionnés par transform
  // pdfkit plutôt que redessinés à la main, pour coller exactement au design.
  private dessinerIconeLucide(
    doc: PDFKit.PDFDocument, cx: number, cy: number, taille: number, couleur: string,
    elements: ({ d: string } | { rect: [number, number, number, number, number] } | { circle: [number, number, number] })[],
  ) {
    const s = taille / 24;
    doc.save();
    doc.translate(cx - taille / 2, cy - taille / 2).scale(s);
    doc.lineWidth(2).lineCap("round").lineJoin("round").strokeColor(couleur);
    for (const el of elements) {
      if ("d" in el) doc.path(el.d).stroke();
      else if ("rect" in el) doc.roundedRect(...el.rect).stroke();
      else doc.circle(...el.circle).stroke();
    }
    doc.restore();
  }

  // Logo réel de la société, en tête de document (2026-09) — voir demande
  // utilisateur : "c'est ce logo qui remonte sur les quittances, les
  // courriers, les prises en charge, les factures, les règlements, les
  // cartes." Ne dessine RIEN si aucun logo n'est configuré — le texte
  // nom/sous-titre déjà en place à côté reste la seule identité visuelle,
  // aucune régression pour une société qui n'a pas encore uploadé le sien.
  // `image` pré-résolue par l'appelant via chargerImage(logos-entreprises,
  // p.logo, ...) — voir ce helper (2026-09) : centralise le choix Supabase
  // Storage / disque local en un seul point par appel, plutôt que de
  // convertir cette petite fonction elle-même en async (appelée depuis 6
  // endroits différents du fichier).
  private dessinerLogoEntete(doc: PDFKit.PDFDocument, image: Buffer | string | null, x: number, y: number, taille = 28) {
    if (!image) return;
    try {
      doc.image(image, x, y, { fit: [taille, taille] });
    } catch {
      // Fichier corrompu/format non supporté par pdfkit — jamais bloquant
      // pour la génération du document.
    }
  }

  // Signature électronique enregistrée par l'utilisateur (2026-09) — voir
  // demande utilisateur : "cette dernière pourra s'ajouter systématiquement
  // dans tous les document où sa signature sera nécessaire". `x` = bord
  // DROIT du bloc (image + libellé alignés à droite, cohérent avec la
  // convention existante "Fait à ... / Le Gestionnaire ..." déjà en bas de
  // page). Aucune signature enregistrée → ligne de signature à blanc
  // (comportement historique inchangé, jamais bloquant).
  private dessinerSignature(doc: PDFKit.PDFDocument, image: Buffer | string | null, xDroit: number, y: number, libelle: string, largeur = 150) {
    const xGauche = xDroit - largeur;
    doc.font("Helvetica").fontSize(8).fillColor("#000");
    const hauteurLibelle = doc.heightOfString(libelle, { width: largeur, align: "right" });
    doc.text(libelle, xGauche, y, { width: largeur, align: "right" });
    const yImage = y + hauteurLibelle + 4;
    if (image) {
      try {
        doc.image(image, xGauche, yImage, { fit: TAILLE_SIGNATURE, align: "right" });
      } catch {
        // Fichier corrompu/format non supporté par pdfkit — jamais bloquant.
      }
    }
    doc.moveTo(xGauche, yImage + 44).lineTo(xDroit, yImage + 44).strokeColor("#999").stroke();
    doc.fillColor("#000");
  }

  // Cachet/signature du prestataire qui a délivré (2026-09) — voir demande
  // utilisateur : "il faut faire remonter le cachet et la signature de la
  // pharmacie... si le prestataire n'a pas encore chargé le fichier de la
  // signature cachet, c'est le nom de la pharmacie qui doit remonter ici".
  // Signature = celle du COMPTE connecté qui a traité le bon (même
  // infrastructure que la signature électronique par utilisateur, voir
  // chargerSignatureUtilisateur) ; à défaut, simple repli texte sur le nom
  // de la structure (jamais une case vide sans mention, jamais un nom
  // inventé pour une structure qui n'a pas encore de signature enregistrée).
  private async dessinerCachetPrestataire(doc: PDFKit.PDFDocument, x: number, y: number, largeur: number, utilisateurId: string | null, nomPrestataire: string) {
    // `height` explicite (2026-09) — cette zone est TOUJOURS collée au bas
    // de page (juste sous le libellé "Cachet et signature du Praticien",
    // lui-même déjà proche de la marge basse) : sans borne de hauteur,
    // pdfkit peut décider qu'un débordement (même minime) justifie une
    // toute NOUVELLE page pour ce seul bloc — `height` force au contraire
    // un simple rognage sur place, jamais une page 2 parasite.
    const signature = await this.chargerSignatureUtilisateur(utilisateurId);
    if (signature) {
      try { doc.image(signature, x, y, { fit: TAILLE_SIGNATURE }); return; } catch { /* jamais bloquant */ }
    }
    doc.font("Helvetica").fontSize(7.5).fillColor("#000").text(nomPrestataire, x, y, { width: largeur, align: "center", height: 11, ellipsis: true });
    doc.fillColor("#000");
  }

  // Signature électronique QR (2026-08, voir DocumentSignatureService) —
  // voir demande utilisateur : "une signature électronique unique (QR code)
  // pour chaque document créé ou édité dans l'application peu importe
  // depuis quel portail... une authentification infaillible de chaque
  // prestation faite". Enregistre une preuve immuable en base ET dessine le
  // QR sur le PDF (jamais l'inverse — un QR sans preuve vérifiable ne sert
  // à rien). Le QR encode une URL publique (`/verifier/:id`, voir
  // VerificationPubliqueController), scannable par n'importe quel appareil
  // photo, pas un format propriétaire illisible hors de l'application.
  // Jamais bloquant pour la génération du document : une erreur ici (ex.
  // base indisponible) est avalée, le PDF part quand même sans QR plutôt
  // que d'empêcher l'émission d'un document par ailleurs valide.
  private async dessinerSignatureElectronique(
    doc: PDFKit.PDFDocument, xGauche: number, y: number, documentType: string, documentRef: string,
    acteur: { id: string | null; nom: string; roleId: string },
  ) {
    try {
      // La légende texte ("Document authentifié…", référence en clair) a
      // été retirée (2026-09 — voir demande utilisateur : "ces informations
      // doivent être masquées dans le QR code") : la référence de preuve
      // reste entièrement encodée DANS le QR (voir DocumentSignatureService.
      // signer, URL /verifier/:id), jamais affichée en texte à côté sur le
      // document lui-même.
      const { qrBuffer } = await this.documentSignature.signer(documentType, documentRef, acteur);
      const taille = 42;
      doc.image(qrBuffer, xGauche, y, { width: taille, height: taille });
    } catch {
      // Jamais bloquant — voir commentaire ci-dessus.
    }
  }

  private async chargerSignatureUtilisateur(userId: string | null | undefined): Promise<Buffer | string | null> {
    if (!userId) return null;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { signature: true } });
    return this.chargerImage("signatures", u?.signature, UPLOADS_SIGNATURES_DIR);
  }

  private async chargerSignatureMedecin(medecinId: string | null | undefined): Promise<Buffer | string | null> {
    if (!medecinId) return null;
    const u = await this.prisma.user.findFirst({ where: { medecinId }, select: { signature: true } });
    return this.chargerImage("signatures", u?.signature, UPLOADS_SIGNATURES_DIR);
  }

  // Signature de l'assuré principal (2026-09) — voir demande utilisateur :
  // "il faut faire apparaître la fonctionnalité [signature] dans leur
  // compte... afin que cette dernière remonte sur leur document (feuille de
  // soins, feuille d'examen...)". Même principe que chargerSignatureMedecin
  // (le compte assuré_principal porte User.assureSanteId, voir
  // SELECT_SANS_HASH/AuthContext) — jamais celle d'un ayant droit délégué,
  // qui n'a pas de compte propre distinct dans le modèle actuel.
  private async chargerSignatureAssure(assureId: string | null | undefined): Promise<Buffer | string | null> {
    if (!assureId) return null;
    const u = await this.prisma.user.findFirst({ where: { assureSanteId: assureId }, select: { signature: true } });
    return this.chargerImage("signatures", u?.signature, UPLOADS_SIGNATURES_DIR);
  }

  private dessinerLogoMark(doc: PDFKit.PDFDocument, x: number, y: number, r: number, primaire: string) {
    doc.circle(x, y, r).fill(primaire);
    doc.fillColor("#fff");
    doc.save();
    doc.rect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 1.1).fill("#fff");
    doc.rect(x - r * 0.55, y - r * 0.12, r * 1.1, r * 0.24).fill("#fff");
    doc.restore();
  }

  private async ajouterCarteRectoVerso(doc: PDFKit.PDFDocument, assure: CarteAssureData, p: ParametresEntreprise) {
    const typeLabel = TYPE_ASSURE_LABELS[assure.typeAssure ?? ""] ?? assure.typeAssure ?? "—";
    const primaire = p.couleurPrimaire, secondaire = p.couleurSecondaire;

    // Modèle de carte importé (2026-09) — voir demande utilisateur : "on
    // peut importer les modèles et l'application place le modèle comme
    // choix pour chaque société." `modeleCarteId` absent ou "classique" (ou
    // fichier manquant) → comportement HISTORIQUE inchangé (décoration
    // générée). Un fond réel remplace UNIQUEMENT la décoration générée
    // (filigrane/rond logo/vague) — les champs dynamiques (photo, QR,
    // identité, taux) restent superposés aux mêmes positions qu'aujourd'hui.
    const modele = p.modeleCarteId ? await this.prisma.modeleCarte.findUnique({ where: { id: p.modeleCarteId } }) : null;
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const fondRecto = await this.chargerImage("modeles-carte", modele?.imageRecto, UPLOADS_MODELES_CARTE_DIR);
    const fondVerso = await this.chargerImage("modeles-carte", modele?.imageVerso, UPLOADS_MODELES_CARTE_DIR);
    // Style "la-ruche" (2026-09) — voir ModeleCarte.styleCode : recto
    // reconstruit EN CODE pour copier fidèlement le modèle fourni par LA
    // RUCHE EXCELLENCE. Voir demande utilisateur : "il faut les redesign
    // en copie conforme à l'original... même coupe, même forme." Calculé
    // ici (avant le QR) car sa couleur en dépend (noir en style la-ruche,
    // voir demande utilisateur : "fais remonter le QR code... et mets-le
    // en noir").
    const styleLaRuche = !fondRecto && modele?.styleCode === "la-ruche";
    const qrBuffer = await QRCode.toBuffer(assure.numeroAssure ?? assure.matricule, { margin: 0, width: 240, color: { dark: styleLaRuche ? "#000000" : primaire, light: "#ffffff" } });

    // ── Recto ──────────────────────────────────────────────────────────
    doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill("#ffffff");
    if (fondRecto) {
      try { doc.image(fondRecto, 0, 0, { width: CARD_WIDTH, height: CARD_HEIGHT }); } catch { /* image illisible — jamais bloquant */ }
    } else {
      this.dessinerFiligrane(doc, primaire, p.nom);
    }

    if (styleLaRuche && p.logo) {
      // Logo AFFICHÉ EN ENTIER, sans aucun recadrage (2026-09, décision
      // finale — voir demande utilisateur, après plusieurs allers-retours
      // sur la mention "Courtier d'Assurances" : "on doit voir le logo
      // avec TOUS ces détails, sinon ce n'est plus le logo" — l'utilisateur
      // a explicitement confirmé vouloir TOUT le fichier fourni tel quel,
      // mention comprise, annulant le recadrage demandé plus tôt. Fichier
      // fourni = 1390×570px (ratio 2,439) ; largeur calée pour que la
      // hauteur NATURELLE entière tienne sous le filet séparateur (y=32).
      if (logoImage) {
        try {
          const hauteurMax = 24; // sous le filet séparateur (y=32), marge de 6 à 6+24=30
          doc.image(logoImage, 6, 6, { height: hauteurMax });
        } catch { /* jamais bloquant */ }
      }
      doc.fillColor(primaire).fontSize(13).font("Helvetica-Bold").text("CARTE SANTÉ", 0, 10, { width: CARD_WIDTH - 8, align: "right" });
      doc.moveTo(10, 32).lineTo(CARD_WIDTH - 10, 32).strokeColor(primaire).lineWidth(1).stroke();
    } else {
      // Le vrai logo de la société prend la place du rond généré dès qu'il
      // existe — MÊME sur un modèle de carte importé (qui peut ne pas
      // intégrer lui-même de logo). Sans logo réel, le rond généré ne
      // s'affiche que si aucun fond n'a été importé (sinon il jurerait avec
      // un design déjà fourni par le modèle).
      if (p.logo) {
        this.dessinerLogoEntete(doc, logoImage, 6, 6, 16);
      } else if (!fondRecto) {
        this.dessinerLogoMark(doc, 14, 14, 8, primaire);
      }
      // En-tête générée (nom/sous-titre/titre/séparateur) — SEULEMENT sans
      // fond importé : un modèle importé porte déjà sa PROPRE identité
      // visuelle complète (logo, titre...) — la redessiner par-dessus
      // doublonnerait le nom de la société et le titre de la carte.
      if (!fondRecto) {
        // Largeur dispo pour la raison sociale = jusqu'au début du titre à
        // droite (mesuré, pas deviné) — reste correct quel que soit le nom
        // configuré, du plus court ("MedAssur") au plus long.
        const titreLigne1 = "CARTE D'ASSURANCE SANTÉ", titreLigne2 = "Assuré · Conjoint · Enfant";
        doc.fontSize(9).font("Helvetica-Bold");
        const titre1X = CARD_WIDTH - 8 - doc.widthOfString(titreLigne1);
        doc.fontSize(5.5).font("Helvetica-Bold");
        const titre2X = CARD_WIDTH - 8 - doc.widthOfString(titreLigne2);
        const nameMaxW = Math.min(titre1X, titre2X) - 26 - 6;

        doc.fontSize(10).font("Helvetica-Bold");
        doc.fillColor(primaire).text(this.tronquer(doc, p.nom, nameMaxW), 26, 8, { lineBreak: false });
        doc.fontSize(4.8).font("Helvetica");
        doc.fillColor("#555").text(this.tronquer(doc, p.sousTitre, nameMaxW), 26, 18, { lineBreak: false });

        doc.fillColor(primaire).fontSize(9).font("Helvetica-Bold").text(titreLigne1, 0, 8, { width: CARD_WIDTH - 8, align: "right" });
        doc.fillColor(secondaire).fontSize(5.5).font("Helvetica-Bold").text(titreLigne2, 0, 19, { width: CARD_WIDTH - 8, align: "right" });

        doc.moveTo(10, 30).lineTo(CARD_WIDTH - 10, 30).strokeColor("#e2e2e2").lineWidth(0.5).stroke();
      }
    }

    // Zone photo + liste de champs + QR — dimensions et positions mesurées
    // au pixel près sur le modèle de référence fourni (926×584, échelle
    // 0.262 pt/px) plutôt qu'estimées à l'œil. Décalée de 3pt vers le bas
    // en style la-ruche (2026-09, voir demande utilisateur : "décale
    // légèrement vers le bas pour qu'on voie bien les infos de l'assuré
    // principal" — trop proche du filet séparateur) ; le dessin générique
    // garde sa position d'origine, non concerné par ce signalement.
    const photoX = 15, photoW = 50, photoH = 60, photoY = styleLaRuche ? 37 : 34;
    await this.dessinerPhoto(doc, assure.photo, photoX, photoY, photoW, photoH);

    // QR code — en bas à droite (sous MATRICULE/SOCIÉTÉ, au-dessus de la
    // vague) sur le dessin générique ; remonté au niveau de la photo en
    // style la-ruche (voir demande utilisateur : "fais remonter le QR
    // code pour le rendre visible et lisible" — sur le modèle fourni, le
    // QR est en haut, largement au-dessus du chevron bas-droit, jamais
    // chevauché par lui). Décalé de 2 lignes sous la photo (2026-09, voir
    // demande utilisateur : "faire légèrement descendre de deux lignes").
    // Marge droite élargie à 20 (au lieu de 7) — voir demande utilisateur :
    // "il ne faut pas couper le QR code, il faut le déplacer vers la
    // gauche" : le ruban à pleine taille (voir plus bas) touchait son coin
    // bas-droit. Ramenée à 14 (2026-09, voir demande utilisateur suivante :
    // "déplace légèrement vers la droite") — revérifié en direct (rendu +
    // lecture du PDF) qu'une vraie clairière reste dégagée du ruban.
    // Marge/position revues (2026-09) — le rapprochement précédent (marge
    // 20→14, suite à "déplace légèrement vers la droite") faisait
    // RÉELLEMENT chevaucher le ruban (retour utilisateur : "le QR code se
    // coupe") — vérifié cette fois par calcul PUIS par balayage de pixels
    // sur le rendu généré (pas seulement à l'œil, qui avait laissé passer
    // le chevauchement précédent) : marge 18 + décalage vertical réduit
    // (+4 au lieu de +7) dégagent une vraie clairière (~2pt) du bord du
    // ruban à pleine taille.
    const qrTaille = 45, qrX = CARD_WIDTH - 18 - qrTaille, qrY = styleLaRuche ? photoY + 4 : 132 - qrTaille;

    // Nom de l'ASSURÉ PRINCIPAL en 1ʳᵉ ligne — sur TOUTES les cartes, y
    // compris celle de l'assuré principal lui-même (2026-09, voir demande
    // utilisateur : "c'est le nom de l'assuré principal qui revient en
    // premier sur les cartes de ses ayants droit... il faut plutôt ramener
    // le nom de l'assuré principal... cela permet de savoir qui est
    // l'assuré principal d'un ayant [droit] sans qu'on ait besoin
    // d'accéder au système"). `familleId` NULL = cette ligne EST déjà la
    // racine (voir schema.prisma AssureSante.familleId) ; sinon `famille`
    // porte le nom du parent racine. L'identité PROPRE de la carte
    // (Conjoint/Enfant + son propre nom) reste affichée juste en dessous
    // via les champs NOM/PRÉNOM — aucune perte d'information.
    const nomAssurePrincipal = assure.familleId && assure.famille
      ? `${assure.famille.nom ?? ""} ${assure.famille.prenom ?? ""}`.trim()
      : `${assure.nom} ${assure.prenom ?? ""}`.trim();
    const champsX = photoX + photoW + 6;
    // Largeur de la colonne de champs CALÉE SUR L'ANCIENNE position du QR
    // (marge 20, pas la nouvelle) — piège réel rencontré : la faire
    // dépendre du nouveau `qrX` (décalé à gauche) rétrécissait la colonne,
    // ce qui faisait déborder PRÉNOM sur 2 lignes, poussait tout le bloc
    // plus bas, et faisait recouvrir "FRAIS MÉDICAUX" par le ruban plein
    // largeur en dessous (texte peint PAR-DESSUS, donc invisible). Le
    // texte accepte un petit espace vide avant le QR plutôt que de
    // rétrécir en cascade.
    const champsW = (CARD_WIDTH - 7 - qrTaille) - champsX - 8;
    const lignesRecto = [
      `Assuré Principal : ${nomAssurePrincipal}`,
      `NOM : ${assure.nom}`,
      `PRÉNOM : ${assure.prenom ?? "—"}`,
      `NÉ(E) LE : ${assure.dateNaissance ?? "—"}`,
      `MATRICULE : ${assure.matricule}`,
      `SOCIÉTÉ : ${assure.contrat.client.nom}`,
    ];
    // Bande des taux FIGÉE (2026-09) — voir demande utilisateur : "il faut
    // que la ligne des taux ambulatoire et hospitalisation puisse être
    // figée peu importe les mouvements des blocs plus haut" (un nom long
    // sur 2 lignes poussait auparavant tout le bas de carte, TEL et taux
    // compris, à une position différente d'une carte à l'autre). `basBloc`
    // est maintenant une CONSTANTE (bas de la photo) — plus jamais
    // recalculée depuis la hauteur réelle du bloc de champs. Pour que ce
    // bloc de champs tienne quand même dans l'espace fixe qui lui reste
    // (`photoY` → `basBloc`), sa taille de police s'ajuste automatiquement
    // vers le bas si nécessaire (voir demande utilisateur : "soit on
    // diminue légèrement la police") — jamais de troncature du texte
    // (retour utilisateur passé : "tu es en train de gaspiller le rendu
    // de la carte" sur un essai qui coupait le nom avec "…").
    const basBloc = photoY + photoH;
    const budgetHauteurChamps = basBloc - photoY - 1;
    let tailleTexteChamps = 6.6;
    let ly = photoY;
    let hauteursLignes: number[] = [];
    for (; tailleTexteChamps >= 5.2; tailleTexteChamps -= 0.3) {
      doc.fontSize(tailleTexteChamps);
      let total = 0;
      hauteursLignes = lignesRecto.map((ligne, i) => {
        const h = doc.heightOfString(ligne, { width: champsW });
        total += h + (i === 0 ? 4.5 : 1.5);
        return h;
      });
      if (total <= budgetHauteurChamps) break;
    }
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(tailleTexteChamps);
    lignesRecto.forEach((ligne, i) => {
      doc.text(ligne, champsX, ly, { width: champsW });
      ly += hauteursLignes[i] + (i === 0 ? 4.5 : 1.5);
    });

    doc.image(qrBuffer, qrX, qrY, { width: qrTaille, height: qrTaille });

    const telephoneAffiche = assure.familleId ? assure.famille?.telephone : assure.telephone;

    // Bandeau taux — mêmes valeurs que le "Résumé global" paramétré dans
    // l'onglet Garanties du contrat (tauxCouvertureAmbulatoire/
    // tauxCouvertureHospitalisation), déjà utilisés sur la Quittance ;
    // libellés "FRAIS MÉDICAUX/HOSPITALISATION" en style la-ruche (copie
    // conforme du modèle fourni), "Ambulatoires/Hospitalisations" sinon.
    const bandeauY = basBloc + 18;
    doc.fontSize(7).font("Helvetica-Bold");
    // Style la-ruche : texte ET taux en noir (voir demande utilisateur :
    // "le texte et les taux frais médicaux et hospitalisation en noir"),
    // jamais primaire/secondaire — seul le dessin générique garde les
    // couleurs de la société.
    const couleurLabelTaux = styleLaRuche ? "#000000" : primaire;
    const couleurValeurTaux = styleLaRuche ? "#000000" : secondaire;
    const labelAmbulatoire = styleLaRuche ? "FRAIS MÉDICAUX : " : "Ambulatoires : ";
    const valeurAmbulatoire = tauxCourt(assure.contrat.tauxCouvertureAmbulatoire);
    const labelHospitalisation = styleLaRuche ? "   -   HOSPITALISATION : " : "   -   Hospitalisations : ";
    const valeurHospitalisation = tauxCourt(assure.contrat.tauxCouvertureHospitalisation);
    // Position de départ calculée sur la largeur RÉELLE de la ligne entière
    // (2026-09 — voir capture utilisateur : "HOSPITALISATION : 100%" coupé
    // à droite, x=10 fixe ne tenait pas compte de la longueur variable du
    // texte/des taux) — décale vers la gauche autant que nécessaire pour
    // que la ligne tienne dans la carte, jamais plus (repli sur 10 si la
    // ligne est déjà assez courte pour y tenir).
    const largeurLigneTaux = doc.widthOfString(labelAmbulatoire + valeurAmbulatoire + labelHospitalisation + valeurHospitalisation);
    const margeDroiteTaux = 8;
    const xTaux = Math.min(10, CARD_WIDTH - margeDroiteTaux - largeurLigneTaux);

    // TEL aligné sur LE MÊME bord gauche que la ligne des taux juste en
    // dessous (2026-09, voir demande utilisateur : "il faut... décaler
    // vers la gauche y compris TEL pour que tout soit aligné") — les deux
    // lignes partagent désormais `xTaux`, jamais deux positions distinctes.
    doc.fillColor(styleLaRuche ? "#000000" : primaire).fontSize(5.3).font("Helvetica-Bold").text("TEL :", xTaux, bandeauY - 9, { continued: true });
    doc.fillColor("#000").text(` ${telephoneAffiche || "—"}`);
    doc.fontSize(7).font("Helvetica-Bold");

    // Décor (ruban/vague) dessiné AVANT le texte des taux, PAS après
    // (2026-09 — voir capture utilisateur : "toujours pas corrigé",
    // "HOSPITALISATION : 100%" encore visiblement coupé/recouvert en
    // production malgré le calcul "garanti" précédent). Root cause
    // vérifiée par reproduction géométrique directe (repro_carte.js,
    // hors application) : le bord DIAGONAL du ruban (pas seulement son
    // seuil plein-largeur `yCoude`) passe déjà sous le texte des taux
    // bien avant `yCoude` — à bandeauY≈122, le bord diagonal se trouve à
    // x≈187, alors que le texte "FRAIS MÉDICAUX : 80% - HOSPITALISATION :
    // 100%" s'étend jusqu'à x≈190 : les derniers caractères tombent DANS
    // la zone orange, et le bas de la ligne de texte tombe carrément
    // sous `yCoude` (recouvert en pleine largeur). Un seuil géométrique
    // fiable existe (exiger que le ruban entier reste sous le texte),
    // mais il obligerait à rétrécir le ruban à ~20% de sa taille — annule
    // le rendu voulu ("les bandes avaient déjà la bonne taille"). Fix
    // robuste retenu : ordre d'empilement plutôt que géométrie — le
    // texte est TOUJOURS peint en dernier, par-dessus le ruban, donc
    // TOUJOURS visible quelle que soit la longueur des taux affichés,
    // sans dépendre d'un calcul de marge fragile.
    if (styleLaRuche) {
      const margeTexte = 5;
      const kVoulu = Math.min(1, (CARD_HEIGHT - bandeauY - margeTexte) / 26);
      const hauteurDisponible = Math.max(0, kVoulu) * 81.16;
      this.dessinerChevronBas(doc, hauteurDisponible);
    } else if (!fondRecto) {
      this.dessinerVagueBas(doc, primaire, secondaire);
    }

    // lineBreak: false — sans ça, pdfkit calcule sa PROPRE largeur
    // disponible par défaut (page - x) sur chaque segment "continued" et
    // peut renvoyer "HOSPITALISATION : 100%" à la ligne plutôt que de le
    // laisser déborder. Force UNE seule ligne, quoi qu'il arrive.
    doc.fillColor(couleurLabelTaux).text(labelAmbulatoire, xTaux, bandeauY, { continued: true, lineBreak: false });
    doc.fillColor(couleurValeurTaux).text(valeurAmbulatoire, { continued: true, lineBreak: false });
    doc.fillColor(couleurLabelTaux).text(labelHospitalisation, { continued: true, lineBreak: false });
    doc.fillColor(couleurValeurTaux).text(valeurHospitalisation, { lineBreak: false });

    // ── Verso ──────────────────────────────────────────────────────────
    doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 });
    doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill("#ffffff");
    if (fondVerso) {
      try { doc.image(fondVerso, 0, 0, { width: CARD_WIDTH, height: CARD_HEIGHT }); } catch { /* image illisible — jamais bloquant */ }
      // Les 3 blocs éditables (intro/téléphone/QR) sont superposés selon
      // les coordonnées mesurées sur LE VERSO DE LA RUCHE EXCELLENCE
      // spécifiquement (seul modèle de carte importé avec verso à ce
      // jour) — voir `personnaliserVersoLaRuche`. Si un jour un AUTRE
      // modèle de carte importé (verso différent) doit aussi porter du
      // texte éditable, cette méthode devra être généralisée (coordonnées
      // par `ModeleCarte` plutôt que codées en dur) plutôt que réutilisée
      // telle quelle.
      if (styleLaRuche) this.personnaliserVersoLaRuche(doc, p);
    } else {
      this.dessinerFiligrane(doc, primaire, p.nom);
    }

    // Contenu généré du verso — SEULEMENT sans fond importé (2026-09) :
    // dans le cas de LA RUCHE EXCELLENCE (voir demande utilisateur), le
    // verso réel fourni est déjà complet (bandeau, paragraphe, moyens de
    // contact, logos de paiement mobile) — aucune donnée dynamique par
    // personne n'y figure (contrairement au recto), donc rien à superposer.
    if (!fondVerso) {
      doc.rect(0, 0, CARD_WIDTH, 15).fill(primaire);
      doc.fillColor("#fff").fontSize(5.2).font("Helvetica-Bold").text(
        "Carte personnelle, confidentielle et incessible. À présenter à chaque prestation.",
        8, 4.5, { width: CARD_WIDTH - 16 },
      );

      // Tout le contenu qui suit est positionné dynamiquement (heightOfString
      // à chaque étape) pour occuper pleinement l'espace disponible jusqu'à la
      // vague de bas de carte, quels que soient les textes réellement injectés
      // (nom de compagnie, souscripteur, site web… de longueur variable).
      const largeurTexte = CARD_WIDTH - 20;
      const limiteBasse = 134; // au-delà, on empiète sur la vague de bas de carte
      let vy = 20;
      doc.fillColor(primaire).fontSize(6).font("Helvetica-Bold");
      const lignePolice = `POLICE N° ${assure.contrat.id}   ·   COMPAGNIE ${assure.contrat.compagnie.nom}`;
      doc.text(lignePolice, 10, vy, { width: largeurTexte });
      vy += doc.heightOfString(lignePolice, { width: largeurTexte }) + 3;
      const ligneSouscripteur = `SOUSCRIPTEUR ${assure.contrat.client.nom}`;
      doc.text(ligneSouscripteur, 10, vy, { width: largeurTexte });
      vy += doc.heightOfString(ligneSouscripteur, { width: largeurTexte }) + 8;

      // Paragraphe + liste de contacts — reprend la disposition du modèle de
      // référence (icône ronde + texte, une ligne par moyen de contact).
      doc.fillColor("#222").fontSize(6.2).font("Helvetica");
      const paragraphe = `Cette carte est strictement personnelle et vous permet de vous identifier auprès du réseau agréé ${p.nom} par les moyens suivants :`;
      const paraH = doc.heightOfString(paragraphe, { width: largeurTexte });
      doc.text(paragraphe, 10, vy, { width: largeurTexte });
      vy += paraH + 9;

      const iconX = 16, iconR = 8, glyphS = 9, texteX = 28, texteW = CARD_WIDTH - texteX - 8;

      doc.fontSize(6.6).font("Helvetica-Bold");
      const hSite = doc.heightOfString(p.siteWeb, { width: texteW });
      this.dessinerIconeCercle(doc, iconX, vy + Math.max(hSite, iconR * 2) / 2, iconR, primaire);
      this.dessinerIconeLucide(doc, iconX, vy + Math.max(hSite, iconR * 2) / 2, glyphS, primaire, ICONE_GLOBE);
      doc.fillColor("#000").text(p.siteWeb, texteX, vy + Math.max(0, (iconR * 2 - hSite) / 2), { width: texteW });
      vy += Math.max(hSite, iconR * 2) + 8;

      const texteTel = `${p.telephone} (Numéro d'assistance)`;
      doc.fontSize(6.6).font("Helvetica-Bold");
      const hTel = doc.heightOfString(texteTel, { width: texteW });
      this.dessinerIconeCercle(doc, iconX, vy + Math.max(hTel, iconR * 2) / 2, iconR, primaire);
      this.dessinerIconeLucide(doc, iconX, vy + Math.max(hTel, iconR * 2) / 2, glyphS, primaire, ICONE_TELEPHONE);
      doc.fillColor("#000").text(texteTel, texteX, vy + Math.max(0, (iconR * 2 - hTel) / 2), { width: texteW });
      vy += Math.max(hTel, iconR * 2) + 8;

      // Dernière ligne bornée par l'espace réellement restant (troncature "…"
      // si nécessaire) — garantit qu'elle n'empiète jamais sur la vague, quelle
      // que soit la hauteur déjà consommée au-dessus par des textes plus longs.
      const texteQr = "Contact direct du professionnel de santé agréé de votre choix, qui scanne le QR Code et demande une prise en charge pour vos soins.";
      doc.fontSize(6).font("Helvetica");
      const hQrNaturel = doc.heightOfString(texteQr, { width: texteW });
      const hQr = Math.min(hQrNaturel, Math.max(iconR * 2, limiteBasse - vy));
      this.dessinerIconeCercle(doc, iconX, vy + Math.max(hQr, iconR * 2) / 2, iconR, primaire);
      this.dessinerIconeLucide(doc, iconX, vy + Math.max(hQr, iconR * 2) / 2, glyphS, primaire, ICONE_QRCODE);
      doc.fillColor("#333").text(texteQr, texteX, vy + Math.max(0, (iconR * 2 - hQr) / 2), { width: texteW, height: hQr, ellipsis: true });

      this.dessinerVagueBas(doc, primaire, secondaire);
    }
  }

  async renderCarteUnique(assureId: string, res: Response) {
    const assure = await this.prisma.assureSante.findUnique({
      where: { id: assureId },
      include: { contrat: { include: { client: true, compagnie: true } }, famille: { select: { telephone: true, nom: true, prenom: true } } },
    });
    if (!assure) throw new NotFoundException(`Assuré ${assureId} introuvable`);
    const p = await this.parametresEntreprise.findOne();

    const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0, autoFirstPage: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Carte-${assure.matricule}.pdf"`);
    doc.pipe(res);
    await this.ajouterCarteRectoVerso(doc, assure, p);
    doc.end();
  }

  // Génération en masse (contrat entier ou liste explicite d'ids — famille/
  // sélection). Un seul PDFDocument streamé directement vers la réponse
  // HTTP (doc.pipe(res)) : les pages sont écrites au fil de l'eau, jamais
  // bufferisées entièrement en mémoire. Le fichier doit toujours sortir
  // rangé par famille (assuré principal, puis conjoint(e), puis enfants du
  // plus âgé au plus jeune) pour faciliter le classement physique et la
  // distribution — quel que soit le mode de génération. On calcule donc
  // d'abord l'ordre complet à partir de champs légers seuls (id/famille/
  // type/naissance, quelques dizaines d'octets par assuré — négligeable même
  // à 20 000+ personnes), puis on rehydrate les données complètes par lots
  // de 500 dans cet ordre, sans jamais charger toutes les cartes en mémoire.
  async renderCartesEnMasse(dto: { contratId?: string; assureIds?: string[] }, res: Response) {
    if (!dto.contratId && (!dto.assureIds || dto.assureIds.length === 0)) {
      throw new BadRequestException("Précisez un contratId ou une liste d'assureIds.");
    }
    const p = await this.parametresEntreprise.findOne();

    const where: Prisma.AssureSanteWhereInput = dto.assureIds && dto.assureIds.length > 0
      ? { id: { in: dto.assureIds } }
      : { contratId: dto.contratId, statut: { not: "Radié" } };

    const legers = await this.prisma.assureSante.findMany({
      where,
      select: { id: true, familleId: true, typeAssure: true, dateNaissance: true },
    });
    const idsOrdonnes = ordonnerParFamille(legers);

    const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0, autoFirstPage: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="Cartes-Assurance.pdf"');
    doc.pipe(res);

    let nombreCartes = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < idsOrdonnes.length; i += BATCH_SIZE) {
      const lotIds = idsOrdonnes.slice(i, i + BATCH_SIZE);
      const lot = await this.prisma.assureSante.findMany({
        where: { id: { in: lotIds } },
        include: { contrat: { include: { client: true, compagnie: true } }, famille: { select: { telephone: true, nom: true, prenom: true } } },
      });
      const parId = new Map(lot.map((a) => [a.id, a]));
      for (const id of lotIds) {
        const a = parId.get(id);
        if (!a) continue;
        await this.ajouterCarteRectoVerso(doc, a, p);
        nombreCartes++;
      }
    }

    if (nombreCartes === 0) throw new BadRequestException("Aucun assuré actif trouvé pour cette sélection.");
    doc.end();
  }

  // ── Feuille de Soins / Feuille d'Examen ─────────────────────────────────
  // Modèle papier LA RUCHE EXCELLENCE (2026-09) — voir demande utilisateur :
  // "ramener les modèles qu'on avait déjà fixés... appliquer le modèle de
  // feuille de soins et examen avec les informations de la ruche (n'oublie
  // pas que c'était des modèles de la ruche qu'on avait utilisé pour les
  // modéliser) y compris le vrai logo". Reproduit les zones du formulaire
  // pré-imprimé carbone de référence ("Feuille de Soins.pdf"/"Feuille
  // d'Examen.pdf") : identité souscripteur/assuré, conditions de prise en
  // charge, praticien, prestations/examens, totaux — jamais de case cochée
  // ni de valeur affichée pour une donnée qui n'existe pas réellement en
  // base (ex. "Visite à domicile" : aucun champ correspondant n'existe,
  // la case reste donc toujours décochée plutôt que d'inventer une réponse).
  // `prestataireFiltre` (2026-09) — voir demande utilisateur : "il faut
  // faire remonter le cachet et la signature de la pharmacie... si le
  // prestataire n'a pas encore chargé le fichier de la signature cachet,
  // c'est le nom de la pharmacie qui doit remonter". Fourni uniquement par
  // PortailPrestataireController (voir renderFeuilleSoinsLigne/
  // renderFeuilleExamenPrescription ci-dessus) — jamais pour le médecin ou
  // l'assuré, qui n'ont personnellement rien "délivré" à faire tamponner.
  private async genererFormulaire(
    kind: "soins" | "examen", numero: string, pec: FormulairePec, lignes: LigneFormulaire[], res: Response,
    documentRef?: string, utilisateur?: { id: string | null; nom: string; roleId: string; masquerPrixPharmacie?: boolean },
    prestataireFiltre?: { id: string; nom: string },
  ) {
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const medecin = pec.prescriptionOrigine?.medecin ?? null;
    const assure = pec.assure;
    const estAyantDroit = assure.familleId !== null;
    const nomPrincipal = estAyantDroit && assure.famille ? `${assure.famille.nom} ${assure.famille.prenom ?? ""}`.trim() : `${assure.nom} ${assure.prenom ?? ""}`.trim();
    const contrat = assure.contrat;
    const secteurPublic = pec.prestataireRef?.secteur === "Public";
    const tauxAmbulatoire = (estAyantDroit
      ? (secteurPublic ? contrat.tauxAmbulatoirePubliqueAyantDroit : contrat.tauxAmbulatoirePriveeAyantDroit)
      : (secteurPublic ? contrat.tauxAmbulatoirePublique : contrat.tauxAmbulatoirePrivee)) ?? contrat.tauxCouvertureAmbulatoire ?? null;
    const tauxHospitalisation = (estAyantDroit
      ? (secteurPublic ? contrat.tauxHospitalisationPubliqueAyantDroit : contrat.tauxHospitalisationPriveeAyantDroit)
      : (secteurPublic ? contrat.tauxHospitalisationPublique : contrat.tauxHospitalisationPrivee)) ?? contrat.tauxCouvertureHospitalisation ?? null;
    const lignePrincipale = lignes[0] as LigneFormulaire | undefined;
    const ticketModerateurPct = lignePrincipale?.tauxRemboursement !== null && lignePrincipale?.tauxRemboursement !== undefined
      ? String(Math.round(100 - lignePrincipale.tauxRemboursement)) : null;
    const codePraticien = medecin?.codePraticien || (medecin ? refNumerique(medecin.id) : null);
    const codeEtablissement = pec.prestataireRef ? refNumerique(pec.prestataireRef.id) : null;
    const codeAffection = lignePrincipale?.codeAffection ?? null;
    const estSpecialiste = !!medecin?.specialite;
    const heure = lignePrincipale?.createdAt ?? pec.createdAt;
    const estTarifJour = heure.getHours() >= 6 && heure.getHours() < 20;
    const heureTexte = `${String(heure.getHours()).padStart(2, "0")}:${String(heure.getMinutes()).padStart(2, "0")}`;
    const nomMedecin = medecin ? `${medecin.titre ?? "Dr"} ${medecin.nom} ${medecin.prenom ?? ""}`.trim() : "—";
    // Zone "CONDITION DE PRISE EN CHARGE" / bas de page : toujours le
    // COURTIER (ou mutuelle) qui gère réellement le dossier, JAMAIS la
    // compagnie d'assurance porteuse du risque — voir demande utilisateur
    // (2026-09) : "il faut faire remonter le logo et le vrai nom de la
    // société qui assure et gère les dossiers, et non la compagnie
    // d'assurance si le client est un courtier". Un repli antérieur
    // substituait `contrat.compagnie.nom` quand la société n'était pas
    // personnalisée ("MedAssur" par défaut) — corrigé : ce repli mélangeait
    // deux entités différentes (courtier vs assureur porteur du risque) et
    // affichait la mauvaise info dès qu'une société réelle (ex. LA RUCHE
    // EXCELLENCE) n'était PAS le tenant courant de la requête. `p` est déjà
    // résolu depuis le tenant réel de la requête (TenantContext) : jamais
    // besoin d'un repli vers une autre entité.
    const nomAffiche = p.nom;
    // Les taux (Contrat.tauxXxxPublique/Privee) sont stockés avec le signe
    // "%" déjà inclus (ex. "90%") — jamais réafficher un second "%" à côté.
    const sansPourcent = (s: string | null) => s?.replace(/\s*%\s*$/, "") ?? "—";
    // "Code des actes" C/CS/CSP (2026-09) — voir demande utilisateur : "il
    // faut mettre C pour la consultation généraliste et CS pour les
    // consultations spécialisées et CSP pour la consultation professeur".
    // Dérivé du LIBELLÉ RÉEL de l'acte (catalogue TARIF 2, famille
    // "CONSULTATIONS", ex. "CS Urologue", "CS Prof Endocrinologue",
    // "Consultation spécialiste") plutôt que du seul médecin prescripteur
    // (`pec.prescriptionOrigine.medecin`) : une même feuille de soins peut
    // regrouper plusieurs actes de consultation de niveaux différents le
    // même jour (ex. généraliste + renvoi spécialiste), que le prescripteur
    // unique enregistré ne reflète pas forcément.
    const codeConsultation = (libelle: string): string | null => {
      const L = libelle.toLowerCase();
      if (L.includes("généraliste") || L.includes("dentaire") || /^(visite|déplacement) médecin$/.test(L)) return "C";
      if (L.includes("prof")) return "CSP";
      if (L.includes("spécialiste") || /^cs\b/.test(L) || L.includes(" cs ")) return "CS";
      return null;
    };
    const codeActe = (l: LigneFormulaire): string => l.lettreCleCode ?? (l.familleActe === "CONSULTATIONS" ? codeConsultation(l.libelle) : null) ?? "—";
    // Pharmacie = uniquement les lignes RÉELLEMENT facturées par une
    // pharmacie (type contenant "PHARMA", ex. "PHARMACIE", "FRAIS
    // PHARMACEUTIQUES") — voir demande utilisateur : "ce ne sont pas les
    // données de la consultation qui doivent remonter dans la zone des
    // prix [PRESCRIPTIONS MEDICALES], mais les données de la pharmacie".
    // Un ancien découpage ("tout ce qui n'est pas LA consultation = la
    // pharmacie") faisait atterrir une DEUXIÈME consultation (ex. renvoi
    // spécialiste facturé séparément) dans le tableau pharmacie.
    const estLignePharmacie = (l: LigneFormulaire) => l.type.toUpperCase().includes("PHARMA");

    // Reproduction à l'identique du modèle vectoriel officiel ("Feuille de
    // soins V.pdf"/"Feuille d'examen.pdf", 2026-09) — voir demande
    // utilisateur : "reproduise, que tu modélise chaque document au détail
    // près... mêmes formes de tableau, même ligne exactement comme les
    // modèles". Coordonnées mesurées au point près sur le PDF de référence
    // (extraction pdfplumber, page 595,276 × 841,89 pt — quasi identique à
    // l'A4 utilisé ici) : toutes les positions ci-dessous sont ABSOLUES,
    // pas des fractions, pour rester fidèles au point près.
    // Marge basse réduite (2026-09) — voir demande utilisateur : la
    // signature du patient doit rester À SA PLACE d'origine (ligne du bas,
    // à côté de "Visa du Médecin conseil"/"Cachet et signature du
    // Praticien"), MAIS bien plus grande — la marge standard (28pt partout)
    // ne laissait qu'une quinzaine de points utiles à cet endroit,
    // insuffisant pour une signature "vraiment grande" sans provoquer un
    // saut de page. Seule la marge BASSE change ; le reste du document
    // (mesuré au point près sur le modèle papier de référence) reste
    // inchangé.
    const doc = new PDFDocument({ size: "A4", margins: { top: 28, left: 28, right: 28, bottom: 0 } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${kind === "soins" ? "Feuille-Soins" : "Feuille-Examen"}-${numero.replace(/\//g, "-")}.pdf"`);
    doc.pipe(res);

    const boite = (x: number, y: number, w: number, h: number) => doc.rect(x, y, w, h).strokeColor("#000").lineWidth(0.7).stroke();
    const ligneH = (x0: number, x1: number, y: number) => doc.moveTo(x0, y).lineTo(x1, y).strokeColor("#000").lineWidth(0.7).stroke();
    const ligneV = (x: number, y0: number, y1: number) => doc.moveTo(x, y0).lineTo(x, y1).strokeColor("#000").lineWidth(0.7).stroke();
    const casePos = (x: number, y: number, cochee: boolean, taille = 7) => {
      doc.rect(x, y, taille, taille).strokeColor("#000").lineWidth(0.6).stroke();
      if (cochee) {
        doc.moveTo(x + 1, y + 1).lineTo(x + taille - 1, y + taille - 1).strokeColor("#000").lineWidth(0.6).stroke();
        doc.moveTo(x + taille - 1, y + 1).lineTo(x + 1, y + taille - 1).strokeColor("#000").lineWidth(0.6).stroke();
      }
    };
    // Libellé + case à cocher, position de départ ajustable (voir
    // boiteValeur) — retourne le x de fin pour enchaîner l'élément suivant
    // sur la même ligne sans jamais le faire chevaucher une case élargie.
    const etiquetteCase = (x: number, y: number, label: string, cochee: boolean, taille = 4.6): number => {
      doc.font("Helvetica").fontSize(7.5).fillColor("#000").text(label, x, y);
      const labelW = doc.widthOfString(label);
      casePos(x + labelW + 6, y - 1, cochee, taille);
      return x + labelW + 6 + taille;
    };
    const texte = (s: string, x: number, y: number, opts?: { taille?: number; gras?: boolean; w?: number; align?: "left" | "center" | "right"; couleur?: string }) => {
      doc.font(opts?.gras ? "Helvetica-Bold" : "Helvetica").fontSize(opts?.taille ?? 8).fillColor(opts?.couleur ?? "#000")
        .text(s, x, y, opts?.w ? { width: opts.w, align: opts?.align ?? "left" } : {});
      doc.fillColor("#000");
    };
    // En-tête de colonne à HAUTEUR DYNAMIQUE (2026-09) — en-têtes de
    // tableau comme "Base de remboursement {société}" contiennent le nom
    // réel de la société (longueur variable selon le courtier/mutuelle
    // connecté) dans une cellule de hauteur FIXE (mesure exacte du modèle
    // papier) : au lieu de laisser le texte déborder de la cellule (comme
    // "LA RUCHE EXCELLENCE" enroulé sur 4 lignes qui chevauchait la bordure
    // du dessous), on réduit progressivement la taille de police jusqu'à
    // ce que le texte tienne dans la hauteur disponible — jamais de
    // troncature (voir demande utilisateur : "c'est valable pour toutes
    // les autres zones... on ne peut pas troquer une information capitale").
    const texteAjuste = (s: string, x: number, y: number, w: number, hMax: number, tailleDepart = 6.5) => {
      doc.font("Helvetica-Bold");
      let taille = tailleDepart;
      while (taille > 4.5 && doc.fontSize(taille).heightOfString(s, { width: w }) > hMax) taille -= 0.5;
      doc.fillColor("#000").text(s, x, y, { width: w, align: "center" });
    };
    // Case de valeur à LARGEUR DYNAMIQUE (2026-09) — voir demande
    // utilisateur : "si le code praticien est long c'est la cellule qui
    // doit être dynamique et prendre la taille de la longueur du code. On
    // ne peut pas tronquer une information aussi capitale." La largeur du
    // modèle de référence reste le MINIMUM (fidélité inchangée pour une
    // valeur courte) ; au-delà, la case s'élargit pour tout contenir, sans
    // jamais tronquer. Retourne le x de fin réel — les éléments suivants
    // sur la même ligne (case à cocher, libellé...) doivent s'y référer
    // (`Math.max(positionModèle, xFinRéel + marge)`) plutôt qu'utiliser une
    // position fixe qui chevaucherait une case élargie.
    const boiteValeur = (x: number, y: number, largeurMin: number, hauteur: number, valeur: string, tailleFonte = 6.5, gras = false): number => {
      doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(tailleFonte);
      const largeur = Math.max(largeurMin, doc.widthOfString(valeur) + 6);
      doc.rect(x, y, largeur, hauteur).strokeColor("#000").lineWidth(0.7).stroke();
      // Centrage haut/bas ET gauche/droite (2026-09) — voir demande
      // utilisateur : "centrer les informations du haut en bas des case et
      // de gauche à droite". Deux bugs corrigés : (1) `lineBreak: false`
      // désactive le moteur de mise en page de PDFKit, qui gère aussi
      // `align` — le texte retombait donc TOUJOURS à gauche dès que la
      // case était plus large que le texte (cas des codes courts type
      // "A01", où `largeurMin` domine la largeur réelle du texte), malgré
      // `align: "center"` demandé ; (2) le centrage vertical utilisait
      // `tailleFonte` au lieu de la hauteur RÉELLE de la ligne rendue
      // (`heightOfString`, qui inclut l'espace de hampe/jambage) — le texte
      // semblait "collé en haut" de la case.
      const texteH = doc.heightOfString(valeur, { width: largeur - 6 });
      doc.fillColor("#000").text(valeur, x + 3, y + Math.max(0, (hauteur - texteH) / 2), { width: largeur - 6, align: "center" });
      return x + largeur;
    };

    // Logo de la société gestionnaire (2026-09) — voir demande utilisateur :
    // "faire apparaître le logo de la société gestionnaire du contrat
    // d'assurance" dans la zone laissée vide à gauche de l'encadré titre
    // (modèle papier de référence) — agrandi/recentré dans cette zone
    // plutôt que la miniature d'angle utilisée jusqu'ici.
    this.dessinerLogoEntete(doc, logoImage, 40, 12, 75);

    if (kind === "soins") {
      // ── Encadré titre (158,4–422,1 × 30,1–89,0) ──────────────────────
      boite(158.4, 30.1, 263.7, 58.9);
      texte("FEUILLE DE SOINS", 158.4, 36, { taille: 17, gras: true, w: 263.7, align: "center", couleur: p.couleurPrimaire });
      texte(`Date et heure:  ${pec.date} ${heureTexte}`, 163.2, 57, { taille: 7.5 });
      texte(`Centre de soins:  ${pec.prestataireRef?.nom ?? "—"}`, 163.2, 66.7, { taille: 7.5 });
      ligneH(158.4, 422.1, 74.8);
      texte(`N° ${numero}`, 163.2, 79.9, { taille: 7.5, w: 253.7 });

      // Secteur assuré (déduit du secteur du prestataire, seule donnée
      // réelle équivalente déjà utilisée pour le calcul du taux ci-dessous
      // — jamais une case cochée au hasard).
      texte("Assuré Secteur Privé", 160.5, 106.2, { taille: 7.5 });
      casePos(234.4, 105.5, !secteurPublic, 5);
      texte("Assuré Secteur Public", 316.5, 106.2, { taille: 7.5 });
      casePos(392.8, 105.5, secteurPublic, 5);
      texte("Tous les champs sont obligatoires", 409.0, 119.1, { taille: 7, couleur: "#a33" });

      // ── Encadré principal (28–566 × 131,7–641,1) ─────────────────────
      const gx = 28, dx = 566;
      texte("SOUSCRIPTEUR :", 41.3, 136.6, { gras: true });
      texte(contrat.client.nom, 116, 136.6, { w: 182 });
      texte("Assuré Principal :", 305.7, 136.6, { gras: true });
      texte(nomPrincipal, 399, 136.6, { w: 165 });
      ligneH(gx, dx, 147.3);

      texte("PATIENT", 41.6, 154.3, { gras: true });
      texte("Qualité :", 81.3, 153.9);
      texte("Assuré", 121.6, 153.9);
      casePos(150.1, 153.2, !estAyantDroit, 5.5);
      texte("Ayant droit", 179.2, 153.9);
      casePos(217.7, 153.2, estAyantDroit, 5.5);
      texte("Noms et Prénoms:", 41.6, 171.0);
      texte(`${assure.nom} ${assure.prenom ?? ""}`.trim(), 145, 171.0, { w: 160, gras: true });
      // "Matricule {courtier}" — jamais un nom de société codé en dur (le
      // modèle papier de LA RUCHE l'imprime tel quel, mais l'application
      // doit rester correcte pour n'importe quel courtier/mutuelle). La
      // case matricule cascade après le libellé (`Math.max`) pour ne
      // jamais chevaucher un nom de société long.
      const libelleMatricule = `Matricule ${nomAffiche}`;
      doc.font("Helvetica").fontSize(8);
      texte(libelleMatricule, 310.0, 172.4);
      boiteValeur(Math.max(441.0, 310.0 + doc.widthOfString(libelleMatricule) + 6), 167.3, 86.2, 12.3, assure.matricule, 7.5, true);
      texte("Date de naissance:", 41.6, 188.2);
      texte(assure.dateNaissance ?? "—", 150, 188.2);
      ligneH(gx, dx, 201.4);

      texte("CONDITION DE PRISE EN CHARGE", gx, 208.6, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 219.9);
      texte(nomAffiche, gx, 227.9, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 238.3);
      texte("Ticket modérateur", 84.8, 254.4, { couleur: "#c0392b" });
      boite(170.1, 250.8, 54.8, 13.5);
      texte(ticketModerateurPct ?? "—", 170.1, 254, { w: 54.8, align: "center" });
      texte("(%)", 212.0, 254.5);
      texte("Taux de prestations:", 312.5, 246.5);
      texte("Frais médicaux", 374.2, 276.2);
      boite(453.9, 272.7, 55, 12.1);
      texte(sansPourcent(tauxAmbulatoire), 453.9, 275.5, { w: 55, align: "center" });
      texte("%", 500.2, 276.2);
      texte("Frais hospitalisation", 374.2, 292.4);
      boite(453.9, 287.4, 55, 12.1);
      texte(sansPourcent(tauxHospitalisation), 453.9, 290.2, { w: 55, align: "center" });
      texte("%", 500.2, 292.4);
      ligneV(301.7, 238.3, 307.9);
      ligneH(gx, dx, 307.9);

      texte("Médecin traitant :", 76.4, 315.5);
      texte(nomMedecin, 175, 315.5, { w: 190 });
      texte("Signature et cachet du praticien", 372.8, 317.4, { gras: true });
      if (medecin) {
        // Image de signature RÉELLE déposée dans le même espace que le
        // libellé "Signature et cachet du praticien" déjà dessiné
        // ci-dessus — jamais un second bloc "Signature du médecin"
        // supplémentaire, absent du modèle de référence.
        const signatureMedecin = await this.chargerSignatureMedecin(medecin.id);
        if (signatureMedecin) { try { doc.image(signatureMedecin, 400, 328, { fit: TAILLE_SIGNATURE }); } catch { /* jamais bloquant */ } }
      }
      texte("Code praticien", 75.5, 328.8);
      let finP = boiteValeur(151, 326.5, 30, 9.5, codePraticien ?? "—");
      let xP = etiquetteCase(Math.max(185.9, finP + 8), 326.7, "Généraliste", !estSpecialiste);
      etiquetteCase(Math.max(254.7, xP + 12), 326.7, "Tarif jour", estTarifJour);
      texte("Code établissement", 75.5, 341.5);
      finP = boiteValeur(151, 339.1, 30, 9.5, codeEtablissement ?? "—");
      xP = etiquetteCase(Math.max(185.9, finP + 8), 340.3, "Spécialiste", estSpecialiste);
      etiquetteCase(Math.max(254.7, xP + 12), 340.3, "Tarif nuit", !estTarifJour);
      texte("Code affection", 75.5, 354.1);
      finP = boiteValeur(151, 354.7, 30, 9.5, codeAffection ?? "—");
      etiquetteCase(Math.max(185.9, finP + 8), 353.9, "Autre", false);
      ligneH(gx, dx, 367.3);

      texte("PRESTATIONS", gx, 375.1, { gras: true, w: dx - gx, align: "center" });
      texte("Visite à domicile", 141.8, 391.2);
      texte("Oui", 301.4, 392.1);
      casePos(315.1, 393.1, false, 4.3);
      texte("Non", 395.3, 392.1);
      casePos(410.8, 393.1, false, 4.3);
      ligneH(gx, dx, 407.7);

      // Tableau PRESTATIONS — colonnes EXACTES du modèle :
      // 28–120,2–230,6–343,3–460,8–566. Hauteur DYNAMIQUE (2026-09) — le
      // modèle papier ne prévoit qu'une seule ligne (une consultation),
      // mais une même feuille de soins peut regrouper PLUSIEURS actes
      // hors-pharmacie (ex. consultation généraliste + renvoi spécialiste
      // facturé séparément le même jour) — voir demande utilisateur : "ce
      // ne sont pas les données de la consultation qui remontent dans la
      // zone des prix [pharmacie]". Chaque acte reçoit sa PROPRE ligne
      // (jamais fusionné/écrasé) ; le cas à 1 seule ligne (l'immense
      // majorité) rend PIXEL-IDENTIQUE à avant (delta = 0).
      const colsA = [28, 120.2, 230.6, 343.3, 460.8, 566];
      const entetesA = ["Code\ndes actes", "Montant", `Base de\nremboursement\n${nomAffiche}`, "Ticket\nmodérateur\nASSURE", `Part\n${nomAffiche}`];
      for (let i = 0; i < 5; i++) {
        const wCol = colsA[i + 1] - colsA[i] - 4;
        if (i === 2 || i === 4) texteAjuste(entetesA[i], colsA[i] + 2, 410.2, wCol, 25);
        else texte(entetesA[i], colsA[i] + 2, 410.2, { taille: 6.5, gras: true, w: wCol, align: "center" });
      }
      ligneH(gx, dx, 436.8);
      const prestationLignes = lignes.filter((l) => !estLignePharmacie(l));
      const aRowRef = 467.0 - 436.8;
      const aTop = 436.8, aRows = Math.max(1, prestationLignes.length);
      // Ligne 1 = hauteur du modèle inchangée (pixel-identique si une seule
      // prestation, le cas courant) ; à partir de 2 prestations, la ligne
      // se resserre pour que le décalage total (`delta`, propagé à TOUT ce
      // qui suit) ne dépasse jamais le bas utile de la page — jamais une
      // donnée tronquée, juste une mise en page plus compacte.
      const aRowH = aRows <= 1 ? aRowRef : Math.max(12, Math.min(aRowRef, (aRowRef + 14) / aRows));
      const aBottom = aTop + aRowH * aRows;
      for (let k = 1; k < aRows; k++) ligneH(gx, dx, aTop + aRowH * k);
      const aYOffset = Math.max(2, (aRowH - 7.5) / 2);
      prestationLignes.forEach((l, idx) => {
        const base = l.baseRemboursement ?? 0;
        const ticket = l.montant !== null ? l.montant - base : 0;
        const vals = [codeActe(l), l.montant !== null ? fmt(l.montant) : "En attente", fmt(base), fmt(ticket), fmt(base)];
        const y = aTop + aRowH * idx + aYOffset;
        for (let i = 0; i < 5; i++) texte(vals[i], colsA[i] + 3, y, { taille: 7.5, w: colsA[i + 1] - colsA[i] - 6, align: i === 0 ? "center" : "right" });
      });
      ligneH(gx, dx, aBottom);
      for (const cx of colsA) ligneV(cx, 407.7, aBottom);
      // Delta = décalage vertical de TOUT ce qui suit (0 dans le cas
      // courant à 1 seule prestation — mise en page pixel-identique au
      // modèle papier).
      const delta = aBottom - 467.0;

      texte("PRESCIPTIONS MEDICALES", gx, 475.3 + delta, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 483.3 + delta);
      const colsB = [28, 155.6, 435.3, 490.3, 566];
      const entetesB = ["Médicaments/appareillage", "Posologie", "Qté", "Prix"];
      for (let i = 0; i < 4; i++) texte(entetesB[i], colsB[i] + 4, 487.3 + delta, { taille: 7.5, gras: true, w: colsB[i + 1] - colsB[i] - 8, align: i === 0 ? "left" : "center" });
      ligneH(gx, dx, 495.0 + delta);
      // Grille lignée (2026-09) — le modèle papier trace TOUTES les lignes
      // horizontales du tableau PRESCRIPTIONS MEDICALES (12 rangées vides à
      // remplir à la main), pas seulement le haut/bas — voir demande
      // utilisateur : "pourquoi tu ne reproduis pas les bordures internes
      // de cette partie". Nombre de rangées dérivé de la hauteur RÉELLE du
      // tableau (jamais une valeur codée en dur qui se désynchroniserait si
      // les coordonnées de la maquette changent).
      const bTop = 495.0 + delta, bBottom = 641.1 + delta, bRows = 12, bRowH = (bBottom - bTop) / bRows;
      // Médicaments RÉELLEMENT prescrits (ordonnance, PrescriptionLigne) —
      // voir demande utilisateur : "il y a une prescription mais les
      // produits ne remontent pas vers la feuille de soins". Toujours
      // affichés (Médicament/Posologie/Qté = donnée de la prescription,
      // jamais absente) ; le Prix reste "En attente" tant qu'aucune
      // pharmacie n'a réellement traité la ligne (PrescriptionLigneTraitement
      // → vraie PriseEnCharge facturée), jamais une donnée de consultation
      // affichée à la place (voir `medicaments` dans lignesFormulaireDe).
      // Prix pharmacie masqué (2026-09) — voir demande utilisateur : "il ne
      // faut pas que les informations du prix des médicaments et les
      // montants des quote part puissent s'afficher sur la feuille de
      // soins qui s'affiche dans l'écran du médecin prescripteur ou de la
      // clinique, cabinet médical, hôpital... le médecin n'est pas censé
      // connaître les prix des médicaments de la pharmacie". Réservé à la
      // pharmacie et au portail de l'assuré (voir les 3 contrôleurs portail
      // qui posent `masquerPrixPharmacie`) — le médicament/la posologie/la
      // quantité prescrite restent TOUJOURS visibles (utiles au suivi
      // médical), seul le PRIX et le récapitulatif financier sont masqués.
      const masquerPrix = utilisateur?.masquerPrixPharmacie === true;
      const medicaments = pec.prescriptionOrigine?.medicaments ?? [];
      let ligneY = bTop;
      let totalPharmacie = 0, baseP = 0, ticketP = 0, partP = 0;
      for (const m of medicaments) {
        const montant = m.montant ?? 0; const base = m.baseRemboursement ?? 0; const ticket = m.montant !== null ? montant - base : 0;
        totalPharmacie += montant; baseP += base; ticketP += ticket; partP += base;
        if (ligneY + bRowH <= bBottom + 0.01) {
          const vals = [m.libelle, m.posologie ?? "—", String(m.quantite), masquerPrix ? "" : (m.montant === null ? "En attente" : fmt(m.montant))];
          for (let i = 0; i < 4; i++) texte(vals[i], colsB[i] + 4, ligneY + 2, { taille: 7.5, w: colsB[i + 1] - colsB[i] - 8, align: i >= 2 ? "right" : "left" });
          // Un nom de médicament/posologie long ne doit jamais chevaucher la
          // ligne suivante (voir demande utilisateur "cellule dynamique...
          // jamais tronquer") — la ligne avance de la hauteur RÉELLE
          // (mesurée) si elle dépasse la rangée lignée standard, quitte à
          // occuper 2 rangées visuellement.
          doc.font("Helvetica").fontSize(7.5);
          const hLibelle = doc.heightOfString(m.libelle, { width: colsB[1] - colsB[0] - 8 });
          const hPosologie = doc.heightOfString(m.posologie ?? "—", { width: colsB[2] - colsB[1] - 8 });
          ligneY += Math.max(bRowH, Math.max(hLibelle, hPosologie) + 3);
          // Le filet de séparation suit la hauteur RÉELLE de la ligne
          // (jamais la grille lignée fixe pré-tracée, qui barrerait le
          // texte d'une ligne agrandie — voir commentaire ci-dessus).
          ligneH(gx, dx, ligneY);
        }
      }
      // Reste du tableau (lignes vides après le dernier médicament réel) :
      // grille lignée fixe, comme le modèle papier.
      for (let y = ligneY + bRowH; y < bBottom - 0.01; y += bRowH) ligneH(gx, dx, y);
      for (const cx of colsB) ligneV(cx, 483.3 + delta, bBottom);
      ligneH(gx, dx, bBottom);
      boite(gx, 131.7, dx - gx, bBottom - 131.7);

      // Encadré totaux pharmacie (325,3–566,1 × 648,8–730,4).
      boite(325.3, 648.8 + delta, 240.8, 81.6);
      ligneV(465.3, 648.8 + delta, 729.7 + delta);
      texte("Total pharmacie", 330.3, 657.9 + delta);
      texte(masquerPrix ? "" : fmt(totalPharmacie), 465.3, 657.9 + delta, { w: 96, align: "right" });
      ligneH(325.3, 566.1, 671.8 + delta);
      texte(`Base ${nomAffiche}`, 330.9, 680.7 + delta);
      texte(masquerPrix ? "" : fmt(baseP), 465.3, 680.7 + delta, { w: 96, align: "right" });
      ligneH(325.3, 566.1, 691.8 + delta);
      texte(`Ticket modérateur ${nomAffiche}`, 329.6, 699.9 + delta, { taille: 7.5 });
      texte(masquerPrix ? "" : fmt(ticketP), 465.3, 699.9 + delta, { w: 96, align: "right" });
      ligneH(325.3, 566.1, 711.0 + delta);
      texte(`Part ${nomAffiche}`, 330.9, 716.7 + delta, { gras: true });
      texte(masquerPrix ? "" : fmt(partP), 465.3, 716.7 + delta, { w: 96, align: "right", gras: true });

      if (utilisateur && documentRef) await this.dessinerSignatureElectronique(doc, gx, 700 + delta, "Feuille de Soins", documentRef, utilisateur);

      texte(`Visa du Médecin conseil ${nomAffiche}`, 40.7, 786.1 + delta, { taille: 7.5 });
      // Signature du Patient — À SA PLACE D'ORIGINE (2026-09, voir demande
      // utilisateur : "pas besoin de cadre et pas besoin de déplacer le
      // bloc"), simplement agrandie grâce à la marge basse réduite ci-dessus
      // (aucun encadré ajouté — jamais dans le modèle papier de référence).
      texte("Signature du Patient", 261.8, 786.1 + delta, { taille: 7.5 });
      {
        const signatureAssure = await this.chargerSignatureAssure(assure.id);
        if (signatureAssure) { try { doc.image(signatureAssure, 261.8, 793 + delta, { fit: TAILLE_SIGNATURE }); } catch { /* jamais bloquant */ } }
      }
      // Largeur 140 (2026-09, au lieu de 120) — "Cachet et signature du
      // Praticien" à 7.5pt tient tout juste sur une ligne à cette largeur ;
      // en dessous, le libellé s'enroulait sur 2 lignes et laissait trop
      // peu de place en bas de page pour le cachet/la signature ajoutés
      // juste après (voir dessinerCachetPrestataire).
      texte("Cachet et signature du Praticien", 416.8, 783.0 + delta, { taille: 7.5, w: 150 });
      if (prestataireFiltre) await this.dessinerCachetPrestataire(doc, 416.8, 793 + delta, 150, utilisateur?.id ?? null, prestataireFiltre.nom);
    } else {
      // ══ FEUILLE D'EXAMEN ═══════════════════════════════════════════
      boite(165.2, 26.2, 263.7, 58.9);
      texte("FEUILLE D'EXAMENS", 165.2, 33.1, { taille: 17, gras: true, w: 263.7, align: "center", couleur: p.couleurPrimaire });
      texte(`Date et heure:  ${pec.date} ${heureTexte}`, 170.0, 53.1, { taille: 7.5 });
      texte(`Centre de soins:  ${pec.prestataireRef?.nom ?? "—"}`, 170.0, 62.8, { taille: 7.5 });
      ligneH(165.2, 428.9, 70.9);
      texte(`N° ${numero}`, 170.0, 76.0, { taille: 7.5, w: 258.9 });

      texte("Assuré Secteur Privé", 167.3, 102.4, { taille: 7.5 });
      casePos(241.2, 101.7, !secteurPublic, 5);
      texte("Assuré Secteur Public", 323.3, 102.4, { taille: 7.5 });
      casePos(399.6, 101.7, secteurPublic, 5);
      texte("Tous les champs sont obligatoires", 444.4, 114.3, { taille: 7, couleur: "#a33" });

      const gx = 29.3, dx = 566.6;
      texte("SOUSCRIPTEUR :", 76.1, 132.7, { gras: true });
      texte(contrat.client.nom, 150, 132.7, { w: 159 });
      texte("Assuré Principal :", 312.5, 132.7, { gras: true });
      texte(nomPrincipal, 400, 132.7, { w: 163 });
      ligneH(gx, dx, 143.4);

      texte("PATIENT", 81.4, 150.4, { gras: true });
      texte("Qualité :", 121.1, 150.1);
      texte("Assuré", 161.4, 150.1);
      casePos(186.9, 149.4, !estAyantDroit, 5.5);
      texte("Ayant droit", 216.0, 150.1);
      casePos(254.5, 149.4, estAyantDroit, 5.5);
      texte("Noms et Prénoms:", 81.4, 167.1);
      texte(`${assure.nom} ${assure.prenom ?? ""}`.trim(), 185, 167.1, { w: 120, gras: true });
      const libelleMatriculeExamen = `Matricule ${nomAffiche}`;
      doc.font("Helvetica").fontSize(8);
      texte(libelleMatriculeExamen, 311.9, 172.5);
      boiteValeur(Math.max(442.8, 311.9 + doc.widthOfString(libelleMatriculeExamen) + 6), 163.4, 86.2, 12.3, assure.matricule, 7.5, true);
      texte("Date de naissance:", 81.4, 184.3);
      texte(assure.dateNaissance ?? "—", 190, 184.3);
      ligneH(gx, dx, 197.5);

      texte("CONDITION DE PRISE EN CHARGE", gx, 204.7, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 216.0);
      texte(nomAffiche, gx, 224.9, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 234.5);
      texte("Ticket modérateur", 67.5, 261.3);
      boite(160.0, 254.9, 69.9, 17.0);
      texte(ticketModerateurPct ?? "—", 160.0, 259.5, { w: 69.9, align: "center" });
      texte("(%)", 215.3, 259.8);
      texte("Frais médicaux", 381.0, 272.3);
      boite(460.7, 268.8, 55, 12.1);
      texte(sansPourcent(tauxAmbulatoire), 460.7, 271.6, { w: 55, align: "center" });
      texte("%", 507.0, 272.3);
      texte("Frais hospitalisation", 381.0, 288.5);
      boite(460.7, 283.5, 55, 12.1);
      texte(sansPourcent(tauxHospitalisation), 460.7, 286.3, { w: 55, align: "center" });
      texte("%", 507.0, 288.5);
      ligneV(298.5, 235.1, 304.1);
      ligneH(gx, dx, 304.3);

      // "PATIENT PRESCRIPTEUR" — intitulé du modèle de référence reproduit
      // tel quel (probable coquille d'origine pour "PRATICIEN
      // PRESCRIPTEUR"), jamais corrigé ici par souci de fidélité exacte.
      texte("PATIENT PRESCRIPTEUR", gx, 310.0, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 319.0);
      texte("Nom et prénom du praticien :", 50.0, 328.3);
      texte(nomMedecin, 200, 328.3, { w: 200 });
      texte("Signature et cachet du praticien", 413.2, 328.3, { gras: true });
      if (medecin) {
        const signatureMedecin = await this.chargerSignatureMedecin(medecin.id);
        if (signatureMedecin) { try { doc.image(signatureMedecin, 413.2, 338, { fit: TAILLE_SIGNATURE }); } catch { /* jamais bloquant */ } }
      }
      texte("Code praticien", 50.0, 346.9);
      let finC = boiteValeur(102.8, 344.6, 46.9, 10.1, codePraticien ?? "—");
      let xC = Math.max(155.5, finC + 6);
      texte("Code établissement", xC, 346.9);
      doc.font("Helvetica").fontSize(8);
      finC = boiteValeur(xC + doc.widthOfString("Code établissement") + 6, 344.6, 46.9, 10.1, codeEtablissement ?? "—");
      xC = Math.max(293.1, finC + 6);
      texte("Code affection", xC, 346.9);
      doc.font("Helvetica").fontSize(8);
      boiteValeur(xC + doc.widthOfString("Code affection") + 6, 344.6, 46.9, 10.1, codeAffection ?? "—");
      texte("Généraliste", 50.0, 365.9);
      casePos(91.4, 365.2, !estSpecialiste, 4.6);
      texte("Spécialiste", 149.6, 365.9);
      casePos(189.8, 365.2, estSpecialiste, 4.6);
      texte("Autre", 283.8, 365.9);
      casePos(304.2, 365.2, false, 4.6);
      ligneH(gx, dx, 375.1);

      texte("PRESCRIPTION ET PRATICIENS REALISANT L'EXAMEN", gx, 382.6, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 398.0);
      texte("Date et heure de prescription:", 50.0, 400.9, { taille: 7.5 });
      boite(171.9, 398.2, 76.1, 10.1);
      texte(`${pec.date} ${heureTexte}`, 171.9, 400.6, { taille: 6.5, w: 76.1, align: "center" });
      texte("Situation du patient", 337.7, 400.5, { taille: 7.5 });
      texte("Hospitalisé", 419.2, 400.5, { taille: 7.5 });
      casePos(459.3, 400.2, pec.type === "Hospitalisation", 4.6);
      texte("Soins internes", 475.1, 400.5, { taille: 7.5 });
      casePos(526.0, 400.2, pec.type !== "Hospitalisation", 4.6);
      ligneH(gx, dx, 417.0);
      texte("Nom de l'établissement", 50.0, 419.5, { taille: 7.5 });
      texte(pec.prestataireRef?.nom ?? "—", 130.5, 419.5, { taille: 7.5, w: 130 });
      texte("Code établissement", 265.0, 419.5, { taille: 7.5 });
      let finE = boiteValeur(337.5, 417.2, 55.4, 10.1, codeEtablissement ?? "—");
      const xE = Math.max(401.1, finE + 6);
      texte("Code du praticien", xE, 419.5, { taille: 7.5 });
      doc.font("Helvetica").fontSize(7.5);
      boiteValeur(xE + doc.widthOfString("Code du praticien") + 6, 417.2, 55.5, 10.1, codePraticien ?? "—");
      ligneH(gx, dx, 437.0);
      const familleLigne = lignePrincipale ? groupeDeFamille(lignePrincipale.familleActe) : undefined;
      const estLabo = familleLigne === "Analyse", estRadio = familleLigne === "Imagerie";
      texte("Nature de la prestation :", 50.0, 438.5, { taille: 7.5 });
      texte("Laboratoire", 164.6, 438.5, { taille: 7.5 });
      casePos(205.4, 437.8, estLabo, 4.6);
      texte("Radiologie", 263.8, 438.5, { taille: 7.5 });
      casePos(301.2, 437.8, estRadio, 4.6);
      texte("Autre", 391.0, 438.5, { taille: 7.5 });
      casePos(410.6, 437.8, !estLabo && !estRadio, 4.6);
      ligneH(gx, dx, 454.0);

      texte("EXAMENS", gx, 454.9, { gras: true, w: dx - gx, align: "center" });
      ligneH(gx, dx, 475.0);
      const colsC = [gx, 230.5, 287.2, 347.6, 424.7, 492.1, dx];
      const entetesC = ["DESIGNATION EXAMEN(S)", "Code\ndes actes", "Montant\nprestataire", `Base de\nrembt.\n${nomAffiche}`, "Ticket\nmodérateur\nASSURE", `Part\n${nomAffiche}`];
      for (let i = 0; i < 6; i++) {
        const wCol = colsC[i + 1] - colsC[i] - 4;
        if (i === 3 || i === 5) texteAjuste(entetesC[i], colsC[i] + 2, 478.8, wCol, 24);
        else texte(entetesC[i], colsC[i] + 2, 478.8, { taille: 6.5, gras: true, w: wCol, align: i === 0 ? "left" : "center" });
      }
      ligneH(gx, dx, 504.7);
      // Grille lignée (2026-09) — même correctif que PRESCRIPTIONS MEDICALES
      // (Feuille de Soins) : le modèle papier trace toutes les lignes
      // horizontales du tableau EXAMENS, pas seulement le haut/bas.
      const cTop = 504.7, cBottom = 693.3, cRows = 9, cRowH = (cBottom - cTop) / cRows;
      for (let k = 1; k < cRows; k++) ligneH(gx, dx, cTop + cRowH * k);
      let ligneY2 = cTop;
      let totalMontant = 0, totalBase = 0, totalTicket = 0;
      for (const l of lignes) {
        const enAttente = l.montant === null;
        const base = l.baseRemboursement ?? 0;
        const ticket = l.montant !== null && l.baseRemboursement !== null ? l.montant - base : 0;
        totalMontant += l.montant ?? 0; totalBase += base; totalTicket += ticket;
        if (ligneY2 + cRowH <= cBottom + 0.01) {
          const vals = [l.libelle, codeActe(l), enAttente ? "En attente" : fmt(l.montant), enAttente ? "—" : fmt(base), enAttente ? "—" : fmt(ticket), enAttente ? "—" : fmt(base)];
          for (let i = 0; i < 6; i++) texte(vals[i], colsC[i] + 3, ligneY2 + 4, { taille: 7.5, w: colsC[i + 1] - colsC[i] - 6, align: i === 0 ? "left" : "right" });
          ligneY2 += cRowH;
        }
      }
      ligneH(gx, dx, 693.3);
      texte("TOTAUX", gx, 705.6, { gras: true, w: colsC[1] - gx, align: "center" });
      const totC = ["", fmt(totalMontant), fmt(totalBase), fmt(totalTicket), fmt(totalBase)];
      for (let i = 1; i < 6; i++) texte(totC[i - 1], colsC[i] + 3, 705.6, { taille: 7.5, gras: true, w: colsC[i + 1] - colsC[i] - 6, align: "right" });
      ligneH(gx, dx, 719.6);
      for (const cx of colsC) ligneV(cx, 475.0, 719.6);
      boite(gx, 125.2, dx - gx, 719.6 - 125.2);

      if (utilisateur && documentRef) await this.dessinerSignatureElectronique(doc, gx, 745, "Feuille d'Examen", documentRef, utilisateur);

      texte(`Visa du Médecin conseil ${nomAffiche}`, 40.0, 791.1, { taille: 7.5 });
      // Signature du Patient — à sa place d'origine, agrandie (même
      // principe que la Feuille de Soins ci-dessus).
      texte("Signature du Patient", 261.1, 791.1, { taille: 7.5 });
      {
        const signatureAssure = await this.chargerSignatureAssure(assure.id);
        if (signatureAssure) { try { doc.image(signatureAssure, 261.1, 795, { fit: TAILLE_SIGNATURE }); } catch { /* jamais bloquant */ } }
      }
      texte("Cachet et signature du Praticien", 416.1, 788.0, { taille: 7.5, w: 150 });
      if (prestataireFiltre) await this.dessinerCachetPrestataire(doc, 416.1, 795, 150, utilisateur?.id ?? null, prestataireFiltre.nom);
    }

    doc.end();
  }

  // Récupère les lignes "sœurs" d'une PriseEnCharge — même Facture, même
  // assuré (voir commentaire ci-dessus), restreintes au groupe Soins
  // (tout sauf Analyse/Imagerie) ou Examen (Analyse/Imagerie) selon `kind`.
  // `prestataireFiltre` (2026-09) — voir demande utilisateur : "l'application
  // doit faire apparaître sur les bons côté prestataire UNIQUEMENT ce que le
  // prestataire a réellement traité, et non la totalité comme si c'est lui
  // qui avait tout traité" (traitement partiel multi-pharmacie, voir
  // PrescriptionLigneTraitement). Fourni UNIQUEMENT par
  // PortailPrestataireController (le document que CE prestataire imprime
  // pendant qu'il traite un bon) — jamais par le médecin prescripteur ni le
  // portail assuré, qui doivent toujours voir l'ordonnance ENTIÈRE quel que
  // soit le nombre de prestataires y ayant contribué.
  private async lignesFormulaireDe(priseEnChargeId: string, kind: "soins" | "examen", prestataireFiltre?: string) {
    const pec = await this.prisma.priseEnCharge.findUnique({
      where: { id: priseEnChargeId },
      include: {
        assure: { include: { contrat: { include: { client: true, compagnie: true } }, famille: true } },
        prestataireRef: true, acteMedical: true,
        prescriptionOrigine: {
          include: {
            medecin: true,
            // Médicaments prescrits (ordonnance) — voir demande utilisateur :
            // "il y a une prescription mais les produits ne remontent pas
            // vers la feuille de soins". Même patron que
            // renderFeuilleExamenPrescription (traitements[0] = la VRAIE
            // ligne facturée par la pharmacie qui a délivré, s'il y en a
            // une) — jamais de sibling PriseEnCharge par factureId, qui ne
            // fonctionne pas ici (la pharmacie facture sur SA PROPRE
            // facture, distincte de celle de la consultation).
            lignes: { where: { type: "Medicament" }, include: { traitements: { include: { priseEnCharge: true } } } },
          },
        },
      },
    });
    if (!pec) throw new NotFoundException(`Prise en charge ${priseEnChargeId} introuvable`);

    const soeurs = pec.factureId
      ? await this.prisma.priseEnCharge.findMany({
          where: { factureId: pec.factureId, assureId: pec.assureId, statut: { not: "Annulé" } },
          include: { acteMedical: true },
          orderBy: { createdAt: "asc" },
        })
      : [pec];

    const estExamen = (famille: string | null | undefined) => GROUPES_EXAMEN.has(groupeDeFamille(famille) ?? "");
    const filtrees = soeurs.filter((l) => estExamen(l.acteMedical?.famille) === (kind === "examen"));
    const retenues = filtrees.length > 0 ? filtrees : [pec];

    const lignes: LigneFormulaire[] = retenues.map((l) => ({
      libelle: l.acteMedical?.libelle ?? l.type, quantite: l.quantite ?? 1,
      montant: Number(l.montant), baseRemboursement: l.baseRemboursement !== null ? Number(l.baseRemboursement) : null,
      tauxRemboursement: l.tauxRemboursement !== null ? Number(l.tauxRemboursement) : null,
      codeAffection: l.codeAffection, lettreCleCode: l.lettreCleCode, type: l.type, createdAt: l.createdAt,
      familleActe: l.acteMedical?.famille ?? null,
    }));

    const lignesPrescOrigine = pec.prescriptionOrigine?.lignes ?? [];
    // Sans filtre (médecin, assuré) : ligne entière + 1er traitement reçu,
    // comme avant. Avec filtre (un prestataire précis) : ne garder QUE les
    // lignes où CE prestataire a une contribution, et n'afficher QUE la
    // quantité/le montant de SA propre contribution — jamais celle d'un
    // confrère qui aurait traité (une partie de) la même ligne.
    const medicaments = lignesPrescOrigine
      .map((pl) => {
        const traitement = prestataireFiltre
          ? pl.traitements.find((t) => t.prestataireId === prestataireFiltre)
          : pl.traitements[0];
        if (prestataireFiltre && !traitement) return null;
        const traite = traitement?.priseEnCharge;
        return {
          libelle: pl.libelle, quantite: prestataireFiltre ? (traitement?.quantite ?? pl.quantite) : pl.quantite, posologie: pl.posologie,
          montant: traite ? Number(traite.montant) : null,
          baseRemboursement: traite?.baseRemboursement !== undefined && traite?.baseRemboursement !== null ? Number(traite.baseRemboursement) : null,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const pecFinal = pec.prescriptionOrigine
      ? { ...pec, prescriptionOrigine: { ...pec.prescriptionOrigine, medicaments } }
      : pec;
    return { pec: pecFinal as unknown as FormulairePec, lignes };
  }

  async renderFeuilleSoinsLigne(priseEnChargeId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string; masquerPrixPharmacie?: boolean }, prestataireFiltre?: { id: string; nom: string }) {
    const { pec, lignes } = await this.lignesFormulaireDe(priseEnChargeId, "soins", prestataireFiltre?.id);
    const numero = await this.numeroFeuilleSoinsDe(priseEnChargeId);
    await this.genererFormulaire("soins", numero, pec, lignes, res, priseEnChargeId, utilisateur, prestataireFiltre);
  }

  async renderFeuilleExamenLigne(priseEnChargeId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string; masquerPrixPharmacie?: boolean }) {
    const { pec, lignes } = await this.lignesFormulaireDe(priseEnChargeId, "examen");
    const numero = pec.prescriptionOrigine?.numeroBonExamen ?? await this.prochainNumeroFormulaire("feuille-examen");
    await this.genererFormulaire("examen", numero, pec, lignes, res, priseEnChargeId, utilisateur);
  }

  // Bon d'examen émis DIRECTEMENT depuis la prescription (2026-08, voir
  // demande utilisateur : "lorsque le médecin fera sa prescription" — avant
  // tout traitement par un prestataire) — les lignes pas encore traitées
  // n'ont pas de montant/part à afficher (voir PrescriptionLigne.statut).
  // `prestataireFiltre` — même principe que lignesFormulaireDe ci-dessus :
  // fourni uniquement quand CE prestataire imprime son propre bon d'examen
  // pendant son traitement, jamais pour le médecin/l'assuré (voir demande
  // utilisateur citée plus haut).
  async renderFeuilleExamenPrescription(prescriptionId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string; masquerPrixPharmacie?: boolean }, prestataireFiltre?: { id: string; nom: string }) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        medecin: true,
        priseEnCharge: { include: { assure: { include: { contrat: { include: { client: true, compagnie: true } }, famille: true } }, prestataireRef: true } },
        lignes: { where: { type: "Examen" }, include: { traitements: { include: { priseEnCharge: { include: { acteMedical: true } } } } } },
      },
    });
    if (!prescription) throw new NotFoundException(`Prescription ${prescriptionId} introuvable`);
    if (!prescription.numeroBonExamen) throw new BadRequestException("Cette prescription ne comporte aucun examen.");

    const lignesSource = prestataireFiltre
      ? prescription.lignes.filter((l) => l.traitements.some((t) => t.prestataireId === prestataireFiltre.id))
      : prescription.lignes;
    const lignes: LigneFormulaire[] = lignesSource.map((l) => {
      const traitement = prestataireFiltre ? l.traitements.find((t) => t.prestataireId === prestataireFiltre.id) : l.traitements[0];
      const traite = traitement?.priseEnCharge;
      return {
        libelle: l.libelle, quantite: prestataireFiltre ? (traitement?.quantite ?? l.quantite) : l.quantite,
        montant: traite ? Number(traite.montant) : null,
        baseRemboursement: traite?.baseRemboursement !== undefined && traite?.baseRemboursement !== null ? Number(traite.baseRemboursement) : null,
        tauxRemboursement: traite?.tauxRemboursement !== undefined && traite?.tauxRemboursement !== null ? Number(traite.tauxRemboursement) : null,
        codeAffection: traite?.codeAffection ?? null, lettreCleCode: traite?.lettreCleCode ?? null,
        type: "Examen", createdAt: traite?.createdAt ?? prescription.createdAt,
        familleActe: traite?.acteMedical?.famille ?? null,
      };
    });
    const pec: FormulairePec = {
      date: prescription.priseEnCharge.date, type: prescription.priseEnCharge.type, createdAt: prescription.createdAt,
      assure: prescription.priseEnCharge.assure as unknown as FormulairePec["assure"],
      prestataireRef: prescription.priseEnCharge.prestataireRef,
      // Pas de section pharmacie sur la Feuille d'Examen — tableau vide,
      // jamais utilisé par genererFormulaire côté "examen".
      prescriptionOrigine: { medecin: prescription.medecin, numeroBonExamen: prescription.numeroBonExamen, medicaments: [] },
    };
    await this.genererFormulaire("examen", prescription.numeroBonExamen, pec, lignes, res, prescriptionId, utilisateur, prestataireFiltre);
  }

  // ── Certificat de Prise en Charge (entente préalable accordée) ─────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins ci-dessus). Validité : dateValidite si renseignée, sinon
  // dateDecision (ou dateDemande à défaut) + 30 jours — règle déjà décrite
  // dans schema.prisma AccordPrealable.dateValidite.
  // Reproduction à l'identique du modèle de référence (2026-09) — voir
  // demande utilisateur : "le modèle de prise en charge actuel n'est pas
  // celui qu'on avait modélisé... reproduis à l'identique le fichier de
  // prise en charge (entente préalable)", fichier fourni
  // "Modèle prise en charge_New.pdf". Structure fidèle au modèle : photo +
  // encart "pièces à retourner" en en-tête, bandeau de titre, boîtes
  // encadrées à en-tête grisé (Dossier/Demandeur, Identité du
  // patient/Destinataire, Objet/Délivré par), tableau Actes, bandeau
  // Conditions + double bloc signature en pied de page. Positions mesurées
  // aux proportions du PDF de référence (pas d'extraction point-à-point
  // disponible dans cet environnement — pas de pdfplumber ici, contrairement
  // à la reconstruction du Décompte), mais même niveau d'exigence
  // structurel : mêmes libellés, même ordre, mêmes cadres.
  async renderCertificatPriseEnCharge(accordId: string, res: Response, _utilisateur: { id: string | null; nom: string; roleId: string }) {
    const accord = await this.prisma.accordPrealable.findUnique({
      where: { id: accordId },
      include: {
        assure: { include: { contrat: { include: { client: true, compagnie: true } } } },
        prestataireRef: true, demandeur: true, lignes: { include: { acteMedical: true } },
      },
    });
    if (!accord) throw new NotFoundException(`Prise en charge ${accordId} introuvable`);
    if (accord.decision !== "Accordé") throw new BadRequestException("Aucun certificat à émettre — cette demande n'a pas été accordée.");

    const dateBase = parseDateFr(accord.dateDecision) ?? parseDateFr(accord.dateDemande) ?? new Date();
    const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const dateValidite = accord.dateValidite ?? (() => {
      const d = new Date(dateBase); d.setDate(d.getDate() + 30);
      return fmtDate(d);
    })();
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Certificat-Prise-En-Charge-${accord.id}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const GRIS_ENTETE = "#8a8f98";
    const GRIS_FOND = "#eef0f3";

    const encadre = (x: number, y: number, w: number, h: number) => {
      doc.rect(x, y, w, h).lineWidth(0.8).strokeColor("#333").stroke();
    };
    const enteteGris = (titre: string, x: number, y: number, w: number, h = 14) => {
      doc.rect(x, y, w, h).fill(GRIS_ENTETE);
      doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8.5).text(titre, x, y + h / 2 - 4, { width: w, align: "center" });
      doc.fillColor("#000");
    };

    // ── En-tête : photo, logo, encart "pièces à retourner" ──────────────
    const photoX = left, photoY = 40, photoW = 82, photoH = 100;
    await this.dessinerPhoto(doc, accord.assure.photo, photoX, photoY, photoW, photoH);

    const logoX = photoX + photoW + 14;
    const encartW = 165;
    const encartX = right - encartW;
    const logoW = encartX - logoX - 10;
    if (logoImage) {
      try { doc.image(logoImage, logoX, photoY, { fit: [logoW, 55] }); } catch { /* jamais bloquant */ }
    }
    doc.fillColor(p.couleurPrimaire).font("Helvetica-Bold").fontSize(9).text(p.nom, logoX, photoY + 58, { width: logoW });
    doc.fillColor("#555").font("Helvetica").fontSize(7.5).text(p.sousTitre, logoX, photoY + 70, { width: logoW });

    doc.rect(encartX, photoY, encartW, photoH).lineWidth(0.8).strokeColor("#333").stroke();
    doc.fillColor("#000").font("Helvetica").fontSize(7).text(
      `EXEMPLAIRE A RETOURNER AVEC LES DOCUMENTS SUIVANTS A ${p.nom.toUpperCase()}:\n\n- Rapport médical\n- Détail de la pharmacie utilisée\n- Facture en 3 exemplaires\n- Original de la prescription`,
      encartX + 6, photoY + 6, { width: encartW - 12, lineGap: 1.5 },
    );

    let y = photoY + photoH + 10;
    enteteGris("CERTIFICAT DE PRISE EN CHARGE", left, y, width, 20);
    y += 28;

    // ── Ligne Dossier / Demandeur ────────────────────────────────────────
    const colW = width / 2;
    const boxH1 = 48;
    encadre(left, y, colW, boxH1);
    encadre(left + colW, y, colW, boxH1);
    doc.font("Helvetica").fontSize(8);
    champ(doc, left + 8, y + 8, "DOSSIER N°", accord.id, 90, colW - 98, { boldLabel: true });
    champ(doc, left + 8, y + 22, "Editer le :", fmtDate(dateBase), 90, colW - 98, { boldLabel: true });
    champ(doc, left + 8, y + 34, "Valable jusqu'au:", dateValidite, 90, colW - 98, { boldLabel: true });
    champ(doc, left + colW + 8, y + 8, "Demandeur:", accord.demandeur?.nom ?? "—", 75, colW - 83, { boldLabel: true, boldValeur: true });
    const tauxCouverture = this.tauxCouverturePriseEnCharge(accord.lignes);
    champ(doc, left + colW + 8, y + 24, "Taux de couverture:", tauxCouverture != null ? `${tauxCouverture} %` : "—", 105, colW - 113, { boldLabel: true });
    y += boxH1 + 10;

    // ── Identité du patient / Destinataire ───────────────────────────────
    const boxH2 = 82;
    enteteGris("IDENTITE DU PATIENT", left, y, colW - 4, 14);
    enteteGris("DESTINATAIRE", left + colW + 4, y, colW - 4, 14);
    encadre(left, y, colW - 4, boxH2);
    encadre(left + colW + 4, y, colW - 4, boxH2);
    const nomAssure = `${accord.assure.nom} ${accord.assure.prenom ?? ""}`.trim();
    doc.font("Helvetica").fontSize(8);
    let iy = y + 20;
    doc.text(`Société: ${accord.assure.contrat.client.nom}`, left + 8, iy, { width: colW - 20, align: "center" }); iy += 11;
    doc.font("Helvetica-Bold").text(`Bénéficiaire: ${nomAssure}`, left + 8, iy, { width: colW - 20, align: "center" }); iy += 11;
    doc.font("Helvetica").text(`N° carte: ${accord.assure.matricule}`, left + 8, iy, { width: colW - 20, align: "center" }); iy += 11;
    doc.text(`Client: ${accord.assure.contrat.numeroPolice ?? "—"}`, left + 8, iy, { width: colW - 20, align: "center" }); iy += 11;
    doc.text(`compagnie: ${accord.assure.contrat.compagnie.nom}`, left + 8, iy, { width: colW - 20, align: "center" });

    const nomPrestataire = accord.prestataireRef?.nom ?? accord.prestataire;
    let dy = y + 20;
    doc.font("Helvetica").text(`Nom: ${nomPrestataire}`, left + colW + 8, dy, { width: colW - 20, align: "center" }); dy += 11;
    doc.text(`Téléphone: ${accord.prestataireRef?.telephone ?? "—"}`, left + colW + 8, dy, { width: colW - 20, align: "center" }); dy += 11;
    doc.text(`Adresse: ${accord.prestataireRef?.adresse ?? accord.prestataireRef?.ville ?? "—"}`, left + colW + 8, dy, { width: colW - 20, align: "center" });
    y += boxH2 + 10;

    // ── Objet de la prise en charge / Délivré par ────────────────────────
    const boxH3 = 46;
    enteteGris("OBJET DE LA PRISE EN CHARGE", left, y, colW - 4, 14);
    enteteGris("DELIVRE PAR", left + colW + 4, y, colW - 4, 14);
    encadre(left, y, colW - 4, boxH3);
    encadre(left + colW + 4, y, colW - 4, boxH3);
    const codeActe = accord.lignes[0]?.acteMedical?.libelle ?? accord.lignes[0]?.description ?? accord.description;
    doc.font("Helvetica").fontSize(8).text(`Code: ${codeActe}`, left + 8, y + 20, { width: colW - 20 });
    doc.text(`Nom: ${p.nom}`, left + colW + 8, y + 18, { width: colW - 20 });
    doc.text(`Adresse: ${p.ville}\n${p.pays}`, left + colW + 8, y + 29, { width: colW - 20 });
    y += boxH3 + 10;

    // ── Tableau des actes ─────────────────────────────────────────────
    const nomSocieteTable = p.nom.toUpperCase();
    const cols = [
      { h: "Actes", w: width * 0.4 },
      { h: "Frais Réels", w: width * 0.18 },
      { h: `Remb. ${nomSocieteTable}`, w: width * 0.22 },
      { h: "Reste à charge\ndu Bénéficiaire", w: width * 0.2 },
    ];
    doc.font("Helvetica-Bold").fontSize(7.5);
    let cx = left;
    for (const c of cols) { encadre(cx, y, c.w, 22); doc.text(c.h, cx + 3, y + (c.h.includes("\n") ? 3 : 7), { width: c.w - 6, align: "center" }); cx += c.w; }
    y += 22;

    doc.font("Helvetica").fontSize(8);
    const lignesTable = accord.lignes.length > 0
      ? accord.lignes.map((l) => ({ libelle: l.acteMedical?.libelle ?? l.description, remb: Number(l.plafondReference), frais: Number(l.montantDevis) }))
      : [{ libelle: accord.description, remb: Number(accord.montantAutorise ?? 0), frais: Number(accord.montantDevis ?? accord.montantAutorise ?? 0) }];
    let totalRemb = 0, totalFrais = 0;
    for (const l of lignesTable) {
      totalRemb += l.remb; totalFrais += l.frais;
      const reste = Math.max(0, l.frais - l.remb);
      // Hauteur dynamique (2026-09) — un libellé d'acte long (ex.
      // "Hospitalisation programmée — appendicectomie") retournait à la
      // ligne dans une rangée figée à 16pt, et le filet de séparation
      // suivant traversait la 2ᵉ ligne de texte au lieu de passer dessous.
      const rowH = Math.max(16, doc.heightOfString(l.libelle, { width: cols[0].w - 8 }) + 8);
      cx = left;
      const vals = [l.libelle, fmt(l.frais), fmt(l.remb), fmt(reste)];
      for (let i = 0; i < cols.length; i++) {
        encadre(cx, y, cols[i].w, rowH);
        doc.text(vals[i], cx + 4, y + 4, { width: cols[i].w - 8, align: i === 0 ? "left" : "center" });
        cx += cols[i].w;
      }
      y += rowH;
    }
    // Total
    {
      const rowH = 16;
      const totalReste = Math.max(0, totalFrais - totalRemb);
      const vals = ["Total", fmt(totalFrais), fmt(totalRemb), fmt(totalReste)];
      cx = left;
      doc.font("Helvetica-Bold");
      for (let i = 0; i < cols.length; i++) {
        encadre(cx, y, cols[i].w, rowH);
        doc.text(vals[i], cx + 4, y + 4, { width: cols[i].w - 8, align: i === 0 ? "right" : "center" });
        cx += cols[i].w;
      }
      y += rowH;
    }

    // ── Bas de page : conditions + signatures (ancré au bas, comme le modèle) ──
    const bas = doc.page.height - doc.page.margins.bottom;
    const yCond = bas - 90;
    enteteGris("CONDITIONS DE LA PRISE EN CHARGE", left, yCond, width, 14);
    doc.font("Helvetica").fontSize(7.5).text(
      "Dossier sous réserve des droits de l'assuré à la date réelle des soins et ce, conformément aux clauses, exclusions et limites des plafonds du contrat",
      left, yCond + 16, { width },
    );
    const ySig = yCond + 40;
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text(`Signature et cachet de ${p.nom}`, left, ySig, { width: colW - 10 });
    doc.text("Signature du Bénéficiaire", left + colW + 10, ySig, { width: colW - 10 });
    const signatureGestionnaire = await this.chargerSignatureUtilisateur(accord.demandeurId);
    if (signatureGestionnaire) { try { doc.image(signatureGestionnaire, left, ySig + 12, { fit: [colW - 20, 40] }); } catch { /* jamais bloquant */ } }
    const signatureAssure = await this.chargerSignatureAssure(accord.assureId);
    if (signatureAssure) { try { doc.image(signatureAssure, left + colW + 10, ySig + 12, { fit: [colW - 20, 40] }); } catch { /* jamais bloquant */ } }

    doc.end();
  }

  // Taux de couverture affiché sur le certificat (2026-09) — pas de champ
  // dédié sur AccordPrealable : dérivé du ratio remboursé/frais réels déjà
  // arrêté ligne par ligne (plafondReference/montantDevis), cohérent par
  // construction avec le tableau affiché juste en dessous plutôt qu'une
  // seconde source (le taux de la Garantie du contrat) qui pourrait diverger
  // visuellement du tableau en cas de plafond partiellement atteint.
  private tauxCouverturePriseEnCharge(lignes: { plafondReference: Prisma.Decimal; montantDevis: Prisma.Decimal }[]): number | null {
    if (lignes.length === 0) return null;
    const totalFrais = lignes.reduce((s, l) => s + Number(l.montantDevis), 0);
    const totalRemb = lignes.reduce((s, l) => s + Number(l.plafondReference), 0);
    if (totalFrais <= 0) return null;
    return Math.round((totalRemb / totalFrais) * 100);
  }

  // Numéro de sinistre PARTAGÉ par tous les décomptes d'un même (contrat,
  // exercice) — (2026-09) voir demande utilisateur : "les référence [de
  // sinistre] sont plutôt celle des décomptes, ça ne doit pas être le cas...
  // la référence du numéro du sinistre... doit être générée pour chaque
  // contrat à chaque nouvel exercice. Une façon de retracer par une seule
  // référence le montant total des sinistres d'un contrat au cours d'un
  // exercice." Auparavant : un numeroSinistre nouveau par décompte (une
  // facture/assuré), donc une référence DIFFÉRENTE par bénéficiaire sur un
  // même contrat/période — désormais une seule référence par Exercice
  // (Exercice.numeroSinistre), générée au premier décompte qui en a besoin
  // et réutilisée pour tous les suivants de la même période. `dateFr` = la
  // date du SOIN (pas la date de réception de la facture), pour rattacher
  // le sinistre à l'exercice réellement en vigueur au moment des faits.
  private async obtenirOuCreerNumeroSinistre(contratId: string, dateFr: string): Promise<string> {
    const exercices = await this.prisma.exercice.findMany({ where: { contratId } });
    const d = parseDateFr(dateFr);
    const exercice = d
      ? exercices.find((ex) => {
          const deb = parseDateFr(ex.dateDebut), fin = parseDateFr(ex.dateFin);
          return deb && fin && d >= deb && d <= fin;
        })
      : undefined;
    // Repli (aucun exercice ne couvre cette date — donnée de reprise
    // historique, ou exercice non encore créé) : référence dédiée à ce seul
    // décompte plutôt que de bloquer l'édition, jamais partagée ensuite.
    if (!exercice) {
      const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('sinistre_numero_seq') as nextval`;
      return `${String(nextval).padStart(6, "0")} / ${new Date().getFullYear()}`;
    }
    if (exercice.numeroSinistre) return exercice.numeroSinistre;
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('sinistre_numero_seq') as nextval`;
    const annee = exercice.dateDebut.split("/")[2] ?? String(new Date().getFullYear());
    const numero = `${String(nextval).padStart(6, "0")} / ${annee}`;
    await this.prisma.exercice.update({ where: { id: exercice.id }, data: { numeroSinistre: numero } });
    return numero;
  }

  // ── Décompte de Remboursement Maladie ───────────────────────────────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins). Numérotation retrouvée via les migrations encore présentes
  // (decompte_numero_seq "DEC-000001") — un seul Decompte par (factureId,
  // assureId), jamais régénéré (voir schema.prisma Decompte,
  // @@unique([factureId, assureId])).
  private async obtenirOuCreerDecompte(factureId: string, assureId: string, gestionnaireId: string | null, contratId: string, dateSoin: string) {
    const existant = await this.prisma.decompte.findUnique({ where: { factureId_assureId: { factureId, assureId } } });
    if (existant) return existant;

    const [{ nextval: nDec }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('decompte_numero_seq') as nextval`;
    const numeroSinistre = await this.obtenirOuCreerNumeroSinistre(contratId, dateSoin);
    const now = new Date();
    const dateEmission = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const initialesAgent = gestionnaireId
      ? (await this.prisma.user.findUnique({ where: { id: gestionnaireId }, select: { initiales: true } }))?.initiales ?? null
      : null;

    return this.prisma.decompte.create({
      data: {
        numero: `DEC-${String(nDec).padStart(6, "0")}`,
        numeroSinistre,
        factureId, assureId, dateEmission, initialesAgent,
      },
    });
  }

  // `assureId` : restreint au SEUL bénéficiaire concerné (portail assuré —
  // ses propres données uniquement). Omis : TOUS les bénéficiaires de la
  // facture, un décompte par assuré (portail prestataire — voir demande
  // utilisateur : "c'est SA propre déclaration"). `exemplaire` : copie
  // UNIQUE avec cette mention (portail prestataire/assuré, un seul
  // destinataire) ; omis (usage interne) : les 3 copies officielles du
  // modèle de référence ("Modèle décompte.pdf" — Compagnie / Prestataire /
  // Assuré, "Agence" du modèle papier sans équivalent applicatif remplacée
  // par la copie Prestataire, seule partie tierce réelle qui en a besoin).
  async renderDecompteFacture(
    factureId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string },
    assureId?: string, exemplaire?: string,
  ) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: {
        prestataire: true, contrat: { include: { client: true, compagnie: true } },
        // Agence de l'agent qui a établi la facture (2026-09) — voir
        // demande utilisateur : "lier un agent de saisie à une agence...
        // afin que ce soit cette agence qui remonte sur le décompte".
        gestionnaire: { select: { agence: { select: { nom: true } } } },
        lignes: {
          where: { statut: { not: "Annulé" }, ...(assureId ? { assureId } : {}) },
          include: { assure: true, acteMedical: true },
          orderBy: { date: "asc" },
        },
      },
    });
    if (!facture) throw new NotFoundException(`Facture ${factureId} introuvable`);
    if (facture.lignes.length === 0) throw new BadRequestException("Aucune ligne à décompter pour cette sélection.");

    const parAssure = new Map<string, typeof facture.lignes>();
    for (const l of facture.lignes) {
      const arr = parAssure.get(l.assureId);
      if (arr) arr.push(l); else parAssure.set(l.assureId, [l]);
    }
    // Contrat PROPRE à chaque ligne (2026-09) — voir demande utilisateur :
    // "le numéro de police du contrat auquel est lié l'assuré ne remonte
    // pas". `facture.contrat` (en-tête) ne reflète que le contrat déclaré à
    // la création de la facture ; PriseEnCharge.contratId, capturé ligne
    // par ligne à la saisie (voir SanteService.creerLigneFacture), est la
    // source fiable du "contrat auquel est lié l'assuré" pour CETTE
    // prestation précise — résolu ici (pas de relation Prisma directe sur
    // PriseEnCharge.contratId) pour Compagnie/Souscripteur/N° Police.
    const contratIdsLignes = [...new Set(facture.lignes.map((l) => l.contratId))];
    const contratsParId = new Map(
      (await this.prisma.contrat.findMany({ where: { id: { in: contratIdsLignes } }, include: { client: true, compagnie: true } }))
        .map((c) => [c.id, c] as const),
    );
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const editePar = facture.gestionnaireId
      ? (await this.prisma.user.findUnique({ where: { id: facture.gestionnaireId }, select: { nom: true } }))?.nom ?? "—"
      : "Portail Prestataire";
    const exemplairesDecompte = exemplaire ? [exemplaire] : ["Compagnie", "Prestataire", "Assuré"];

    // Reproduction à l'identique du modèle papier ("Modèle décompte.pdf")
    // — voir demande utilisateur : "reproduis à l'identique... n'invente
    // pas... exactement les mêmes formes de tableau". Le modèle de
    // référence est en PAYSAGE (841.92 × 595.32 pt), pas en portrait —
    // erreur structurelle des rondes précédentes, corrigée ici. Toutes les
    // positions ci-dessous sont mesurées au point près sur le PDF de
    // référence (extraction pdfplumber), converties en fractions de la
    // largeur/hauteur utile pour rester correctes quelle que soit la
    // longueur des données réelles.
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 21 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Decompte-${facture.id}.pdf"`);
    doc.pipe(res);

    let premierePage = true;
    for (const [idAssure, lignesAssure] of parAssure) {
      const premiereLigne = lignesAssure[0] as unknown as { nSinistre: string | null; nDeclaration: string | null; date: string };
      // Contrat/date DU SOIN (pas celui de la facture) — même contrat que
      // celui déjà utilisé ci-dessous pour Compagnie/Souscripteur/N° Police
      // (lignesAssure[0].contratId), pour rattacher le sinistre au bon
      // exercice (voir obtenirOuCreerNumeroSinistre).
      const decompte = await this.obtenirOuCreerDecompte(factureId, idAssure, facture.gestionnaireId, lignesAssure[0].contratId, premiereLigne.date);
      const assure = lignesAssure[0].assure;
      const contratAssure = contratsParId.get(lignesAssure[0].contratId)!;

      for (const copie of exemplairesDecompte) {
      if (!premierePage) doc.addPage(); else premierePage = false;

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      this.dessinerLogoEntete(doc, logoImage, left, 8);
      // Identité affichée en en-tête (2026-09) — voir demande utilisateur :
      // "faire remonter le logo et le vrai nom de la société qui assure et
      // gère les dossiers, et non la compagnie d'assurance si le client est
      // un courtier". Toujours le COURTIER/mutuelle réel (tenant courant,
      // `p`), jamais un repli vers `contrat.compagnie.nom` (mélangerait
      // courtier et assureur porteur du risque — voir même correctif sur
      // genererFormulaire).
      const nomAffiche = p.nom;
      doc.fillColor("#000").fontSize(13).font("Helvetica");
      const nomW = doc.widthOfString(nomAffiche);
      doc.text(nomAffiche, left, 31);
      doc.fontSize(8).text("Service Maladie", left, 50);
      doc.text(`Tél.: ${p.telephone}`, left, 61);

      // Titre — même position relative que le modèle (43,6 % depuis la
      // marge gauche), avec un filet de sécurité si le nom de la société
      // est nettement plus long que "LA RUCHE EXCELLENCE". Gras — voir
      // demande utilisateur (annotation "Mettre en gras").
      const titreX = left + Math.max(width * 0.436, nomW + 40);
      const titreW = right - titreX;
      doc.font("Helvetica-Bold").fontSize(11).text("DÉCOMPTE DE REMBOURSEMENT MALADIE", titreX, 29, { width: titreW, align: "center" });
      doc.font("Helvetica").fontSize(9).text("TRAITEMENT DE FACTURE", titreX, 45, { width: titreW, align: "center" });
      // Référence du décompte (2026-09) — voir demande utilisateur : "corrige
      // également la référence du décompte". `decompte.numero` (séquence
      // dédiée "DEC-000001", voir obtenirOuCreerDecompte) n'était affiché
      // NULLE PART sur le document — corrigé, imprimé sous la date.
      doc.fontSize(8).text(`Date      ${decompte.dateEmission}`, titreX, 57, { width: titreW, align: "center" });
      doc.font("Helvetica-Bold").text(`N°      ${decompte.numero}`, titreX, 68, { width: titreW, align: "center" });

      // Encadré : grille 3 colonnes (19,4 % / 40,4 % / 40,2 %, mesures
      // exactes du modèle) — Compagnie/Agence/N°Police · Souscripteur/
      // N°Sinistre+Famille/Bénéficiaire+Matricule · N°Déclaration/Nature
      // maladie/Début des soins — PUIS une 4e ligne pleine largeur
      // (Facture N°/Fournisseur), sans séparateur vertical.
      const y0 = 93.6;
      const col1W = width * 0.194, col2W = width * 0.404, col3W = width - col1W - col2W;
      const c1x = left + 8, c2x = left + col1W + 8, c3x = left + col1W + col2W + 8;
      const familleNom = assure.nom.split(" ")[0];

      doc.font("Helvetica").fontSize(8);
      // Col.1 : "Compagnie"/"Agence :"/"N° Police :" en label+valeur
      // EMPILÉS (jamais sur une seule ligne) — la colonne, étroite dans le
      // modèle papier (valeurs courtes du type "4595 OGAR"), reçoit ici des
      // valeurs réelles bien plus longues ("BGFI ASSURANCES") : les empiler
      // préserve la position/groupement du modèle sans les faire déborder
      // ni les tronquer (piège déjà rencontré — voir capture utilisateur
      // du 2026-09-13).
      // Cellules DYNAMIQUES (2026-09) — voir demande utilisateur : "si le
      // code [la donnée] est long c'est la cellule qui doit être dynamique
      // ... on ne peut pas troquer une information aussi capitale. C'est
      // valable pour toutes les autres zones... décompte, règlement". Les
      // anciens décalages verticaux FIXES (+19/+37) entre les 3 lignes
      // empilées de chaque colonne cassaient dès qu'une valeur réelle
      // (nom de compagnie, société, bénéficiaire long) s'enroulait sur 2
      // lignes — chaque helper ci-dessous mesure la hauteur réellement
      // occupée (`doc.heightOfString`) et retourne le y suivant, jamais un
      // pas fixe.
      const champEmpile = (x: number, yTop: number, label: string, valeur: string): number => {
        const valW = col1W - 12;
        doc.font("Helvetica").fontSize(6.5).fillColor("#666").text(label, x, yTop, { width: valW });
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000").text(valeur, x, yTop + 8, { width: valW });
        return yTop + 8 + Math.max(doc.heightOfString(valeur, { width: valW }), 9);
      };
      const champLigne = (x: number, y: number, label: string, valeur: string, w: number, boldValeur = false): number => {
        doc.font("Helvetica").fontSize(8).fillColor("#000").text(label, x, y);
        const labelW = doc.widthOfString(label) + 4;
        const valW = Math.max(20, w - labelW);
        doc.font(boldValeur ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(valeur, x + labelW, y, { width: valW });
        return y + Math.max(doc.heightOfString(valeur, { width: valW }), 9);
      };
      const champEmpileLarge = (x: number, yTop: number, label: string, valeur: string, w: number): number => {
        doc.font("Helvetica").fontSize(8).fillColor("#000").text(label, x, yTop);
        doc.font("Helvetica-Bold").text(valeur, x, yTop + 11, { width: w });
        return yTop + 11 + Math.max(doc.heightOfString(valeur, { width: w }), 10);
      };

      let rowY = y0 + 4;
      const b1a = champEmpile(c1x, rowY, "Compagnie", contratAssure.compagnie.nom);
      const b1b = champLigne(c2x, rowY + 1, "Souscripteur :", contratAssure.client.nom, col2W - 12);
      // "N° Déclaration" (2026-09) — voir demande utilisateur : "corrige
      // également la référence du décompte... le N° de déclaration ne
      // remonte pas". Aucune séquence dédiée n'existe pour ce champ (à la
      // différence de N° Sinistre, voir decompte.numeroSinistre) — seule
      // source réelle : la saisie manuelle PriseEnCharge.nDeclaration
      // (facultative, voir FactureSaisie.tsx). À défaut, on retombe sur la
      // référence du décompte lui-même (decompte.numero) plutôt que "—",
      // pour ne jamais laisser ce champ visuellement vide.
      const b1c = champLigne(c3x, rowY + 1, "N° Déclaration", premiereLigne.nDeclaration ?? decompte.numero, col3W - 12);
      rowY = Math.max(b1a, b1b, b1c) + 4;

      // "Agence" (2026-09) — voir demande utilisateur : "lier un agent de
      // saisie à une agence... afin que ce soit cette agence qui remonte
      // sur le décompte". Agence de l'agent qui a établi la facture (User.
      // agenceId) ; "—" tant qu'aucune agence ne lui est assignée, jamais
      // de valeur inventée.
      const b2a = champEmpile(c1x, rowY, "Agence", facture.gestionnaire?.agence?.nom ?? "—");
      // "N° Sinistre" (2026-09) — corrige la même erreur que "N° Ordre Mvt"
      // du Règlement (voir demande utilisateur "corrige également la
      // référence du décompte") : affichait le champ manuel PriseEnCharge.
      // nSinistre (saisi au cas par cas, presque toujours vide → "—" en
      // pratique) au lieu de decompte.numeroSinistre, la SÉQUENCE DÉDIÉE
      // générée pour ce document (sinistre_numero_seq, "000001 / 2026",
      // toujours renseignée — voir obtenirOuCreerDecompte).
      const b2b = champLigne(c2x, rowY + 1, "N° Sinistre :", `${decompte.numeroSinistre}      Famille   ${familleNom}`, col2W - 12);
      // Nature de l'affection jamais affichée telle quelle (voir
      // schema.prisma PriseEnCharge.natureMaladie) — toujours "Affection
      // Courante" par confidentialité, quelle que soit la vraie valeur.
      const b2c = champLigne(c3x, rowY + 1, "Nature maladie :", "Affection Courante", col3W - 12);
      rowY = Math.max(b2a, b2b, b2c) + 4;

      const b3a = champEmpile(c1x, rowY, "N° Police", contratAssure.numeroPolice ?? contratAssure.id);
      const b3b = champEmpileLarge(c2x, rowY, "Bénéficiaire des soins :", `${assure.nom} ${assure.prenom ?? ""}`.trim() + `  -  Matricule : ${assure.matricule}`, col2W - 12);
      const b3c = champLigne(c3x, rowY + 1, "Début des soins :", premiereLigne.date, col3W - 12);
      rowY = Math.max(b3a, b3b, b3c) + 6;
      doc.fillColor("#000");

      const ligneY = rowY;
      const factureLigneTexte = `Facture N°   ${referenceLisible(facture.referenceFacture)}          Fournisseur   ${facture.prestataire.nom}`;
      const factureLigneW = width - 16;
      doc.font("Helvetica").fontSize(8).text(factureLigneTexte, left + 8, ligneY + 8, { width: factureLigneW });
      const boxBottom = ligneY + 8 + Math.max(doc.heightOfString(factureLigneTexte, { width: factureLigneW }), 11) + 6;
      doc.rect(left, y0, width, boxBottom - y0).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(left + col1W, y0).lineTo(left + col1W, ligneY).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(left + col1W + col2W, y0).lineTo(left + col1W + col2W, ligneY).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(left, ligneY).lineTo(right, ligneY).strokeColor("#000").lineWidth(0.7).stroke();
      let y = boxBottom + 14;

      // Tableau — 8 colonnes, largeurs EXACTES du modèle de référence
      // (42,4 / 7,6 / 7,4 / 5,3 / 9,2 / 9,2 / 8,6 / 10,3 %). "Base TPS"
      // (col. 6) reçoit un encadré renforcé sur toute la hauteur du
      // tableau, comme sur le modèle — seule colonne mise en valeur.
      const cols = [
        { h: "Date soins   Désignation prestations", w: width * 0.424 }, { h: "Montant", w: width * 0.076 }, { h: "Base Remb.", w: width * 0.074 },
        { h: "%", w: width * 0.053 }, { h: "Ticket Modér.", w: width * 0.092 }, { h: "Base TPS", w: width * 0.092 },
        { h: "Montant TPS -> 9,50", w: width * 0.086 }, { h: "Net à payer", w: width * 0.103 },
      ];
      const tableTop = y;
      let cx = left;
      doc.fillColor("#000").fontSize(6.8).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 3, y + 5, { width: c.w - 6, align: cx === left ? "left" : "center" }); cx += c.w; }
      y += 26;
      doc.moveTo(left, tableTop).lineTo(right, tableTop).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();

      doc.font("Helvetica").fontSize(7.5);
      let totalBaseRemb = 0, totalTicket = 0, totalBaseTps = 0, totalTps = 0, totalNet = 0;
      for (const l of lignesAssure) {
        const montant = Number(l.montant);
        const baseRemb = montant - Number(l.montantRejete ?? 0);
        const baseTps = l.baseRemboursement !== null ? Number(l.baseRemboursement) : 0;
        const taux = l.tauxRemboursement !== null ? Number(l.tauxRemboursement) : null;
        const ticket = baseRemb - baseTps;
        const tps = l.montantTps !== null ? Number(l.montantTps) : 0;
        const net = baseTps - tps;
        totalBaseRemb += baseRemb; totalTicket += ticket; totalBaseTps += baseTps; totalTps += tps; totalNet += net;
        const valeurs = [
          `${l.date}  ${l.acteMedical?.libelle ?? l.type}`, fmt(montant), fmt(baseRemb), taux !== null ? String(taux) : "—",
          fmt(ticket), fmt(baseTps), tps > 0 ? fmt(tps) : "—", fmt(net),
        ];
        // Hauteur de ligne DYNAMIQUE (2026-09) — un libellé d'acte réel
        // peut dépasser la largeur de la colonne 0 et s'enrouler sur
        // plusieurs lignes ; une hauteur fixe (20pt) ferait chevaucher la
        // ligne suivante au lieu de tronquer une donnée — voir demande
        // utilisateur "C'est valable pour toutes les autres zones... du
        // décompte".
        const rowH2 = Math.max(20, doc.heightOfString(valeurs[0], { width: cols[0].w - 6 }) + 10);
        if (y + rowH2 > doc.page.height - 130) { doc.addPage(); y = 40; }
        cx = left;
        for (let i = 0; i < cols.length; i++) {
          doc.text(valeurs[i], cx + 3, y + 6, { width: cols[i].w - 6, align: i === 0 ? "left" : "right" });
          cx += cols[i].w;
        }
        y += rowH2;
      }
      // Ligne TOTAL — "Montant" et "%" restent VOLONTAIREMENT vides, comme
      // sur le modèle de référence (seuls Base Remb./Ticket/Base TPS/
      // Montant TPS/Net à payer sont additionnés).
      doc.font("Helvetica-Bold").fontSize(7.5);
      doc.text("TOTAL", left, y + 6, { width: cols[0].w + cols[1].w - 6, align: "right" });
      cx = left + cols[0].w + cols[1].w;
      const totaux = [fmt(totalBaseRemb), "", fmt(totalTicket), fmt(totalBaseTps), totalTps > 0 ? fmt(totalTps) : "—", fmt(totalNet)];
      for (let i = 0; i < totaux.length; i++) { doc.text(totaux[i], cx + 3, y + 6, { width: cols[i + 2].w - 6, align: "right" }); cx += cols[i + 2].w; }
      y += 22;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();

      cx = left;
      for (let i = 0; i <= cols.length; i++) {
        doc.moveTo(cx, tableTop).lineTo(cx, y).strokeColor("#000").lineWidth(0.5).stroke();
        if (i < cols.length) cx += cols[i].w;
      }
      const baseTpsX = left + cols.slice(0, 5).reduce((s, c) => s + c.w, 0);
      doc.rect(baseTpsX, tableTop, cols[5].w, y - tableTop).strokeColor("#000").lineWidth(1.2).stroke();
      y += 32;

      const now = new Date();
      const footerX = left + width * 0.627;
      doc.font("Helvetica").fontSize(8).text("Fait et signé à libreville le", footerX, y, { continued: true }).text(`      ${now.toLocaleDateString("fr-FR")}`);
      doc.font("Helvetica-Bold").text("POUR LA DIRECTION", footerX, y + 18);
      await this.dessinerSignatureElectronique(doc, left, y, "Décompte de remboursement", `${factureId}/${idAssure}`, utilisateur);

      doc.font("Helvetica").fontSize(9).text(`Exemplaire ${copie}`, left, doc.page.height - 45);
      }
    }

    doc.end();
  }

  // ── Relevé Prestataire ───────────────────────────────────────────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins). Montant par facture = NET À PAYER (base remboursement -
  // TPS), jamais les frais réels (voir feedback-montant-net-a-payer).
  private async donneesReleve(releveId: string) {
    const releve = await this.prisma.relevePrestataire.findUnique({
      where: { id: releveId },
      include: {
        prestataire: true, client: true,
        factures: {
          where: { statut: { not: "Annulée" } },
          include: { lignes: { where: { statut: { not: "Annulé" } } } },
          orderBy: { dateReception: "asc" },
        },
      },
    });
    if (!releve) throw new NotFoundException(`Relevé ${releveId} introuvable`);
    const lignes = releve.factures.map((f) => {
      const net = f.lignes.reduce((s, l) => s + (l.baseRemboursement !== null ? Number(l.baseRemboursement) : 0) - (l.montantTps !== null ? Number(l.montantTps) : 0), 0);
      return { reference: f.referenceFacture, dateReception: f.dateReception, nbLignes: f.lignes.length, net };
    });
    const total = lignes.reduce((s, l) => s + l.net, 0);
    return { releve, lignes, total };
  }

  async renderRelevePrestataire(releveId: string, res: Response, _utilisateur: { id: string | null; nom: string; roleId: string }, format: "pdf" | "xlsx" = "pdf") {
    const { releve, lignes, total } = await this.donneesReleve(releveId);

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Relevé");
      ws.columns = [
        { header: "Référence facture", key: "reference", width: 24 },
        { header: "Date de réception", key: "dateReception", width: 18 },
        { header: "Nb lignes", key: "nbLignes", width: 12 },
        { header: "Net à payer (FCFA)", key: "net", width: 20 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const l of lignes) ws.addRow(l);
      ws.addRow({ reference: "TOTAL", net: total });
      ws.getRow(ws.rowCount).font = { bold: true };
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Releve-${releve.numero}.xlsx"`);
      res.send(Buffer.from(buffer));
      return;
    }

    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Releve-${releve.numero}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(8).font("Helvetica").fillColor("#333").text(p.sousTitre, left, 56);
    doc.rect(right - 200, 40, 200, 30).fill(p.couleurPrimaire);
    doc.fillColor("#fff").fontSize(11).font("Helvetica-Bold").text("RELEVÉ PRESTATAIRE", right - 200, 47, { width: 200, align: "center" });
    doc.fontSize(8).text(`N° ${releve.numero}`, right - 200, 62, { width: 200, align: "center" });
    doc.fillColor("#000");

    let y = 90;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
    y += 10;
    let yy = champ(doc, left, y, "Prestataire :", releve.prestataire.nom, 90, 250, { boldLabel: true, boldValeur: true });
    yy = champ(doc, left, yy, "Souscripteur :", releve.client.nom, 90, 250, { boldLabel: true });
    yy = champ(doc, left, yy, "Période :", releve.periode, 90, 250, { boldLabel: true });
    champ(doc, left + 320, y, "Date :", releve.dateCreation, 60, 150, { boldLabel: true });
    y = yy + 12;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
    y += 10;

    const cols = [{ h: "Référence facture", w: width * 0.35 }, { h: "Date de réception", w: width * 0.25 }, { h: "Nb lignes", w: width * 0.15 }, { h: "Net à payer", w: width * 0.25 }];
    doc.rect(left, y, width, 16).fill(p.couleurPrimaire);
    let cx = left;
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    for (const c of cols) { doc.text(c.h, cx + 4, y + 4, { width: c.w - 8, align: cx === left ? "left" : "right" }); cx += c.w; }
    doc.fillColor("#000");
    y += 16;

    doc.font("Helvetica").fontSize(8);
    for (const l of lignes) {
      const rowH = 16;
      if (y + rowH > doc.page.height - 100) { doc.addPage(); y = 40; }
      cx = left;
      const valeurs = [l.reference, l.dateReception, String(l.nbLignes), fmt(l.net)];
      for (let i = 0; i < cols.length; i++) { doc.text(valeurs[i], cx + 4, y + 4, { width: cols[i].w - 8, align: i === 0 ? "left" : "right" }); cx += cols[i].w; }
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#eee").stroke();
      y += rowH;
    }
    y += 10;
    doc.font("Helvetica-Bold").fontSize(10);
    champ(doc, right - 250, y, "NET TOTAL À PAYER :", fmt(total), 150, 100, { boldLabel: true, boldValeur: true, alignValeur: "right" });

    doc.end();
  }

  // ── Export DOCX (2026-09) — Quittance / Avenant / Tableau de garanties ──
  // Version simplifiée (paragraphes + tableau des faits clés), pas une
  // reproduction pixel-à-pixel de la mise en page PDF à 4 exemplaires — le
  // Word reste un export "éditable", jamais le document opposable (le PDF).
  private async envoyerDocx(res: Response, filename: string, titre: string, sousTitre: string, champsCles: [string, string][], tableau?: { headers: string[]; rows: string[][] }) {
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: titre, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: sousTitre, spacing: { after: 200 } }),
    ];
    for (const [label, valeur] of champsCles) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${label} `, bold: true }), new TextRun(valeur)] }));
    }
    if (tableau) {
      children.push(new Paragraph({ text: "", spacing: { before: 200 } }));
      const ligneEntete = new TableRow({ children: tableau.headers.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) });
      const lignesData = tableau.rows.map((row) => new TableRow({ children: row.map((v) => new TableCell({ children: [new Paragraph(v)] })) }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [ligneEntete, ...lignesData] }));
    }
    const document = new DocxDocument({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(document);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.docx"`);
    res.send(buffer);
  }

  private async genererQuittanceDocx(res: Response, opts: { kind: MouvementKind; contrat: DocContrat; avenant: DocAvenant | null; numero: number; personnes: { nom: string; prenom?: string | null; typeAssure?: string | null }[] }) {
    const { kind, contrat, avenant } = opts;
    const numeroQuittance = avenant ? await this.numeroQuittanceAvenant(avenant) : await this.numeroQuittanceContrat(contrat);
    const dateEffet = avenant ? avenant.dateEffet : contrat.dateDebut;
    const primeNette = Number(avenant ? avenant.primeApres : (contrat.primeNette ?? contrat.prime));
    await this.envoyerDocx(res, `Quittance-${avenant?.id ?? contrat.id}`, kind === "AffaireNouvelle" ? "QUITTANCE — AFFAIRE NOUVELLE" : `QUITTANCE — AVENANT ${AVENANT_META[kind].suffixe}`, `Police N° ${contrat.id}`, [
      ["Souscripteur :", contrat.client.nom],
      ["Compagnie :", contrat.compagnie.nom],
      ["Quittance N° :", String(numeroQuittance)],
      ["Effet :", dateEffet],
      ["Échéance :", contrat.dateFin],
      ["Prime nette :", `${fmt(primeNette)} FCFA`],
    ]);
  }

  private async genererAvenantDocx(res: Response, avenant: DocAvenant, numero: number, meta: { code: string; suffixe: string; estRistourne: boolean }) {
    await this.envoyerDocx(res, `Avenant-${avenant.id}`, `AVENANT ${meta.suffixe} N° ${String(numero).padStart(3, "0")}`, `Police N° ${avenant.contratId}`, [
      ["Souscripteur :", avenant.contrat.client.nom],
      ["Compagnie :", avenant.contrat.compagnie.nom],
      ["Effet :", avenant.dateEffet],
      ["Échéance :", avenant.contrat.dateFin],
      ["Prime après avenant :", `${fmt(Number(avenant.primeApres))} FCFA`],
    ]);
  }

  private async genererTableauGarantiesDocx(res: Response, contrat: DocContrat) {
    await this.envoyerDocx(res, `Tableau-Garanties-${contrat.id}`, `TABLEAU DE GARANTIES — ${contrat.branche.toUpperCase()}`, `Police N° ${contrat.id}   ·   ${contrat.client.nom}`, [
      ["Compagnie :", contrat.compagnie.nom],
      ["Effet :", contrat.dateDebut],
      ["Échéance :", contrat.dateFin],
    ], {
      headers: ["Prestation", "Taux assuré", "Plafond"],
      rows: contrat.garanties.map((g) => [g.libelle, g.tauxAssure !== null ? `${g.tauxAssure}%` : "Selon garantie", g.plafond ?? "—"]),
    });
  }

  // ── Facture de Production (commission courtier) ─────────────────────
  // Reconstruction (2026-09) — voir demande utilisateur : "documents à
  // revoir selon modèle et à reproduire exactement comme sur les modèles",
  // réponse "c'est le modèle de la facture production, faite à la suite
  // d'un mouvement de production" sur "FACTURE SANTE MP 1ER TRIM 2026.pdf"
  // (modèle NSIA : "POLICE MALADIE N°1000652 (Non Cadres)" est littéralement
  // l'exemple documenté sur FactureProductionLigne.libelle). La version
  // précédente imprimait le papier en-tête de MedAssur (`p` =
  // ParametresEntreprise) — CONTRAIRE au commentaire du schéma sur
  // Compagnie ("papier en-tête / pied de page légal... jamais sur les
  // documents MedAssur") : corrigé ici, tout l'habillage vient de la
  // COMPAGNIE (logo, raison sociale, adresse, RIB, pied de page légal
  // verbatim si renseigné).
  async renderFactureProduction(id: string, res: Response) {
    const facture = await this.prisma.factureProduction.findUnique({
      where: { id },
      include: { compagnie: true, client: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    if (!facture) throw new NotFoundException(`Facture de production ${id} introuvable`);
    const c = facture.compagnie;
    const annee = facture.dateEmission.split("/")[2] ?? new Date().getFullYear();
    const total = facture.lignes.reduce((s, l) => s + Number(l.montant), 0);
    const logoImage = await this.chargerImage("logos", c.logo, UPLOADS_LOGOS_COMPAGNIES_DIR);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Facture-Production-${facture.numero}-${annee}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    if (logoImage) this.dessinerLogoEntete(doc, logoImage, left, 8, 34);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#000").text(c.raisonSociale ?? c.nom, left + (logoImage ? 42 : 0), 40, { width: width - (logoImage ? 42 : 0) });
    doc.fontSize(9).font("Helvetica").text(`${facture.lieuEmission}, le ${facture.dateEmission}`, left, 40, { width, align: "right" });

    // Bloc destinataire — encadré, comme le modèle (coins arrondis).
    const boxX = right - 220, boxY = 70, boxW = 220;
    const adresseLignes = [
      c.boitePostale || c.adresseSiege ? `BP : ${c.boitePostale ?? c.adresseSiege}` : null,
      facture.client.nif ? `NIF : ${facture.client.nif}` : null,
      [facture.client.ville, facture.client.pays].filter(Boolean).join(" / ") || null,
    ].filter((l): l is string => !!l);
    const boxH = 20 + adresseLignes.length * 13;
    doc.roundedRect(boxX, boxY, boxW, boxH, 6).strokeColor("#999").lineWidth(0.7).stroke();
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(10).text(facture.client.nom, boxX + 10, boxY + 8, { width: boxW - 20 });
    doc.font("Helvetica").fontSize(8.5);
    let by = boxY + 22;
    for (const l of adresseLignes) { doc.text(l, boxX + 10, by, { width: boxW - 20 }); by += 12; }

    let y = boxY + boxH + 30;
    doc.font("Helvetica-Bold").fontSize(13).text(`FACTURE N° ${facture.numero}/${annee}`, left, y, { width, align: "center" });
    y += 18;
    doc.font("Helvetica").fontSize(9).text("*" + "=*".repeat(20), left, y, { width, align: "center" });
    y += 16;
    if (facture.referenceBonReception) { doc.font("Helvetica-Bold").fontSize(9).text(`Bon de Réception ${facture.referenceBonReception}`, left, y, { width, align: "center" }); y += 13; }
    if (facture.referenceBonCommande) { doc.text(`Bon de commande ${facture.referenceBonCommande}`, left, y, { width, align: "center" }); y += 13; }
    y += 12;

    doc.font("Helvetica-Bold").fontSize(10).text(facture.objet.toUpperCase(), left, y, { underline: true });
    y += 16;
    const libellesPrime: Record<string, string> = {
      "1ère échéance": "PRIME PREMIERE ECHEANCE", "2ème échéance": "PRIME DEUXIEME ECHEANCE",
      "3ème échéance": "PRIME TROISIEME ECHEANCE", "4ème échéance": "PRIME QUATRIEME ECHEANCE",
    };
    if (libellesPrime[facture.typePaiement]) { doc.font("Helvetica-Bold").fontSize(10).text(libellesPrime[facture.typePaiement], left, y, { underline: true }); y += 20; }
    else y += 6;

    doc.font("Helvetica").fontSize(9);
    for (const l of facture.lignes) {
      if (y > doc.page.height - 220) { doc.addPage(); y = 40; }
      doc.font("Helvetica-Bold").fontSize(9.5).text(l.libelle, left, y, { width });
      y += 13;
      doc.font("Helvetica").fontSize(8).fillColor("#666").text("=*".repeat(26), left, y);
      doc.fillColor("#000");
      y += 13;
      const periode = l.periodeDebut && l.periodeFin ? `Prime du ${l.periodeDebut} au ${l.periodeFin}` : "";
      doc.font("Helvetica").fontSize(9).text(periode, left, y, { width: width - 160 });
      doc.text(`${fmt(l.montant)} FCFA`, right - 150, y, { width: 150, align: "right" });
      y += 22;
    }

    doc.moveTo(right - 170, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(10).text("MONTANT TOTAL A PAYER", left, y, { width: width - 160 });
    doc.text(`${fmt(total)} FCFA`, right - 150, y, { width: 150, align: "right" });
    y += 26;

    doc.font("Helvetica").fontSize(9).text("Arrêtée le présent devis à la somme de :", left, y, { width });
    y += 13;
    doc.font("Helvetica-Bold").fontSize(9).text(montantEnLettresFcfa(total) + ".", left, y, { width, underline: true });
    y += 26;

    if (c.banqueNom || c.banqueNumeroCompte) {
      doc.font("Helvetica-BoldOblique").fontSize(9).text(`N° Compte ${c.banqueNom ?? ""} ${c.banqueNumeroCompte ?? ""}`.trim(), left, y, { width });
      y += 22;
    }

    doc.font("Helvetica").fontSize(8.5);
    if (facture.notePaiement) { doc.text(`NB : ${facture.notePaiement}`, left, y, { width }); y += doc.heightOfString(`NB : ${facture.notePaiement}`, { width }) + 8; }
    doc.text(`En cas de règlement par chèque, prière de l'établir à l'ordre de la compagnie ${c.nom}.`, left, y, { width });
    y += 30;

    doc.font("Helvetica-Bold").fontSize(9).text("POUR LA COMPAGNIE", right - 180, y, { width: 180, align: "right" });

    // Pied de page légal — texte EXACT de la compagnie si renseigné
    // (prioritaire, voir schema.prisma Compagnie.piedDePageLegal), sinon
    // reconstruit à partir des champs structurés.
    const bas = doc.page.height - 55;
    doc.fontSize(7).font("Helvetica").fillColor("#555");
    if (c.piedDePageLegal) {
      doc.text(c.piedDePageLegal, left, bas - (doc.heightOfString(c.piedDePageLegal, { width }) - 9), { width, align: "center" });
    } else {
      const ligne1 = [c.raisonSociale ?? c.nom, c.capitalSocial ? `au capital de ${c.capitalSocial}` : null].filter(Boolean).join(" — ");
      const ligne2 = [c.adresseSiege, c.boitePostale ? `BP ${c.boitePostale}` : null, c.ville].filter(Boolean).join(" · ");
      const ligne3 = [c.telephone ? `Tél : ${c.telephone}` : null, c.fax ? `Fax : ${c.fax}` : null, c.rccm ? `RCCM ${c.rccm}` : null, c.statistique ? `Stat. ${c.statistique}` : null].filter(Boolean).join(" · ");
      const ligne4 = [c.siteWeb, c.emailContact].filter(Boolean).join(" · ");
      [ligne1, ligne2, ligne3, ligne4].filter(Boolean).forEach((l, i) => doc.text(l, left, bas - 27 + i * 9, { width, align: "center" }));
    }
    doc.fillColor("#000");

    doc.end();
  }

  // ── Liste des Assurés (export population) ───────────────────────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins) — "la société doit pouvoir générer, télécharger et imprimer
  // la liste de ses bénéficiaires (liste totale, liste par type de statut)".
  // du/au (2026-09) — voir demande utilisateur : "on doit pouvoir éditer une
  // liste pour un contrat par rapport à un exercice spécifique et à un
  // intervalle de date précis. Ce qui fait que pour 2024 par exemple on
  // peut avoir une certaine population et en 2026 on en a une autre."
  // Reconstitue la population TELLE QU'ELLE ÉTAIT sur cette période (voir
  // reconstituerPopulation, déjà utilisé côté écran mais jamais câblé sur
  // cet export) au lieu de toujours lire la population ACTUELLE — c'était
  // le bug : du/au étaient reçus par le frontend mais jamais transmis
  // jusqu'ici (voir DocumentsController.population).
  async renderPopulationExport(contratId: string, format: "pdf" | "xlsx" | "docx", res: Response, filtres: { statut?: string; du?: string; au?: string }) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: contratId }, include: { client: true } });
    if (!contrat) throw new NotFoundException(`Contrat ${contratId} introuvable`);
    const population = await reconstituerPopulation(this.prisma, contratId, filtres.du, filtres.au);
    const assures = population
      .filter((a) => !filtres.statut || a.statutPeriode === filtres.statut)
      .sort((a, b) => (a.familleId ?? "").localeCompare(b.familleId ?? "") || (a.typeAssure ?? "").localeCompare(b.typeAssure ?? "") || a.nom.localeCompare(b.nom));
    const periodeTexte = filtres.du || filtres.au ? ` — période du ${filtres.du ?? "…"} au ${filtres.au ?? "…"}` : "";
    const titre = `Liste des Assurés${filtres.statut ? ` — ${filtres.statut}` : ""}${periodeTexte}`;
    // Police N° = le vrai numéro de police compagnie (2026-09) — voir
    // demande utilisateur répétée : "là où il y a N° Police, c'est le
    // numéro de police compagnie du contrat qui doit remonter" — cet export
    // affichait encore contrat.id brut, jamais numeroPolice.
    const sousTitre = `${contrat.client.nom}   ·   Police N° ${contrat.numeroPolice || contrat.id}   ·   ${assures.length} bénéficiaire(s)`;
    const rows = assures.map((a) => [a.matricule, `${a.nom} ${a.prenom ?? ""}`.trim(), TYPE_ASSURE_LABELS[a.typeAssure ?? ""] ?? a.typeAssure ?? "—", a.dateNaissance ?? "—", a.statutPeriode]);

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Assurés");
      ws.columns = [
        { header: "Matricule", key: "matricule", width: 18 }, { header: "Nom et Prénom", key: "nom", width: 30 },
        { header: "Type", key: "type", width: 16 }, { header: "Date de naissance", key: "naissance", width: 18 }, { header: "Statut", key: "statut", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const r of rows) ws.addRow(r);
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Liste-Assures-${contrat.id}.xlsx"`);
      res.send(Buffer.from(buffer));
      return;
    }
    if (format === "docx") {
      return this.envoyerDocx(res, `Liste-Assures-${contrat.id}`, titre, sousTitre, [], { headers: ["Matricule", "Nom et Prénom", "Type", "Naissance", "Statut"], rows });
    }

    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Liste-Assures-${contrat.id}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text(titre, left, 60, { width, align: "right" });
    doc.fontSize(8).font("Helvetica").fillColor("#555").text(sousTitre, left, 74, { width, align: "right" });
    doc.fillColor("#000");

    let y = 95;
    const cols = [{ h: "Matricule", w: width * 0.18 }, { h: "Nom et Prénom", w: width * 0.35 }, { h: "Type", w: width * 0.15 }, { h: "Naissance", w: width * 0.16 }, { h: "Statut", w: width * 0.16 }];
    const drawHeader = () => {
      doc.rect(left, y, width, 16).fill(p.couleurPrimaire);
      let cx = left;
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 4, y + 4, { width: c.w - 8 }); cx += c.w; }
      doc.fillColor("#000");
      y += 16;
    };
    drawHeader();

    doc.font("Helvetica").fontSize(8);
    for (const r of rows) {
      const rowH = 15;
      if (y + rowH > doc.page.height - 50) { doc.addPage(); y = 40; drawHeader(); doc.font("Helvetica").fontSize(8); }
      let cx = left;
      for (let i = 0; i < cols.length; i++) { doc.text(r[i], cx + 4, y + 4, { width: cols[i].w - 8 }); cx += cols[i].w; }
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#eee").stroke();
      y += rowH;
    }
    doc.end();
  }

  // Liste de population FIGÉE d'un mouvement précis (2026-09) — voir
  // demande utilisateur : "si on fait une affaire nouvelle par exemple, on
  // doit avoir une liste liée à cette opération et cette liste doit pouvoir
  // être éditée plusieurs fois sans changement à n'importe quelle date et
  // doit retrouver la même liste à l'identique. C'est la même chose pour
  // une incorporation ou un retrait." Source : AvenantAssure, qui fige
  // nom/prénom/matricule/typeAssure AU MOMENT du mouvement — jamais
  // rejoint depuis AssureSante — donc une correction ultérieure de la
  // fiche d'une personne (nom corrigé, etc.) ne fait JAMAIS varier cette
  // liste après coup, contrairement à renderPopulationExport (qui reflète
  // l'état actuel/reconstitué des fiches). Couvre "Affaire Nouvelle"
  // (import CSV à la création, voir SanteService.importPopulation, corrigé
  // pour générer ce même journal), "Incorporation" et "Retrait" — même
  // mécanisme, valable pour tout exercice et pour Maladie comme Assistance.
  async renderListeMouvement(avenantId: string, format: "pdf" | "xlsx" | "docx", res: Response) {
    const avenant = await this.prisma.avenant.findUnique({
      where: { id: avenantId },
      include: { contrat: { include: { client: true } }, avenantAssures: { orderBy: [{ action: "asc" }, { nom: "asc" }] } },
    });
    if (!avenant) throw new NotFoundException(`Avenant ${avenantId} introuvable`);

    const numero = await this.prisma.avenant.count({ where: { contratId: avenant.contratId, createdAt: { lte: avenant.createdAt } } });
    const titre = `Liste des assurés — ${avenant.type}`;
    // Police N° = le vrai numéro de police compagnie (2026-09) — voir
    // demande utilisateur : "là où il y a N° Police, c'est le numéro de
    // police compagnie du contrat qui doit remonter".
    const sousTitre = `${avenant.contrat.client.nom}   ·   Police N° ${avenant.contrat.numeroPolice || avenant.contrat.id}   ·   Avenant n°${numero}   ·   Date d'effet ${avenant.dateEffet}   ·   ${avenant.avenantAssures.length} personne(s)`;
    const rows = avenant.avenantAssures.map((a) => [a.matricule ?? "—", `${a.nom} ${a.prenom ?? ""}`.trim(), TYPE_ASSURE_LABELS[a.typeAssure ?? ""] ?? a.typeAssure ?? "—", a.action, a.dateEffet]);

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Mouvement");
      ws.columns = [
        { header: "Matricule", key: "matricule", width: 18 }, { header: "Nom et Prénom", key: "nom", width: 30 },
        { header: "Type", key: "type", width: 14 }, { header: "Action", key: "action", width: 16 }, { header: "Date d'effet", key: "date", width: 16 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const r of rows) ws.addRow(r);
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="Liste-Mouvement-${avenant.id}.xlsx"`);
      res.send(Buffer.from(buffer));
      return;
    }
    if (format === "docx") {
      return this.envoyerDocx(res, `Liste-Mouvement-${avenant.id}`, titre, sousTitre, [], { headers: ["Matricule", "Nom et Prénom", "Type", "Action", "Date d'effet"], rows });
    }

    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Liste-Mouvement-${avenant.id}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text(titre, left, 60, { width, align: "right" });
    doc.fontSize(8).font("Helvetica").fillColor("#555").text(sousTitre, left, 74, { width, align: "right" });
    doc.fillColor("#000");

    let y = 95;
    const cols = [
      { h: "Matricule", w: width * 0.16 }, { h: "Nom et Prénom", w: width * 0.32 },
      { h: "Type", w: width * 0.13 }, { h: "Action", w: width * 0.19 }, { h: "Date d'effet", w: width * 0.2 },
    ];
    const drawHeader = () => {
      doc.rect(left, y, width, 16).fill(p.couleurPrimaire);
      let cx = left;
      doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 4, y + 4, { width: c.w - 8 }); cx += c.w; }
      doc.fillColor("#000");
      y += 16;
    };
    drawHeader();

    doc.font("Helvetica").fontSize(8);
    for (const r of rows) {
      const rowH = 15;
      if (y + rowH > doc.page.height - 50) { doc.addPage(); y = 40; drawHeader(); doc.font("Helvetica").fontSize(8); }
      let cx = left;
      for (let i = 0; i < cols.length; i++) { doc.text(String(r[i] ?? "—"), cx + 4, y + 4, { width: cols[i].w - 8 }); cx += cols[i].w; }
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#eee").stroke();
      y += rowH;
    }
    doc.end();
  }

  // ── Rapport Statistiques (PDF/DOCX) ─────────────────────────────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins) — s'appuie sur StatistiquesService.calculer(), resté intact
  // (voir statistiques.types.ts, jamais touché) : seule la mise en forme
  // est reconstruite ici, jamais le calcul. Simplifiée par rapport à
  // l'original (tableaux uniquement, pas de graphiques camembert/barres) —
  // toutes les données restent présentes, seule la représentation change.
  // `rubriques` filtre les sections incluses (voir demande utilisateur :
  // "sélectionner les rubriques que l'on veut voir apparaître").
  // `analyseOverride` (2026-09) — l'analyse narrative peut être ÉDITÉE à
  // l'écran avant téléchargement (voir features/statistiques/index.tsx,
  // `analyseEdite`) ; quand fournie, remplace celle fraîchement calculée
  // plutôt que d'être ignorée.
  async renderStatistiques(
    contratId: string, du: string | undefined, au: string | undefined, format: "pdf" | "docx", res: Response,
    analyseOverride: import("../statistiques/statistiques.types").AnalyseNarrative | undefined, rubriques?: RubriqueId[],
  ) {
    const calcule = await this.statistiques.calculer(contratId, du, au);
    const payload: StatistiquesPayload = analyseOverride ? { ...calcule, analyse: analyseOverride } : calcule;
    const inclut = (id: RubriqueId) => !rubriques || rubriques.includes(id);

    if (format === "docx") return this.genererStatistiquesDocx(res, payload, inclut);

    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const pageGardeImage = await this.chargerImage("pages-garde-statistiques", p.statistiquesPageGarde, UPLOADS_PAGES_GARDE_STATISTIQUES_DIR);
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Statistiques-${payload.contrat.id}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const HAUT_CONTENU = 88; // sous l'en-tête (logo) des pages de contenu
    const BAS_CONTENU = doc.page.height - 55; // au-dessus du pied de page
    let y = HAUT_CONTENU;

    const nouvellePage = () => { doc.addPage(); y = HAUT_CONTENU; };
    const assurerPlace = (h: number) => { if (y + h > BAS_CONTENU) nouvellePage(); };
    // Page dédiée (S/P, Analyse) SANS page blanche parasite (2026-09) — voir
    // demande utilisateur : "les pieds de page ne sont pas sur les bonnes
    // pages... les infos sont sur des pages sans données." Un simple
    // nouvellePage() inconditionnel AVANT ces sections créait une page
    // totalement vide chaque fois que la section précédente s'était déjà
    // terminée exactement en haut d'une page fraîche (ex. un graphique qui
    // débordait tout juste) — variante conditionnelle, ne saute une page
    // que si la page courante contient déjà quelque chose.
    const demarrerPageDediee = () => { if (y > HAUT_CONTENU) nouvellePage(); };

    // Section title (2026-09) — voir "Modèle statistiques.pdf" (référence
    // exacte demandée) : un simple titre coloré + filet, jamais un bandeau
    // plein comme l'ancienne version. couleurPrimaire (bleu chez LA RUCHE)
    // pour rester cohérent avec la couleur des filets de la référence.
    const titreSection = (titre: string) => {
      assurerPlace(30);
      y += 8;
      doc.fillColor(p.couleurPrimaire).fontSize(13).font("Helvetica-Bold").text(titre, left, y);
      y += 17;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor(p.couleurPrimaire).stroke();
      doc.fillColor("#000");
      y += 8;
    };

    // En-tête de tableau en couleurSecondaire (orange chez LA RUCHE) — voir
    // référence : c'est la couleur des en-têtes de tableau, distincte de
    // celle des titres de section.
    // Tableau proportionnel au contenu (2026-09) — voir demande utilisateur :
    // "les tableaux sont trop étirés hors le fichier original est très
    // design, des tableaux proportionnels avec le contenu des cellules."
    // Chaque colonne est mesurée (doc.widthOfString sur l'en-tête ET
    // chaque valeur) plutôt que de diviser/étirer sur toute la largeur de
    // page — le tableau prend sa largeur NATURELLE, jamais plus, aligné à
    // gauche comme dans la référence (jamais un `widths` figé en fraction
    // de page, qui produisait justement cet étirement). Une seule colonne
    // ne peut jamais dépasser 55% de la largeur disponible (texte libre
    // très long, ex. "Famille ENGONGH'AKWE") — repasse alors en retour à
    // la ligne plutôt que d'élargir tout le tableau démesurément.
    const PADDING_CELLULE = 8;
    const LARGEUR_MIN_COLONNE = 40;
    const tableau = (headers: string[], rows: (string | number)[][]) => {
      const largeurMaxColonne = width * 0.55;
      doc.font("Helvetica-Bold").fontSize(7.5);
      const colW = headers.map((h, i) => {
        let maxW = doc.widthOfString(h);
        doc.font("Helvetica").fontSize(7.5);
        for (const row of rows) {
          const v = row[i];
          const s = typeof v === "number" ? fmt(v) : String(v ?? "");
          const w = doc.widthOfString(s);
          if (w > maxW) maxW = w;
        }
        doc.font("Helvetica-Bold").fontSize(7.5);
        return Math.min(largeurMaxColonne, Math.max(LARGEUR_MIN_COLONNE, maxW + PADDING_CELLULE));
      });
      const largeurTableau = colW.reduce((a, b) => a + b, 0);
      const droiteTableau = left + largeurTableau;

      assurerPlace(18);
      doc.rect(left, y, largeurTableau, 16).fillColor(p.couleurSecondaire).fill();
      let cx = left;
      doc.fillColor("#fff").fontSize(7.5).font("Helvetica-Bold");
      for (let i = 0; i < headers.length; i++) { doc.text(headers[i], cx + 3, y + 4, { width: colW[i] - 6, align: i === 0 ? "left" : "right" }); cx += colW[i]; }
      y += 16;
      doc.font("Helvetica").fontSize(7.5).fillColor("#000");
      for (const row of rows) {
        assurerPlace(14);
        cx = left;
        for (let i = 0; i < row.length; i++) {
          const v = typeof row[i] === "number" ? fmt(row[i] as number) : String(row[i]);
          doc.text(v, cx + 3, y + 3, { width: colW[i] - 6, align: i === 0 ? "left" : "right" });
          cx += colW[i];
        }
        doc.moveTo(left, y + 14).lineTo(droiteTableau, y + 14).strokeColor("#eee").stroke();
        y += 14;
      }
      y += 6;
    };

    // Insère une image de graphique (déjà générée en PNG) sous forme
    // centrée, largeur pleine page pour un histogramme, plus étroite pour
    // un camembert — voir graphiques.util.ts.
    const inserer = async (buffer: Buffer, ratioLargeurHauteur: number, largeurMax: number) => {
      const largeur = Math.min(largeurMax, width);
      const hauteur = largeur / ratioLargeurHauteur;
      assurerPlace(hauteur + 10);
      doc.image(buffer, left + (width - largeur) / 2, y, { width: largeur, height: hauteur });
      y += hauteur + 14;
    };

    // ── Page de garde ──────────────────────────────────────────────────
    // Personnalisable par société (2026-09) — voir demande utilisateur :
    // "il faut seulement rendre possible la personnalisation de la page de
    // garde par client (compagnie, courtier, mutuelle), chacun doit avoir
    // la possibilité de personnaliser sa page de garde." Une image de fond
    // pleine page uploadée (ParametresEntreprise.statistiquesPageGarde) est
    // utilisée si présente, avec les champs dynamiques (client/police/
    // période) superposés dans un bandeau blanc semi-opaque pour rester
    // lisibles quel que soit le fond choisi — même principe que le verso de
    // carte importé (voir personnaliserVersoLaRuche). Sans image
    // personnalisée : page de garde générée par défaut, comportement
    // historique inchangé.
    if (pageGardeImage) {
      try {
        doc.image(pageGardeImage, 0, 0, { width: doc.page.width, height: doc.page.height });
        // Emplacements calés EXACTEMENT sur les zones blanchies du gabarit
        // LA RUCHE (voir demande utilisateur : "les deux page de garde ne
        // sont pas identiques... les motifs ne se ressemblent même pas un
        // peu" — corrigé en réutilisant l'image RÉELLE de référence,
        // "STATISTIQUES"/logo/photo/CONTACT déjà imprimés dedans, seuls
        // client/police/période sont redessinés par-dessus, aux coordonnées
        // mesurées au pixel près sur le gabarit source à 300 DPI
        // (px / (300/72) = pt) — voir scratch-page-garde/prepare-template.js,
        // jamais reproductibles à l'identique en repartant d'un simple
        // "à vue d'œil" sur la miniature (deux essais précédents ratés).
        doc.fillColor(p.couleurPrimaire).fontSize(20).font("Helvetica-Bold")
          .text(payload.contrat.client, 235, 168, { width: 310, height: 34, ellipsis: true });
        doc.fontSize(12).text(`N° Police : ${payload.contrat.numeroPolice}`, 235, 230, { width: 220 });
        doc.fontSize(10.5).text(`Période : du ${payload.periode.du} au ${payload.periode.au}`, 300, 690, { width: 262, align: "center" });
        doc.fillColor("#000");
      } catch { /* image illisible — jamais bloquant */ }
    } else {
      // Page de garde générée par défaut (2026-09) — voir "Modèle
      // statistiques.pdf"/"Stat CIMAF R0603153.pdf" (références exactes
      // demandées par l'utilisateur, confirmant un MÊME gabarit réutilisé
      // pour tout client, seuls le nom/police/période changent) : mêmes
      // formes décoratives (cercles bleu/orange), même disposition
      // (STATISTIQUES/client/police en haut, bloc CONTACT en bas à
      // gauche, période en bas), reconstruites en VECTORIEL avec les
      // couleurs réelles de la société (couleurPrimaire/couleurSecondaire)
      // plutôt qu'une image figée — garantit un rendu IDENTIQUE à chaque
      // génération, pour N'IMPORTE QUELLE société (pas seulement LA RUCHE),
      // sans dépendre d'un upload. Voir demande utilisateur : "il faut
      // qu'on s'y retrouve peu importe le nombre de fois qu'on va générer
      // les statistiques... peu importe le client, exactement le même
      // rendu."
      const pw = doc.page.width, ph = doc.page.height;
      doc.save();
      // Grand cercle bleu (haut-gauche, hors-page) puis orange par-dessus.
      doc.circle(-90, 90, 270).fill(p.couleurPrimaire);
      doc.circle(40, 230, 190).fill(p.couleurSecondaire);
      // Vague bleue traversant le milieu de la page.
      doc.save();
      doc.ellipse(pw / 2, 450, pw * 0.62, 78).fill(p.couleurPrimaire);
      doc.restore();
      // Grand cercle orange (bas-gauche, hors-page).
      doc.circle(-50, ph - 90, 250).fill(p.couleurSecondaire);
      // Petite décoration bas-droite.
      doc.circle(pw + 10, ph - 40, 70).fill(p.couleurSecondaire);
      doc.restore();

      // Logo société, en haut à droite.
      if (logoImage) {
        try { doc.image(logoImage, pw - 40 - 130, 32, { width: 130 }); } catch { /* jamais bloquant */ }
      }

      // Bloc titre : STATISTIQUES (couleurSecondaire) / client (couleurPrimaire) / filet / N° police.
      // Décalé à droite (titreX=245) pour rester hors de l'emprise du grand
      // cercle orange décoratif (centre 40,230, rayon 190 → atteint x=230
      // à sa hauteur) — voir les deux références fournies, où le bloc
      // titre démarre lui aussi nettement à droite des cercles, jamais
      // dessus (corrige un chevauchement texte/cercle constaté au premier
      // rendu réel).
      const titreX = 245, titreW = pw - titreX - 40;
      let ty = 140;
      doc.fillColor(p.couleurSecondaire).fontSize(38).font("Helvetica-Bold").text("STATISTIQUES", titreX, ty, { width: titreW });
      ty += 52;
      doc.fillColor(p.couleurPrimaire).fontSize(24).font("Helvetica-Bold").text(payload.contrat.client, titreX, ty, { width: titreW });
      ty += 38;
      doc.moveTo(titreX, ty).lineTo(pw - 40, ty).lineWidth(2).strokeColor(p.couleurPrimaire).stroke();
      ty += 10;
      doc.fillColor(p.couleurPrimaire).fontSize(13).font("Helvetica-Bold").text(`N° Police : ${payload.contrat.numeroPolice}`, titreX, ty, { width: titreW });

      // Période, centrée sur la pleine largeur de page.
      doc.fillColor(p.couleurPrimaire).fontSize(14).font("Helvetica-Bold")
        .text(`Période : du ${payload.periode.du} au ${payload.periode.au}`, 0, ph - 195, { width: pw, align: "center" });

      // Bloc CONTACT, en bas à gauche (données réelles de la société).
      let cy = ph - 145;
      doc.fillColor(p.couleurSecondaire).fontSize(13).font("Helvetica-Bold").text("CONTACT", 40, cy);
      cy += 18;
      if (p.telephone) { doc.fillColor(p.couleurSecondaire).fontSize(10).font("Helvetica-Bold").text(p.telephone, 40, cy); cy += 14; }
      if (p.ville) { doc.fillColor(p.couleurSecondaire).fontSize(10).font("Helvetica-Bold").text(p.ville, 40, cy); }
      doc.fillColor("#000");
    }
    nouvellePage();

    if (inclut("basesContractuelles")) {
      titreSection("Bases Contractuelles");
      tableau(["Collège", "Assureur", "N° Police", "Date d'effet"], [[payload.basesContractuelles.college, payload.basesContractuelles.assureur, payload.basesContractuelles.policeNumero, payload.basesContractuelles.dateEffet]]);
    }

    if (inclut("evolutionMensuelle") && payload.evolutionMensuelle.length > 0) {
      titreSection("Évolution Mensuelle de la Consommation");
      tableau(["Mois", "Montant remboursé (FCFA)"], [...payload.evolutionMensuelle.map((l) => [l.label, l.montant]), ["Total", payload.evolutionMensuelle.reduce((s, l) => s + l.montant, 0)]]);
      const buf = await genererGraphiqueBarres(payload.evolutionMensuelle.map((l) => l.label), payload.evolutionMensuelle.map((l) => l.montant), "Évolution des consommations par mois", p.couleurPrimaire);
      await inserer(buf, 900 / 480, width);
    }

    if (inclut("consommationParFamille") && payload.consommationParFamille.length > 0) {
      titreSection("Consommation par Famille");
      tableau(["Matricule", "Famille", "Montant consommé"], payload.consommationParFamille.map((l) => [l.matricule, l.famille, l.montant]));
    }

    if (inclut("detailParFamille")) {
      for (const f of payload.detailParFamille) {
        titreSection(`Détail — ${f.famille} (${f.matricule}) · Total ${fmt(f.totalFamille)} FCFA`);
        tableau(["Assuré", "Date", "Acte", "Montant"], f.lignes.map((l) => [l.assureNom, l.date, l.acte, l.montant]));
      }
    }

    if (inclut("top20Consommateurs") && payload.top20Consommateurs.length > 0) {
      titreSection("Top 20 des Consommateurs");
      tableau(["N°", "Matricule", "Famille", "Montant consommé"], payload.top20Consommateurs.map((l, i) => [i + 1, l.matricule, l.famille, l.montant]));
      const buf = await genererGraphiqueBarres(payload.top20Consommateurs.map((l) => l.famille), payload.top20Consommateurs.map((l) => l.montant), "Top 20 des consommateurs", p.couleurPrimaire);
      await inserer(buf, 900 / 480, width);
    }

    if (inclut("repartitionBeneficiaire") && payload.repartitionBeneficiaire.length > 0) {
      titreSection(`Répartition par Bénéficiaire · ${payload.totalPersonnesSoignees} personne(s) soignée(s)`);
      // Lignes groupées Type (gras) + sous-lignes Féminin/Masculin — voir
      // "Modèle statistiques.pdf" référence exacte demandée, et
      // RepartitionBeneficiaireLigne (déjà cette granularité côté calcul).
      const rows: (string | number)[][] = [];
      for (const l of payload.repartitionBeneficiaire) {
        rows.push([l.type, l.nombre, l.montant, `${l.pctDepenses.toFixed(2)}%`, `${l.pctPopulation.toFixed(2)}%`]);
        rows.push(["   Féminin", l.feminin.nombre, l.feminin.montant, `${l.feminin.pctDepenses.toFixed(2)}%`, `${l.feminin.pctPopulation.toFixed(2)}%`]);
        rows.push(["   Masculin", l.masculin.nombre, l.masculin.montant, `${l.masculin.pctDepenses.toFixed(2)}%`, `${l.masculin.pctPopulation.toFixed(2)}%`]);
      }
      const totalMontant = payload.repartitionBeneficiaire.reduce((s, l) => s + l.montant, 0);
      rows.push(["Total", payload.totalPersonnesSoignees, totalMontant, "100%", "100%"]);
      tableau(["Type de Bénéficiaire", "Nombre", "Montant Remboursé", "% Dépenses", "% Population"], rows);
      const buf = await genererGraphiqueCamembert(payload.repartitionBeneficiaire.map((l) => l.type), payload.repartitionBeneficiaire.map((l) => l.montant), "Répartition par type de bénéficiaire", false);
      await inserer(buf, 1, 300);
    }

    if (inclut("consommationParRubrique") && payload.consommationParRubrique.length > 0) {
      titreSection(`Consommation par Rubrique · Total ${fmt(payload.totalConsomme)} FCFA`);
      tableau(["Rubrique", "Remboursé", "% du total"], payload.consommationParRubrique.map((l) => [l.libelle, l.montant, `${l.pct.toFixed(2)}%`]));
      const buf = await genererGraphiqueCamembert(payload.consommationParRubrique.map((l) => l.libelle), payload.consommationParRubrique.map((l) => l.montant), "Consommation par Rubrique", false);
      await inserer(buf, 1, 260);
    }

    if (inclut("consommationParPrestataire") && payload.consommationParPrestataire.length > 0) {
      titreSection("Consommation par Prestataire");
      tableau(["Prestataire", "Remboursé", "% du total"], [...payload.consommationParPrestataire.map((l) => [l.libelle, l.montant, `${l.pct.toFixed(2)}%`]), ["Total", payload.consommationParPrestataire.reduce((s, l) => s + l.montant, 0), "100%"]]);
      const buf = await genererGraphiqueCamembert(payload.consommationParPrestataire.map((l) => l.libelle), payload.consommationParPrestataire.map((l) => l.montant), "Consommation par prestataire", true);
      await inserer(buf, 1, 320);
    }

    if (inclut("detailParPrestataire")) {
      for (const pr of payload.detailParPrestataire) {
        titreSection(`Détail — ${pr.prestataire} · Total ${fmt(pr.totalPrestataire)} FCFA`);
        tableau(["Assuré", "Date", "Acte", "Montant"], pr.lignes.map((l) => [l.assureNom, l.date, l.acte, l.montant]));
      }
    }

    if (inclut("top20Prestataires") && payload.top20Prestataires.length > 0) {
      titreSection("Top 20 des Prestataires");
      tableau(["N°", "Prestataire", "Remboursé", "% du total"], payload.top20Prestataires.map((l, i) => [i + 1, l.libelle, l.montant, `${l.pct.toFixed(2)}%`]));
      const buf = await genererGraphiqueBarres(payload.top20Prestataires.map((l) => l.libelle), payload.top20Prestataires.map((l) => l.montant), "Top 20 des prestataires", p.couleurPrimaire);
      await inserer(buf, 900 / 480, width);
    }

    if (inclut("evolutionSP")) {
      // Page dédiée (2026-09) — voir demande utilisateur : "la page du S/P
      // est à cheval entre pages. Non, il ne doit pas en être ainsi, le
      // S/P doit avoir sa page dédiée." Jamais enchaîné à la suite d'une
      // section précédente encore en cours de page.
      demarrerPageDediee();
      titreSection("Evolution du S/P");

      // Bloc reproduit EXACTEMENT la structure du modèle de référence
      // ("Modèle statistiques.pdf"/"Stat CIMAF R0603153.pdf" — voir demande
      // utilisateur : "je ne veux pas que tu crées pour toi, je veux que tu
      // reproduises exactement les formes que je t'ai données... le format
      // du tableau, le jeu de couleur (thème) doit être identique au
      // fichier transmis") : PAS un tableau à en-têtes de colonnes comme
      // les autres rubriques — une ligne d'info (société/police/garanties/
      // sinistres/primes/ratio) en bleu clair (couleurPrimaire éclairci),
      // puis une ligne bandeau "TOTAL MALADIE {label}" en orange
      // (couleurSecondaire), puis les mêmes sinistres/primes/ratio répétés
      // (ratio cette fois en %, jamais en fraction) sur fond blanc.
      const colW = [width * 0.19, width * 0.13, width * 0.24, width * 0.15, width * 0.15, width * 0.14];
      const colX = [left, left + colW[0], left + colW[0] + colW[1], left + colW[0] + colW[1] + colW[2], left + colW[0] + colW[1] + colW[2] + colW[3], left + colW[0] + colW[1] + colW[2] + colW[3] + colW[4]];
      const HAUTEUR_LIGNE_SP = 16;
      // Bordures (2026-09, 3e correctif) — voir demande utilisateur, capture
      // annotée : "pour chaque tableau, mets la bordure externe complète
      // afin que l'on [voie] qu'il s'agit bien d[u] même tableau pour
      // chaque cas (hors chargement et avec chargement)". Le 2e correctif
      // bordait séparément la ligne d'info et le bandeau total+valeurs
      // (deux rectangles disjoints) — remplacé ici par UN SEUL rectangle
      // extérieur englobant les 4 lignes du cas (info/blanche/total/
      // valeurs), avec un simple filet horizontal entre le bandeau total
      // et la ligne de valeurs (seule séparation interne conservée) —
      // jamais de ligne verticale interne (voir correctif précédent,
      // toujours valable).
      const blocSP = (bloc: typeof payload.spSansChargement, label: string) => {
        assurerPlace(HAUTEUR_LIGNE_SP * 4 + 10);
        const yDepart = y;
        // Ligne info — même bleu EXACT que la barre du diagramme
        // (couleurPrimaire, non éclairci — voir capture : "récupérer le
        // bleu de la bande du diagramme"), texte blanc pour rester lisible
        // sur cette couleur pleine.
        doc.rect(left, y, width, HAUTEUR_LIGNE_SP).fillColor(p.couleurPrimaire).fill();
        doc.fillColor("#fff").fontSize(7.5).font("Helvetica-Bold");
        const infoVals = [payload.contrat.client, payload.contrat.numeroPolice, payload.contrat.garantiesPrivees, fmt(bloc.sinistres), fmt(bloc.primes), (bloc.ratioPct / 100).toFixed(2).replace(".", ",")];
        infoVals.forEach((v, i) => doc.text(v, colX[i] + 4, y + 4, { width: colW[i] - 8, align: i >= 3 ? "right" : "left" }));
        y += HAUTEUR_LIGNE_SP;
        // Ligne blanche (espacement, même hauteur que les autres lignes),
        // désormais À L'INTÉRIEUR de la bordure externe unique du tableau.
        y += HAUTEUR_LIGNE_SP;
        // Bandeau total — même orange EXACT que la barre du diagramme
        // (couleurSecondaire), rempli sur toute la largeur.
        const yTotal = y;
        doc.rect(left, y, width, HAUTEUR_LIGNE_SP).fillColor(p.couleurSecondaire).fill();
        doc.fillColor("#fff").fontSize(7.5).font("Helvetica-Bold").text(`TOTAL MALADIE ${label}`, left + 4, y + 4, { width: colX[3] - left - 8 });
        y += HAUTEUR_LIGNE_SP;
        // Ligne valeurs finales — blanc, ratio en %
        doc.fillColor("#1a1a1a").fontSize(7.5).font("Helvetica-Bold");
        doc.text(fmt(bloc.sinistres), colX[3] + 4, y + 4, { width: colW[3] - 8, align: "right" });
        doc.text(fmt(bloc.primes), colX[4] + 4, y + 4, { width: colW[4] - 8, align: "right" });
        doc.text(bloc.ratioPct.toFixed(2).replace(".", ","), colX[5] + 4, y + 4, { width: colW[5] - 8, align: "right" });
        y += HAUTEUR_LIGNE_SP;
        // Bordure externe COMPLÈTE du tableau entier (les 4 lignes) + filet
        // interne entre le bandeau total et la ligne de valeurs.
        doc.rect(left, yDepart, width, y - yDepart).strokeColor("#000").lineWidth(0.75).stroke();
        doc.strokeColor("#000").lineWidth(0.5).moveTo(left, yTotal + HAUTEUR_LIGNE_SP).lineTo(left + width, yTotal + HAUTEUR_LIGNE_SP).stroke();
        y += 10;
      };
      blocSP(payload.spSansChargement, "sans Chargement");
      blocSP(payload.spAvecChargement, "avec Chargement");

      const buf = await genererGraphiqueBarresEtiquetees(
        ["S/P sans chargement", "S/P avec chargement"],
        [payload.spSansChargement.ratioPct / 100, payload.spAvecChargement.ratioPct / 100],
        "Evolution du S/P", [p.couleurPrimaire, p.couleurSecondaire],
        (v) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      );
      await inserer(buf, 900 / 480, width * 0.75);
    }

    if (inclut("analyse")) {
      // Page dédiée (2026-09) — voir demande utilisateur : "l'analyse des
      // statistiques... doit commencer sur une nouvelle page et non sur
      // celle du S/P."
      demarrerPageDediee();
      titreSection("Analyse & Recommandations");
      doc.font("Helvetica").fontSize(8);
      for (const section of payload.analyse.sections) {
        assurerPlace(16);
        doc.font("Helvetica-Bold").fontSize(9).text(section.titre, left, y);
        y += 13;
        doc.font("Helvetica").fontSize(8);
        for (const ligne of section.lignes) {
          assurerPlace(12);
          doc.text(`•  ${ligne}`, left + 6, y, { width: width - 6 });
          y += doc.heightOfString(`•  ${ligne}`, { width: width - 6 }) + 2;
        }
        y += 6;
      }
      if (payload.analyse.conclusionGenerale.length > 0) {
        assurerPlace(16);
        doc.font("Helvetica-Bold").fontSize(9).text("Conclusion générale", left, y);
        y += 13;
        doc.font("Helvetica").fontSize(8);
        for (const ligne of payload.analyse.conclusionGenerale) { assurerPlace(12); doc.text(`•  ${ligne}`, left + 6, y, { width: width - 6 }); y += doc.heightOfString(`•  ${ligne}`, { width: width - 6 }) + 2; }
        y += 6;
      }
      // Projection/Conclusion stratégique/finale (2026-09) — calculées par
      // genererAnalyseNarrative mais jamais rendues jusqu'ici (bug relevé en
      // corrigeant le langage prédictif/rétrospectif, voir demande
      // utilisateur : "l'analyse manque encore de précision... ça devrait
      // être une analyse exacte quant à la police et ses consommations par
      // rapport aux clauses d'ajustement") — ajoutées ici pour que le
      // verdict définitif (exercice clôturé) ou la projection (exercice en
      // cours) apparaissent réellement dans le document, pas seulement en
      // mémoire.
      const blocAnalyse = (titre: string, lignes: string[]) => {
        if (lignes.length === 0) return;
        assurerPlace(16);
        doc.font("Helvetica-Bold").fontSize(9).text(titre, left, y);
        y += 13;
        doc.font("Helvetica").fontSize(8);
        for (const ligne of lignes) {
          assurerPlace(12);
          if (ligne === "") { y += 6; continue; }
          doc.text(ligne.startsWith("•") ? ligne : `•  ${ligne}`, left + 6, y, { width: width - 6 });
          y += doc.heightOfString(ligne.startsWith("•") ? ligne : `•  ${ligne}`, { width: width - 6 }) + 2;
        }
        y += 6;
      };
      blocAnalyse(payload.analyse.projection.titre, payload.analyse.projection.lignes);
      blocAnalyse("Conclusion stratégique", payload.analyse.conclusionStrategique);
      blocAnalyse("Conclusion finale", payload.analyse.conclusionFinale);
    }

    // ── En-tête (logo) + pied de page sur toutes les pages de contenu ───
    // (2026-09) — voir "Modèle statistiques.pdf" référence exacte demandée :
    // logo de la société en haut de CHAQUE page de contenu, et un pied de
    // page "Document confidentiel | Arrêté de situation {client} au {date}
    // | Page X sur Y" — appliqué après coup sur les pages déjà mises en
    // page (doc.bufferPages), jamais la page de garde (index 0).
    const dateArrete = new Date().toLocaleDateString("fr-FR");
    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      if (logoImage) {
        try { doc.image(logoImage, left, 30, { height: 36 }); } catch { /* jamais bloquant */ }
      } else {
        doc.fillColor(p.couleurPrimaire).fontSize(12).font("Helvetica-Bold").text(p.nom, left, 40);
      }
      doc.fillColor("#000");
      const pageNum = i - range.start; // page de garde exclue de la numérotation visible
      const pageTotal = range.count - 1;
      doc.moveTo(left, doc.page.height - 40).lineTo(right, doc.page.height - 40).strokeColor(p.couleurPrimaire).lineWidth(1).stroke();
      // Le pied de page est écrit DANS la marge basse (doc.page.height - 32,
      // alors que margin:40 place la zone de contenu utilisable au-dessus de
      // doc.page.height - 40) — sans neutraliser temporairement la marge,
      // PDFKit considère chaque .text() chaîné comme un débordement et
      // déclenche automatiquement une nouvelle page à CHAQUE appel, ce qui
      // dispersait les 3 fragments du pied de page sur 3 pages presque
      // vierges distinctes (voir capture utilisateur : "les pied page ne
      // sont pas sur les bonnes page... les infos sont sur des pages sans
      // données").
      const margeBasseOriginale = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(7).fillColor("#555").font("Helvetica")
        .text("Document confidentiel", left, doc.page.height - 32, { width: width / 3, align: "left" })
        .text(`Arrêté de situation ${payload.contrat.client} au ${dateArrete}`, left, doc.page.height - 32, { width, align: "center" })
        .text(`Page ${pageNum} sur ${pageTotal}`, left, doc.page.height - 32, { width, align: "right" });
      doc.page.margins.bottom = margeBasseOriginale;
      doc.fillColor("#000");
    }

    doc.end();
  }

  // Réécrit (2026-09) pour correspondre exactement au modèle de référence
  // ("Modèle statistiques.pdf", voir demande utilisateur : "le fichier
  // statistique, qu'il soit en Word ou en PDF, doit être exactement comme
  // celui de MedAssur") — mêmes tableaux ET mêmes graphiques que le PDF
  // (genererGraphiqueBarres/Camembert, réutilisés tels quels en PNG via
  // ImageRun, pour ne jamais diverger entre les deux formats), en-tête
  // logo + pied de page "Document confidentiel/page X sur Y" sur chaque
  // page de contenu, page de garde personnalisable par société.
  private async genererStatistiquesDocx(res: Response, payload: StatistiquesPayload, inclut: (id: RubriqueId) => boolean) {
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const pageGardeImage = await this.chargerImage("pages-garde-statistiques", p.statistiquesPageGarde, UPLOADS_PAGES_GARDE_STATISTIQUES_DIR);
    const couleurPrimaireHex = p.couleurPrimaire.replace("#", "");
    const couleurSecondaireHex = p.couleurSecondaire.replace("#", "");
    const LARGEUR_PAGE_EMU = 6120; // twips utiles ≈ largeur de page A4 - marges, pour dimensionner les images

    const titreSection = (titre: string) => new Paragraph({
      spacing: { before: 300, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: couleurPrimaireHex } },
      children: [new TextRun({ text: titre, bold: true, size: 26, color: couleurPrimaireHex })],
    });

    const celluleEntete = (texte: string, largeurDxa: number) => new TableCell({
      width: { size: largeurDxa, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: couleurSecondaireHex },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texte, bold: true, color: "FFFFFF", size: 16 })] })],
    });
    const celluleTexte = (v: string | number, largeurDxa: number) => new TableCell({
      width: { size: largeurDxa, type: WidthType.DXA },
      children: [new Paragraph({ alignment: typeof v === "number" ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: typeof v === "number" ? fmt(v) : String(v), size: 16 })] })],
    });
    // Tableau proportionnel au contenu (2026-09) — voir demande utilisateur :
    // "les tableaux sont trop étirés hors le fichier original est très
    // design, des tableaux proportionnels avec le contenu des cellules."
    // docx n'a pas d'équivalent direct de PDFKit.widthOfString ; largeur de
    // colonne approximée par le nombre de caractères le plus long (en-tête
    // ET chaque valeur) plutôt qu'un simple 100%/nbColonnes qui étirait
    // tout sur la pleine largeur — table.width posé sur la SOMME réelle des
    // colonnes (DXA), jamais 100%.
    const DXA_PAGE = 9020; // largeur utile ≈ A4 - marges par défaut docx
    const dxaDepuisCaracteres = (n: number) => Math.round(Math.max(500, Math.min(DXA_PAGE * 0.55, n * 105 + 220)));
    const tableau = (headers: string[], rows: (string | number)[][]) => {
      const colDxa = headers.map((h, i) => {
        let maxLen = h.length;
        for (const row of rows) {
          const v = row[i];
          const s = typeof v === "number" ? fmt(v) : String(v ?? "");
          if (s.length > maxLen) maxLen = s.length;
        }
        return dxaDepuisCaracteres(maxLen);
      });
      return new Table({
        width: { size: colDxa.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        rows: [
          new TableRow({ children: headers.map((h, i) => celluleEntete(h, colDxa[i])) }),
          ...rows.map((row) => new TableRow({ children: row.map((v, i) => celluleTexte(v, colDxa[i])) })),
        ],
      });
    };

    const image = (buffer: Buffer, largeurEmu: number, hauteurEmu: number) => new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 150, after: 200 },
      children: [new ImageRun({ data: buffer, transformation: { width: largeurEmu, height: hauteurEmu }, type: "png" })],
    });

    const children: (Paragraph | Table)[] = [];

    if (inclut("basesContractuelles")) {
      children.push(titreSection("Bases Contractuelles"));
      children.push(tableau(["Collège", "Assureur", "N° Police", "Date d'effet"], [[payload.basesContractuelles.college, payload.basesContractuelles.assureur, payload.basesContractuelles.policeNumero, payload.basesContractuelles.dateEffet]]));
    }

    if (inclut("evolutionMensuelle") && payload.evolutionMensuelle.length > 0) {
      children.push(titreSection("Évolution Mensuelle de la Consommation"));
      children.push(tableau(["Mois", "Montant remboursé (FCFA)"], [...payload.evolutionMensuelle.map((l) => [l.label, l.montant]), ["Total", payload.evolutionMensuelle.reduce((s, l) => s + l.montant, 0)]]));
      const buf = await genererGraphiqueBarres(payload.evolutionMensuelle.map((l) => l.label), payload.evolutionMensuelle.map((l) => l.montant), "Évolution des consommations par mois", p.couleurPrimaire);
      children.push(image(buf, LARGEUR_PAGE_EMU, Math.round(LARGEUR_PAGE_EMU * (480 / 900))));
    }

    if (inclut("consommationParFamille") && payload.consommationParFamille.length > 0) {
      children.push(titreSection("Consommation par Famille"));
      children.push(tableau(["Matricule", "Famille", "Montant consommé"], payload.consommationParFamille.map((l) => [l.matricule, l.famille, l.montant])));
    }

    if (inclut("detailParFamille")) {
      for (const f of payload.detailParFamille) {
        children.push(titreSection(`Détail — ${f.famille} (${f.matricule}) · Total ${fmt(f.totalFamille)} FCFA`));
        children.push(tableau(["Assuré", "Date", "Acte", "Montant"], f.lignes.map((l) => [l.assureNom, l.date, l.acte, l.montant])));
      }
    }

    if (inclut("top20Consommateurs") && payload.top20Consommateurs.length > 0) {
      children.push(titreSection("Top 20 des Consommateurs"));
      children.push(tableau(["N°", "Matricule", "Famille", "Montant consommé"], payload.top20Consommateurs.map((l, i) => [i + 1, l.matricule, l.famille, l.montant])));
      const buf = await genererGraphiqueBarres(payload.top20Consommateurs.map((l) => l.famille), payload.top20Consommateurs.map((l) => l.montant), "Top 20 des consommateurs", p.couleurPrimaire);
      children.push(image(buf, LARGEUR_PAGE_EMU, Math.round(LARGEUR_PAGE_EMU * (480 / 900))));
    }

    if (inclut("repartitionBeneficiaire") && payload.repartitionBeneficiaire.length > 0) {
      children.push(titreSection(`Répartition par Bénéficiaire · ${payload.totalPersonnesSoignees} personne(s) soignée(s)`));
      const rows: (string | number)[][] = [];
      for (const l of payload.repartitionBeneficiaire) {
        rows.push([l.type, l.nombre, l.montant, `${l.pctDepenses.toFixed(2)}%`, `${l.pctPopulation.toFixed(2)}%`]);
        rows.push(["   Féminin", l.feminin.nombre, l.feminin.montant, `${l.feminin.pctDepenses.toFixed(2)}%`, `${l.feminin.pctPopulation.toFixed(2)}%`]);
        rows.push(["   Masculin", l.masculin.nombre, l.masculin.montant, `${l.masculin.pctDepenses.toFixed(2)}%`, `${l.masculin.pctPopulation.toFixed(2)}%`]);
      }
      const totalMontant = payload.repartitionBeneficiaire.reduce((s, l) => s + l.montant, 0);
      rows.push(["Total", payload.totalPersonnesSoignees, totalMontant, "100%", "100%"]);
      children.push(tableau(["Type de Bénéficiaire", "Nombre", "Montant Remboursé", "% Dépenses", "% Population"], rows));
      const buf = await genererGraphiqueCamembert(payload.repartitionBeneficiaire.map((l) => l.type), payload.repartitionBeneficiaire.map((l) => l.montant), "Répartition par type de bénéficiaire", false);
      children.push(image(buf, Math.round(LARGEUR_PAGE_EMU * 0.55), Math.round(LARGEUR_PAGE_EMU * 0.55)));
    }

    if (inclut("consommationParRubrique") && payload.consommationParRubrique.length > 0) {
      children.push(titreSection(`Consommation par Rubrique · Total ${fmt(payload.totalConsomme)} FCFA`));
      children.push(tableau(["Rubrique", "Remboursé", "% du total"], payload.consommationParRubrique.map((l) => [l.libelle, l.montant, `${l.pct.toFixed(2)}%`])));
      const buf = await genererGraphiqueCamembert(payload.consommationParRubrique.map((l) => l.libelle), payload.consommationParRubrique.map((l) => l.montant), "Consommation par Rubrique", false);
      children.push(image(buf, Math.round(LARGEUR_PAGE_EMU * 0.5), Math.round(LARGEUR_PAGE_EMU * 0.5)));
    }

    if (inclut("consommationParPrestataire") && payload.consommationParPrestataire.length > 0) {
      children.push(titreSection("Consommation par Prestataire"));
      children.push(tableau(["Prestataire", "Remboursé", "% du total"], [...payload.consommationParPrestataire.map((l) => [l.libelle, l.montant, `${l.pct.toFixed(2)}%`]), ["Total", payload.consommationParPrestataire.reduce((s, l) => s + l.montant, 0), "100%"]]));
      const buf = await genererGraphiqueCamembert(payload.consommationParPrestataire.map((l) => l.libelle), payload.consommationParPrestataire.map((l) => l.montant), "Consommation par prestataire", true);
      children.push(image(buf, Math.round(LARGEUR_PAGE_EMU * 0.6), Math.round(LARGEUR_PAGE_EMU * 0.6)));
    }

    if (inclut("detailParPrestataire")) {
      for (const pr of payload.detailParPrestataire) {
        children.push(titreSection(`Détail — ${pr.prestataire} · Total ${fmt(pr.totalPrestataire)} FCFA`));
        children.push(tableau(["Assuré", "Date", "Acte", "Montant"], pr.lignes.map((l) => [l.assureNom, l.date, l.acte, l.montant])));
      }
    }

    if (inclut("top20Prestataires") && payload.top20Prestataires.length > 0) {
      children.push(titreSection("Top 20 des Prestataires"));
      children.push(tableau(["N°", "Prestataire", "Remboursé", "% du total"], payload.top20Prestataires.map((l, i) => [i + 1, l.libelle, l.montant, `${l.pct.toFixed(2)}%`])));
      const buf = await genererGraphiqueBarres(payload.top20Prestataires.map((l) => l.libelle), payload.top20Prestataires.map((l) => l.montant), "Top 20 des prestataires", p.couleurPrimaire);
      children.push(image(buf, LARGEUR_PAGE_EMU, Math.round(LARGEUR_PAGE_EMU * (480 / 900))));
    }

    if (inclut("evolutionSP")) {
      // Page dédiée + bloc reproduit exactement le modèle de référence,
      // même principe que le PDF (voir renderStatistiques ci-dessus pour
      // le détail de la structure attendue).
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(titreSection("Evolution du S/P"));

      // Couleurs EXACTES de la barre du diagramme (2026-09) — voir demande
      // utilisateur, capture annotée : "récupérer le bleu de la bande du
      // diagramme" (jamais éclairci) + texte blanc pour rester lisible
      // dessus. Bordures (3e correctif) : "pour chaque tableau, mets la
      // bordure externe complète afin que l'on [voie] qu'il s'agit bien
      // d[u] même tableau pour chaque cas" — UN SEUL tableau (4 lignes :
      // info/blanche/total/valeurs) avec un contour extérieur unique,
      // jamais de ligne verticale interne, seul un filet horizontal entre
      // le bandeau total et la ligne de valeurs (posé cellule par cellule
      // via `bordureBas`, docx n'ayant pas d'équivalent "une seule ligne
      // interne parmi d'autres" au niveau de la table entière).
      const bordureSP = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
      const bordureExterieureSP = { top: bordureSP, bottom: bordureSP, left: bordureSP, right: bordureSP };
      const celluleSP = (texte: string, fillHex: string | null, aligneDroite = false, colSpan = 1, bordureBas = false) => new TableCell({
        ...(colSpan > 1 ? { columnSpan: colSpan } : {}),
        ...(fillHex ? { shading: { type: ShadingType.CLEAR, fill: fillHex } } : {}),
        ...(bordureBas ? { borders: { bottom: bordureSP } } : {}),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: aligneDroite ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: texte, bold: true, color: fillHex ? "FFFFFF" : "1A1A1A", size: 15 })] })],
      });
      const celluleVideSP = () => new TableCell({ columnSpan: 6, children: [new Paragraph({ text: "" })] });
      const blocSPDocx = (bloc: typeof payload.spSansChargement, label: string) => new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: bordureExterieureSP,
        rows: [
          new TableRow({ children: [
            celluleSP(payload.contrat.client, couleurPrimaireHex),
            celluleSP(payload.contrat.numeroPolice, couleurPrimaireHex),
            celluleSP(payload.contrat.garantiesPrivees, couleurPrimaireHex),
            celluleSP(fmt(bloc.sinistres), couleurPrimaireHex, true),
            celluleSP(fmt(bloc.primes), couleurPrimaireHex, true),
            celluleSP((bloc.ratioPct / 100).toFixed(2).replace(".", ","), couleurPrimaireHex, true),
          ] }),
          new TableRow({ children: [celluleVideSP()] }),
          new TableRow({ children: [
            celluleSP(`TOTAL MALADIE ${label}`, couleurSecondaireHex, false, 3, true),
            celluleSP("", couleurSecondaireHex, false, 1, true),
            celluleSP("", couleurSecondaireHex, false, 1, true),
            celluleSP("", couleurSecondaireHex, false, 1, true),
          ] }),
          new TableRow({ children: [
            celluleSP("", null, false, 3),
            celluleSP(fmt(bloc.sinistres), null, true),
            celluleSP(fmt(bloc.primes), null, true),
            celluleSP(bloc.ratioPct.toFixed(2).replace(".", ","), null, true),
          ] }),
        ],
      });
      children.push(blocSPDocx(payload.spSansChargement, "sans Chargement"));
      children.push(new Paragraph({ text: "", spacing: { after: 150 } }));
      children.push(blocSPDocx(payload.spAvecChargement, "avec Chargement"));

      const buf = await genererGraphiqueBarresEtiquetees(
        ["S/P sans chargement", "S/P avec chargement"],
        [payload.spSansChargement.ratioPct / 100, payload.spAvecChargement.ratioPct / 100],
        "Evolution du S/P", [p.couleurPrimaire, p.couleurSecondaire],
        (v) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      );
      children.push(image(buf, Math.round(LARGEUR_PAGE_EMU * 0.75), Math.round(LARGEUR_PAGE_EMU * 0.75 * (480 / 900))));
    }

    if (inclut("analyse")) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(titreSection("Analyse & Recommandations"));
      for (const section of payload.analyse.sections) {
        children.push(new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: section.titre, bold: true, size: 20 })] }));
        for (const ligne of section.lignes) children.push(new Paragraph({ text: `•  ${ligne}` }));
      }
      if (payload.analyse.conclusionGenerale.length > 0) {
        children.push(new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: "Conclusion générale", bold: true, size: 20 })] }));
        for (const ligne of payload.analyse.conclusionGenerale) children.push(new Paragraph({ text: `•  ${ligne}` }));
      }
      // Projection/Conclusion stratégique/finale (2026-09) — voir
      // équivalent PDF ci-dessus pour le contexte (bug relevé en corrigeant
      // le langage prédictif/rétrospectif : ces blocs étaient calculés mais
      // jamais rendus jusqu'ici, dans aucun des deux formats).
      const blocAnalyseDocx = (titre: string, lignes: string[]) => {
        if (lignes.length === 0) return;
        children.push(new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: titre, bold: true, size: 20 })] }));
        for (const ligne of lignes) {
          if (ligne === "") continue;
          children.push(new Paragraph({ text: ligne.startsWith("•") ? ligne : `•  ${ligne}` }));
        }
      };
      blocAnalyseDocx(payload.analyse.projection.titre, payload.analyse.projection.lignes);
      blocAnalyseDocx("Conclusion stratégique", payload.analyse.conclusionStrategique);
      blocAnalyseDocx("Conclusion finale", payload.analyse.conclusionFinale);
    }

    // ── Page de garde ──────────────────────────────────────────────────
    // Personnalisable par société (2026-09) — voir demande utilisateur.
    // Section Word séparée (sans en-tête/pied de page) pour rester distincte
    // des pages de contenu qui suivent.
    const coverChildren: Paragraph[] = [];
    if (pageGardeImage) {
      try {
        const donneesImage = Buffer.isBuffer(pageGardeImage) ? pageGardeImage : fs.readFileSync(pageGardeImage);
        coverChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: donneesImage, transformation: { width: LARGEUR_PAGE_EMU, height: Math.round(LARGEUR_PAGE_EMU * 1.3) }, type: path.extname(p.statistiquesPageGarde ?? "").toLowerCase() === ".png" ? "png" : "jpg" })],
        }));
      } catch { /* image illisible — jamais bloquant */ }
    } else {
      coverChildren.push(new Paragraph({ children: [new TextRun({ text: p.nom, bold: true, size: 30, color: couleurPrimaireHex })] }));
      coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "RAPPORT STATISTIQUE", bold: true, size: 32 })] }));
    }
    coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: payload.contrat.client, bold: true, size: 26, color: couleurPrimaireHex })] }));
    coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Police N° ${payload.contrat.numeroPolice}   ·   ${payload.contrat.compagnie}`, size: 20 })] }));
    coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Période : ${payload.periode.du} au ${payload.periode.au}`, size: 18, color: "555555" })] }));

    // ── En-tête (logo) + pied de page des pages de contenu ──────────────
    const enteteChildren: Paragraph[] = [];
    if (logoImage) {
      try {
        const donneesLogo = Buffer.isBuffer(logoImage) ? logoImage : fs.readFileSync(logoImage);
        enteteChildren.push(new Paragraph({ children: [new ImageRun({ data: donneesLogo, transformation: { width: 130, height: 46 }, type: path.extname(p.logo ?? "").toLowerCase() === ".png" ? "png" : "jpg" })] }));
      } catch { enteteChildren.push(new Paragraph({ children: [new TextRun({ text: p.nom, bold: true, color: couleurPrimaireHex })] })); }
    } else {
      enteteChildren.push(new Paragraph({ children: [new TextRun({ text: p.nom, bold: true, color: couleurPrimaireHex })] }));
    }
    const dateArrete = new Date().toLocaleDateString("fr-FR");

    const document = new DocxDocument({
      sections: [
        { properties: {}, children: coverChildren },
        {
          properties: {},
          headers: { default: new Header({ children: enteteChildren }) },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { style: BorderStyle.SINGLE, size: 8, color: couleurPrimaireHex } },
                  tabStops: [{ type: "center", position: 4500 }, { type: "right", position: 9000 }],
                  children: [
                    new TextRun({ text: "Document confidentiel", size: 14, color: "555555" }),
                    new TextRun({ text: `\tArrêté de situation ${payload.contrat.client} au ${dateArrete}`, size: 14, color: "555555" }),
                    new TextRun({ text: "\tPage ", size: 14, color: "555555" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "555555" }),
                    new TextRun({ text: " sur ", size: 14, color: "555555" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "555555" }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });
    const buffer = await Packer.toBuffer(document);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="Statistiques-${payload.contrat.id}.docx"`);
    res.send(buffer);
  }

  // ── Bordereaux Sinistres / Production / Encaissement ────────────────
  // Reconstruction (2026-09, voir commentaire en tête de la section Feuille
  // de Soins) — la donnée reste calculée par BordereauxService (resté
  // intact), seule la mise en forme PDF/XLSX est reconstruite ici.
  private async envoyerTableauPdf(res: Response, filename: string, titre: string, sousTitre: string, cols: { h: string; w: number }[], rows: (string | number)[][], totalLabel: string, totalValeur: string) {
    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40, layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    let y = 40;

    doc.fontSize(12).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, y);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(titre, left, y, { width, align: "right" });
    y += 16;
    doc.fontSize(8).font("Helvetica").fillColor("#555").text(sousTitre, left, y, { width, align: "right" });
    doc.fillColor("#000");
    y += 20;

    const drawHeader = () => {
      doc.rect(left, y, width, 16).fill(p.couleurPrimaire);
      let cx = left;
      doc.fillColor("#fff").fontSize(7).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 3, y + 4, { width: c.w - 6 }); cx += c.w; }
      doc.fillColor("#000");
      y += 16;
    };
    drawHeader();
    doc.font("Helvetica").fontSize(7);
    for (const row of rows) {
      const rowH = 13;
      if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 40; drawHeader(); doc.font("Helvetica").fontSize(7); }
      let cx = left;
      for (let i = 0; i < cols.length; i++) {
        const v = typeof row[i] === "number" ? fmt(row[i] as number) : String(row[i] ?? "");
        doc.text(v, cx + 3, y + 3, { width: cols[i].w - 6, align: i === 0 ? "left" : "right" });
        cx += cols[i].w;
      }
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#eee").stroke();
      y += rowH;
    }
    y += 8;
    doc.font("Helvetica-Bold").fontSize(9).text(`${totalLabel} : ${totalValeur}`, left, y, { width, align: "right" });
    doc.end();
  }

  private async envoyerTableauXlsx(res: Response, filename: string, headers: string[], rows: (string | number)[][], totalRow?: (string | number)[]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Bordereau");
    ws.addRow(headers).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    if (totalRow) { ws.addRow(totalRow).font = { bold: true }; }
    ws.columns.forEach((c) => { c.width = 20; });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    res.send(Buffer.from(buffer));
  }

  async renderBordereauSinistres(du: string | undefined, au: string | undefined, compagnieId: string | undefined, typeReglement: "maladie" | "comptable", format: "pdf" | "xlsx", res: Response) {
    const payload = await this.bordereaux.sinistres(du, au, compagnieId, typeReglement);
    const rows = payload.groupes.flatMap((g) => g.lignes.map((l) => [l.dateSoins, l.dateReglement, l.numeroPolice, g.souscripteur, l.assurePrincipal, l.prestataire, l.numeroReglement, l.fraisReels, l.partGarant, l.tps, l.netAPayer]));
    if (format === "xlsx") {
      return this.envoyerTableauXlsx(res, `Bordereau-Sinistres-${typeReglement}`,
        ["Date soins", "Date règlement", "Police", "Souscripteur", "Assuré", "Prestataire", "N° règlement", "Frais réels", "Part garant", "TPS", "Net à payer"],
        rows, ["", "", "", "", "", "", "TOTAL", payload.total.fraisReels, payload.total.partGarant, payload.total.tps, payload.total.netAPayer]);
    }
    return this.envoyerTableauPdf(res, `Bordereau-Sinistres-${typeReglement}`, "BORDEREAU SINISTRES", `${payload.compagnie ?? ""} · ${payload.typeReglement === "maladie" ? "Règlement Maladie" : "Règlement Comptable"} · ${du ?? "…"} au ${au ?? "…"}`,
      [{ h: "Date soins", w: 65 }, { h: "Date règl.", w: 65 }, { h: "Police", w: 70 }, { h: "Souscripteur", w: 110 }, { h: "Assuré", w: 100 }, { h: "Prestataire", w: 110 }, { h: "N° règl.", w: 70 }, { h: "Frais réels", w: 70 }, { h: "Part garant", w: 70 }, { h: "TPS", w: 55 }, { h: "Net à payer", w: 75 }],
      rows, "NET TOTAL À PAYER", `${fmt(payload.total.netAPayer)} FCFA`);
  }

  private async renderBordereauProductionType(payload: BordereauProductionPayload, titre: string, filenamePrefix: string, format: "pdf" | "xlsx", res: Response, du?: string, au?: string) {
    const rows = payload.groupes.flatMap((g) => g.lignes.map((l) => [l.numeroPolice, l.codeAssure, l.numQuittance, l.dateEmisQuittance, l.nomSouscripteur, l.dateDebut, l.dateFin, l.produit, l.primes, l.access, l.taxes, l.primesTotales]));
    if (format === "xlsx") {
      return this.envoyerTableauXlsx(res, filenamePrefix,
        ["Police", "Code assuré", "N° quittance", "Date quittance", "Souscripteur", "Date début", "Date fin", "Produit", "Primes", "Accessoires", "Taxes", "Total"],
        rows, ["", "", "", "", "", "", "", "TOTAL", payload.total.primes, payload.total.access, payload.total.taxes, payload.total.primesTotales]);
    }
    return this.envoyerTableauPdf(res, filenamePrefix, titre, `${du ?? "…"} au ${au ?? "…"}`,
      [{ h: "Police", w: 65 }, { h: "Code assuré", w: 70 }, { h: "N° quittance", w: 65 }, { h: "Date quitt.", w: 60 }, { h: "Souscripteur", w: 120 }, { h: "Début", w: 55 }, { h: "Fin", w: 55 }, { h: "Produit", w: 70 }, { h: "Primes", w: 65 }, { h: "Access.", w: 55 }, { h: "Taxes", w: 55 }, { h: "Total", w: 65 }],
      rows, "PRIMES TOTALES", `${fmt(payload.total.primesTotales)} FCFA`);
  }

  async renderBordereauProduction(du: string | undefined, au: string | undefined, compagnieId: string | undefined, format: "pdf" | "xlsx", res: Response) {
    const payload = await this.bordereaux.production(du, au, compagnieId);
    return this.renderBordereauProductionType(payload, "BORDEREAU DE PRODUCTION", "Bordereau-Production", format, res, du, au);
  }

  async renderBordereauEncaissement(du: string | undefined, au: string | undefined, compagnieId: string | undefined, format: "pdf" | "xlsx", res: Response) {
    const payload = await this.bordereaux.encaissement(du, au, compagnieId);
    return this.renderBordereauProductionType(payload, "BORDEREAU D'ENCAISSEMENT DE PRIME", "Bordereau-Encaissement", format, res, du, au);
  }

  // ── Reste du chantier de reconstruction (2026-09) — voir commentaire en
  // tête de la section Feuille de Soins. Les méthodes ci-dessous couvrent
  // les documents restants découverts manquants (cotation, courrier,
  // prospection, TPS, fiche prestataire, lettre chèque, règlement,
  // avis d'échéance, exports contrat, quittance de tranche) — simplifiées
  // (tableaux/paragraphes, pas de reproduction pixel-à-pixel), la donnée
  // provenant systématiquement du VRAI service métier concerné (resté
  // intact), jamais recalculée ici.

  // Offre de cotation — un ou plusieurs produits du MÊME client regroupés
  // en une seule proposition (voir schema.prisma Prospect.logo : "logo du
  // client pour le document de cotation"). Logo du prospect lié en
  // priorité, sinon celui de la première cotation.
  async renderCotationOffre(cotationIds: string[], res: Response) {
    if (cotationIds.length === 0) throw new BadRequestException("Aucune cotation sélectionnée.");
    const cotations = await Promise.all(cotationIds.map((id) => this.cotation.findOne(id)));
    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Offre-${cotations[0].id}.pdf"`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    for (let i = 0; i < cotations.length; i++) {
      if (i > 0) doc.addPage();
      const c = cotations[i];
      doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(`OFFRE DE COTATION — ${c.branche.toUpperCase()}`, left, 60, { width, align: "right" });
      doc.fontSize(9).font("Helvetica").text(`Client : ${c.clientNom}`, left, 78, { width, align: "right" });

      let y = 110;
      let yy = champ(doc, left, y, "Population :", String(c.population), 100, 200, { boldLabel: true });
      yy = champ(doc, left, yy, "Territorialité :", c.territorialite, 100, 300, { boldLabel: true });
      if (c.tauxCouvertureAmbulatoire) yy = champ(doc, left, yy, "Taux Ambulatoire :", c.tauxCouvertureAmbulatoire, 130, width - 130, { boldLabel: true });
      if (c.tauxCouvertureHospitalisation) yy = champ(doc, left, yy, "Taux Hospitalisation :", c.tauxCouvertureHospitalisation, 130, width - 130, { boldLabel: true });
      if (c.exclusions) yy = champ(doc, left, yy, "Exclusions :", c.exclusions, 100, width - 100, { boldLabel: true });
      if (c.clauseAjustement) yy = champ(doc, left, yy, "Ajustement :", c.clauseAjustement, 100, width - 100, { boldLabel: true });
      y = yy + 20;

      doc.rect(left, y, width, 80).stroke();
      const recap: [string, string][] = [
        ["Prime nette", `${fmt(Number(c.primeNette))} FCFA`], ["Cartes", `${fmt(Number(c.montantCartes))} FCFA`],
        ["Accessoires", `${fmt(Number(c.montantAccessoires))} FCFA`], ["Taxe", `${fmt(Number(c.montantTaxe))} FCFA`],
        ["PRIME TTC", `${fmt(Number(c.primeTTC))} FCFA`],
      ];
      let ry = y + 8;
      for (const [label, valeur] of recap) { champ(doc, left + 10, ry, label, valeur, 200, width - 220, { boldLabel: label === "PRIME TTC", boldValeur: true, alignValeur: "right" }); ry += 14; }
      y += 90;

      doc.fontSize(8).font("Helvetica").fillColor("#555").text(`Cotation établie le ${c.dateCreation}${c.conditionsFermete ? ` — ${c.conditionsFermete}` : ""}`, left, y, { width });
      doc.fillColor("#000");
    }
    doc.end();
  }

  // Réseau de soins — annuaire des prestataires conventionnés (aucun
  // argument : c'est un document global, pas scopé à un contrat).
  async renderReseauSoins(res: Response) {
    const prestataires = await this.prestataires.findAllReseau({});
    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="Reseau-de-Soins.pdf"');
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    let y = 40;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, y);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text("RÉSEAU DE SOINS CONVENTIONNÉ", left, y, { width, align: "right" });
    doc.fillColor("#000");
    y += 30;

    const cols = [{ h: "Prestataire", w: width * 0.3 }, { h: "Type", w: width * 0.18 }, { h: "Ville", w: width * 0.15 }, { h: "Adresse", w: width * 0.22 }, { h: "Téléphone", w: width * 0.15 }];
    const drawHeader = () => {
      doc.rect(left, y, width, 16).fill(p.couleurPrimaire);
      let cx = left;
      doc.fillColor("#fff").fontSize(7.5).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 3, y + 4, { width: c.w - 6 }); cx += c.w; }
      doc.fillColor("#000");
      y += 16;
    };
    drawHeader();
    doc.font("Helvetica").fontSize(7.5);
    for (const pr of prestataires) {
      const rowH = 14;
      if (y + rowH > doc.page.height - 50) { doc.addPage(); y = 40; drawHeader(); doc.font("Helvetica").fontSize(7.5); }
      let cx = left;
      const vals = [pr.nom, pr.type ?? "—", pr.ville ?? "—", pr.adresse ?? "—", pr.telephone ?? "—"];
      for (let i = 0; i < cols.length; i++) { doc.text(vals[i], cx + 3, y + 3, { width: cols[i].w - 6 }); cx += cols[i].w; }
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor("#eee").stroke();
      y += rowH;
    }
    doc.end();
  }

  // Fiche prestataire — synthèse imprimable d'un établissement du réseau.
  async renderFichePrestataire(id: string, res: Response) {
    const pr = await this.prestataires.findOne(id);
    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Fiche-${pr.id}.pdf"`);
    doc.pipe(res);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#000").text(pr.nom, left, 65, { width, align: "right" });
    let y = 100;
    const champs: [string, string][] = [
      ["Type :", pr.type ?? "—"], ["Secteur :", pr.secteur ?? "—"], ["Spécialité :", pr.specialite ?? "—"],
      ["Ville :", pr.ville ?? "—"], ["Adresse :", pr.adresse ?? "—"], ["Téléphone :", pr.telephone ?? "—"],
      ["Statut conventionnement :", pr.statutConvention ?? "—"],
    ];
    for (const [label, valeur] of champs) y = champ(doc, left, y, label, valeur, 180, width - 180, { boldLabel: true });
    doc.end();
  }

  // Courrier — corps HTML (RichTextEditor) réduit en texte brut (pas de
  // reproduction de la mise en forme riche d'origine).
  async renderCourrier(id: string, res: Response) {
    const c = await this.courrier.findOne(id);
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Courrier-${c.reference}.pdf"`);
    doc.pipe(res);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    this.dessinerLogoEntete(doc, logoImage, left, 15, 30);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 50);
    doc.fontSize(8).font("Helvetica").fillColor("#333").text(`${p.boitePostale} ${p.ville} - ${p.pays}   Tél.: ${p.telephone}`, left, 66);
    doc.fillColor("#000");
    doc.fontSize(9).text(`Réf. ${c.reference}`, right - 200, 50, { width: 200, align: "right" });
    doc.text(c.dateCreation, right - 200, 62, { width: 200, align: "right" });

    let y = 100;
    doc.font("Helvetica-Bold").text(c.destinataireNom, left, y);
    y += 12;
    if (c.destinataireAdresse) { doc.font("Helvetica").text(c.destinataireAdresse, left, y, { width: 250 }); y += 14; }
    y += 20;
    doc.font("Helvetica-Bold").fontSize(10).text(`Objet : ${c.objet}`, left, y, { width });
    y += 24;

    const texte = c.corps.replace(/<\/(p|div|li)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    doc.font("Helvetica").fontSize(9);
    for (const paragraphe of texte.split("\n")) {
      if (!paragraphe.trim()) { y += 8; continue; }
      if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
      doc.text(paragraphe.trim(), left, y, { width });
      y += doc.heightOfString(paragraphe.trim(), { width }) + 6;
    }
    doc.end();
  }

  // Tableau de Prospection — liste complète des prospects (Production).
  async renderTableauProspection(format: "pdf" | "xlsx", res: Response) {
    const prospects = await this.crm.findAll();
    const rows = prospects.map((pr) => [pr.nom, pr.type, pr.source, pr.etape, Number(pr.valeurEstimee), pr.commercial, pr.dernierContact]);
    if (format === "xlsx") {
      return this.envoyerTableauXlsx(res, "Tableau-Prospection", ["Nom", "Type", "Source", "Étape", "Valeur estimée", "Commercial", "Dernier contact"], rows);
    }
    return this.envoyerTableauPdf(res, "Tableau-Prospection", "TABLEAU DE PROSPECTION", `${prospects.length} prospect(s)`,
      [{ h: "Nom", w: 130 }, { h: "Type", w: 70 }, { h: "Source", w: 80 }, { h: "Étape", w: 80 }, { h: "Valeur estimée", w: 90 }, { h: "Commercial", w: 90 }, { h: "Dernier contact", w: 80 }],
      rows, "TOTAL VALEUR ESTIMÉE", `${fmt(prospects.reduce((s, pr) => s + Number(pr.valeurEstimee), 0))} FCFA`);
  }

  // État TPS — voir ReglementPrestataireService.etatTps (calcul intact).
  async renderEtatTps(filtres: { prestataireId?: string; annee?: string; du?: string; au?: string }, res: Response) {
    const etat = await this.reglementPrestataire.etatTps(filtres);
    const lignes = (etat as { lignes?: { prestataire: string; periode: string; baseRemboursement: number; montantTps: number }[] }).lignes ?? [];
    const total = (etat as { total?: number }).total ?? lignes.reduce((s, l) => s + l.montantTps, 0);
    return this.envoyerTableauPdf(res, "Etat-TPS", "ÉTAT TPS", `${filtres.du ?? "…"} au ${filtres.au ?? "…"}`,
      [{ h: "Prestataire", w: 160 }, { h: "Période", w: 100 }, { h: "Base remboursement", w: 130 }, { h: "TPS", w: 100 }],
      lignes.map((l) => [l.prestataire, l.periode, l.baseRemboursement, l.montantTps]), "TOTAL TPS", `${fmt(total)} FCFA`);
  }

  async renderListePrestatairesTps(res: Response) {
    const liste = await this.reglementPrestataire.prestatairesAssujettisTps();
    const rows = (liste as { nom: string; ville?: string | null; tpsDateEffet?: string | null }[]).map((pr) => [pr.nom, pr.ville ?? "—", pr.tpsDateEffet ?? "—"]);
    return this.envoyerTableauPdf(res, "Liste-Prestataires-TPS", "PRESTATAIRES ASSUJETTIS À LA TPS", `${rows.length} prestataire(s)`,
      [{ h: "Prestataire", w: 250 }, { h: "Ville", w: 150 }, { h: "Date d'effet", w: 150 }], rows, "TOTAL", String(rows.length));
  }

  // Lettre chèque / "Règlement comptable" (2026-09) — voir demande
  // utilisateur : "il faut minutieusement appliquer ces consignes... et
  // reproduire le modèle à la lettre dans les moindres détails", annotée
  // sur une capture du rendu réel + "modèle chèque.jpg" (spécimen de chèque
  // bancaire réel). Corrections apportées :
  // 1) Bloc "À l'attention de" resserré sous l'en-tête (moins d'espace
  //    mort) — voir annotation "Déplacer ce bloc... dans cette zone".
  // 2) Tableau Donneur d'ordre/Bénéficiaire/Montant/Référence SUPPRIMÉ —
  //    voir annotation "Supprimer ce bloc et faire une vraie mise en page
  //    pour un courrier de type lettre chèque. Dans le corps du courrier il
  //    faut mention de chèque, la banque, le montant du chèque" : ces
  //    informations sont désormais tissées dans le corps du texte.
  // 3) Bloc de signature déplacé à DROITE, mention "Signature" retirée,
  //    "POUR LA SOCIÉTÉ" en capitales — voir annotation correspondante.
  // 4) Visuel de chèque ABANDONNÉ (2026-09) — voir demande utilisateur :
  //    après de nombreuses tentatives de reproduction fidèle d'un chèque
  //    bancaire réel ("modèle chèque.jpg" puis "chèque new.jpg"), jamais
  //    jugée satisfaisante malgré des corrections vérifiées à chaque tour
  //    ("Maintenant si tu ne peux pas reproduire mieux supprime le modèle
  //    et fais quelque chose de simple") : remplacé par un simple tableau
  //    récapitulatif texte, sans tentative d'imitation graphique.
  // Correction (2026-09) — voir demande utilisateur : "celui qui tire le
  // chèque ce n'est pas la compagnie d'assurance quand il s'agit d'un
  // règlement établi par le courtier". `lettre.compagnieId` n'est qu'un
  // critère de regroupement des bordereaux à l'écran de recherche (voir
  // ReglementComptableService.findEligibles — "au moins une ligne touche
  // cette compagnie"), PAS une relation "compte d'un tiers" : le chèque est
  // TOUJOURS tiré par le courtier (MedAssur, `p`) lui-même — la compagnie
  // n'apparaît nulle part dans cette lettre, jamais comme "donneur d'ordre".
  async renderLettreCheque(id: string, res: Response) {
    const lettre = await this.reglementComptable.findOne(id);
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Lettre-Cheque-${lettre.numero}.pdf"`);
    doc.pipe(res);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const montantTotal = Number(lettre.montantTotal);

    // Mise en page de la lettre (2026-09) — voir demande utilisateur :
    // "voici comment je voudrais que tu réorganise le règlement comptable...
    // reproduis cet emplacement à l'identique avec exactitude" + "respecte
    // les positions et tailles de police", sur un modèle transmis
    // ("Lettre-Cheque-LC-000001-1.pdf"). Coordonnées et tailles ci-dessous
    // mesurées caractère par caractère sur ce PDF (pdfplumber) — PAS de
    // repositionnement libre. Format "fenêtre d'enveloppe" : bloc
    // destinataire en position FIXE (345, 118), indépendante de la hauteur
    // de l'en-tête ; corps de lettre démarrant à une position FIXE (y=230),
    // indépendante de la hauteur du bloc destinataire.
    this.dessinerLogoEntete(doc, logoImage, left, 8);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 39);
    doc.fillColor("#000").fontSize(11).font("Helvetica").text(`${p.ville}, le ${lettre.dateEmission}`, left, 39, { width, align: "right" });
    doc.fillColor("#333").fontSize(10).font("Helvetica");
    doc.text("Adresse :", left, 53);
    doc.text(`${p.boitePostale} ${p.ville} - ${p.pays} •`, left, 68);
    doc.text(`Tél. : ${p.telephone} •`, left, 83);
    if (p.email) doc.text(`Email : ${p.email}`, left, 98.8);

    // Bloc destinataire — repositionné à droite, plus bas (voir modèle) ;
    // "BP:" reproduit tel quel (le prestataire n'a pas de champ boîte
    // postale dédié en base, contrairement à l'adresse libre — voir
    // Prestataire.adresse/ville dans schema.prisma).
    const recipientX = right - 210;
    // Largeur jusqu'au bord physique de la page (pas la marge de contenu
    // habituelle 555) — voir modèle, où ce nom tient sur une seule ligne en
    // débordant légèrement de la marge de contenu standard. Hauteur du nom
    // mesurée dynamiquement pour ne jamais chevaucher "BP:"/ville en
    // dessous si un nom exceptionnellement long repasse quand même à la
    // ligne (voir échecs précédents du visuel de chèque, même principe).
    const recipientWidth = doc.page.width - recipientX - 15;
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(12).text("À l'attention de :", recipientX, 118);
    doc.text(lettre.prestataire.nom, recipientX, 134, { width: recipientWidth });
    const nomHauteur = doc.heightOfString(lettre.prestataire.nom, { width: recipientWidth });
    const bpY = 134 + Math.max(nomHauteur, 14) + 4;
    doc.font("Helvetica").fontSize(12);
    doc.text("BP:", recipientX, bpY);
    doc.text(lettre.prestataire.ville ?? "", recipientX, bpY + 15);

    let y = 230;
    doc.font("Helvetica-Bold").fontSize(12).text("Objet : Lettre d'accompagnement d'un chèque", left, y, { width });
    y += 23;
    doc.font("Helvetica").fontSize(12).text("Madame, Monsieur,", left, y);
    y += 26;
    // Corps du courrier (2026-09) — voir demande utilisateur : "dans le
    // corps du courrier il faut mention de chèque, la banque, le montant du
    // chèque". Le courtier (MedAssur) est TOUJOURS l'émetteur — jamais la
    // compagnie, voir commentaire de fonction. Numéro de chèque/banque/
    // montant/bénéficiaire en gras au fil du texte, comme le modèle.
    doc.font("Helvetica").fontSize(12);
    doc.text("Par la présente, nous vous informons qu'un chèque n° ", left, y, { width, continued: true });
    doc.font("Helvetica-Bold").text(String(lettre.numeroCheque), { continued: true });
    doc.font("Helvetica").text(", tiré sur ", { continued: true });
    doc.font("Helvetica-Bold").text(lettre.banque.nom, { continued: true });
    doc.font("Helvetica").text(" d'un montant de ", { continued: true });
    doc.font("Helvetica-Bold").text(`${fmt(montantTotal)} FCFA,`, { continued: true });
    doc.font("Helvetica").text(" est émis au profit de ", { continued: true });
    doc.font("Helvetica-Bold").text(lettre.prestataire.nom, { continued: true });
    doc.font("Helvetica").text(` en règlement de la référence ${lettre.numero}. Les informations ci-dessous doivent être vérifiées par l'établissement bancaire concerné avant toute opération.`);
    y = doc.y + 22;

    doc.text("Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.", left, y, { width });
    y += 72;
    // Bloc de signature déplacé à droite, "Signature" retiré, "POUR LA
    // SOCIÉTÉ" en capitales (2026-09) — voir annotation utilisateur.
    doc.font("Helvetica-Bold").fontSize(12).text("POUR LA SOCIÉTÉ", right - 180, y, { width: 180, align: "right" });
    y += 86;

    // Récapitulatif des bordereaux réglés — ajout propre à l'application
    // (une lettre chèque peut regrouper plusieurs bordereaux), absent du
    // modèle papier mais nécessaire à la traçabilité.
    if (lettre.bordereaux.length > 1) {
      doc.font("Helvetica-Bold").fontSize(8.5).text("Bordereaux réglés par ce chèque :", left, y);
      y += 13;
      doc.font("Helvetica").fontSize(8);
      for (const b of lettre.bordereaux) {
        doc.text(`${b.numero}   ·   ${b.periode}   ·   ${fmt(Number((b as { montantNet: number }).montantNet ?? b.montantTotal))} FCFA`, left, y, { width });
        y += 12;
      }
      y += 16;
    }

    doc.moveTo(left, y).lineTo(right, y).strokeColor("#999").lineWidth(0.5).stroke();
    y += 31;

    // Visuel de chèque (2026-09) — nouveau modèle transmis par l'utilisateur
    // ("chiffreenlettre.com" : fond dégradé pâle, logo + nom en haut à
    // gauche, n° de compte/chèque empilés en haut à droite, "Payez contre
    // ce chèque en euros" + montant en lettres, case du montant en chiffres
    // à droite, ligne "à [bénéficiaire]", bloc coordonnées bancaires/
    // titulaire en bas à gauche, "A :/LE :/Signature :" en bas à droite,
    // ligne MEMO, ligne magnétique tout en bas). Reproduit sobrement, SANS
    // le filigrane texturé qui avait échoué sur les tentatives précédentes
    // — juste un dégradé pâle uni + zones de texte fidèles aux positions du
    // modèle, hauteurs mesurées dynamiquement pour ne jamais chevaucher
    // (voir échecs précédents : nom de bénéficiaire/montant en lettres sur
    // 2 lignes).
    const chH = 215;
    const chLeft = left, chW = width;
    const X = (frac: number) => chLeft + chW * frac;
    const Y = (frac: number) => y + chH * frac;
    const grad = doc.linearGradient(chLeft, y, chLeft + chW, y + chH);
    grad.stop(0, "#e8f4ec").stop(1, "#e6edf6");
    doc.rect(chLeft, y, chW, chH).fill(grad);
    doc.rect(chLeft, y, chW, chH).strokeColor("#999").lineWidth(0.8).stroke();

    // Marge intérieure (2026-09) — voir demande utilisateur : "centre bien
    // les textes pour éviter cette sensation de texte serrés dans le coin
    // gauche, équilibre bien". Tout le contenu part désormais de PAD (pas
    // de X(0), collé au bord) et s'étend jusqu'à 1-PAD.
    const PAD = 0.035;

    // En-tête : logo + nom de banque à gauche, n° de compte / n° de chèque
    // empilés à droite (voir modèle, coin "000097684200 / 5864").
    doc.circle(X(PAD + 0.018), Y(0.09), 7).lineWidth(1).strokeColor(p.couleurPrimaire).stroke();
    doc.font("Helvetica-Bold").fontSize(13).fillColor(p.couleurPrimaire).text(lettre.banque.nom.toUpperCase(), X(PAD + 0.05), Y(0.045), { width: chW * 0.42 });
    doc.fillColor("#000");
    doc.font("Helvetica-Bold").fontSize(9).text(lettre.banque.compteNumero ?? "—", X(0.53), Y(0.045), { width: chW * (0.965 - 0.53), align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor("#555").text(String(lettre.numeroCheque), X(0.53), Y(0.125), { width: chW * (0.965 - 0.53), align: "right" });
    doc.fillColor("#000");

    // "Payez contre ce chèque en francs CFA" + montant en lettres (hauteur
    // mesurée dynamiquement pour ne jamais chevaucher la ligne "à" du
    // bénéficiaire en dessous, quelle que soit sa longueur réelle).
    const largeurMontants = chW * (0.6 - PAD);
    let my = Y(0.26);
    doc.font("Helvetica").fontSize(8.5).text("Payez contre ce chèque en francs CFA", X(PAD), my, { width: largeurMontants });
    my += 14;
    doc.font("Helvetica-Bold").fontSize(8.5);
    const montantLettres = montantEnLettresFcfa(montantTotal);
    const hMontantLettres = doc.heightOfString(montantLettres, { width: largeurMontants });
    doc.text(montantLettres, X(PAD), my, { width: largeurMontants });
    doc.moveTo(X(PAD), my + hMontantLettres + 2).lineTo(X(0.6), my + hMontantLettres + 2).strokeColor("#000").lineWidth(0.5).stroke();

    // Case du montant en chiffres, à droite (voir case "€" du modèle).
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#555").text("FCFA", X(0.66), Y(0.255));
    doc.rect(X(0.74), Y(0.22), chW * (0.965 - 0.74), chH * 0.15).fillAndStroke("#fff", "#000");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(fmt(montantTotal), X(0.74), Y(0.275), { width: chW * (0.965 - 0.74), align: "center" });

    // "à [bénéficiaire]" — positionné SOUS la ligne du montant en lettres,
    // avec une marge fixe (jamais une fraction figée de chH, qui pourrait
    // chevaucher si le montant en lettres passe sur 2 lignes).
    const ay = my + hMontantLettres + 16;
    doc.font("Helvetica").fontSize(8.5).text("à", X(PAD), ay);
    doc.font("Helvetica-Bold").text(lettre.prestataire.nom, X(PAD + 0.02), ay, { width: chW * (0.6 - PAD - 0.02) });
    doc.moveTo(X(PAD + 0.02), ay + 12).lineTo(X(0.6), ay + 12).strokeColor("#000").lineWidth(0.5).stroke();

    // Bloc du bas — 3 colonnes RÉPARTIES ÉGALEMENT sur toute la largeur
    // utile (banque / compte-titulaire / signature), au lieu de tasser les
    // deux premières à gauche en laissant un grand vide avant la 3e — voir
    // demande utilisateur "équilibre bien".
    const col1 = PAD, col2 = PAD + 0.33, col3 = PAD + 0.665;
    const colW = chW * 0.28;
    const iy0 = ay + 28;
    let iy = iy0;
    doc.font("Helvetica").fontSize(7).fillColor("#555");
    doc.text("Payable au Gabon", X(col1), iy);
    doc.text("N° de compte", X(col2), iy);
    iy += 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
    doc.text(lettre.banque.nom, X(col1), iy, { width: colW });
    doc.text(lettre.banque.compteNumero ?? "—", X(col2), iy, { width: colW });
    iy += 12;
    doc.font("Helvetica").fontSize(7.5).fillColor("#333");
    if (lettre.banque.adresse) doc.text(lettre.banque.adresse, X(col1), iy, { width: colW });
    doc.text(`${p.boitePostale} ${p.ville}`, X(col2), iy, { width: colW });
    iy += 11;
    if (lettre.banque.telephone) doc.text(`Tél. ${lettre.banque.telephone}`, X(col1), iy, { width: colW });
    // Titulaire du compte = TOUJOURS le courtier (MedAssur), jamais la
    // compagnie — voir commentaire de fonction ci-dessus.
    doc.text(p.nom, X(col2), iy, { width: colW });
    doc.fillColor("#000");

    // 3e colonne : "A : / LE : / Signature :", alignée sur la même rangée
    // de départ que les deux autres (iy0), pour ne pas paraître "posée à
    // part" — voir demande utilisateur "équilibre bien".
    doc.font("Helvetica").fontSize(8).fillColor("#000");
    doc.text(`A : ${p.ville}`, X(col3), iy0);
    doc.text(`LE : ${lettre.dateEmission}`, X(col3), iy0 + 14);
    doc.font("Helvetica-Bold").text("Signature :", X(col3), iy0 + 32);
    doc.moveTo(X(col3), iy0 + 47).lineTo(X(col3) + colW, iy0 + 47).strokeColor("#000").lineWidth(0.5).stroke();
    doc.fillColor("#000");

    // "MEMO" — référence du bordereau réglé, comme la ligne "MEMO :" du
    // modèle.
    doc.font("Helvetica").fontSize(7.5).fillColor("#555").text(`MEMO : Réf. ${lettre.numero}`, X(PAD), Y(0.87));
    doc.fillColor("#000");

    // Ligne magnétique (CMC7 simplifiée), tout en bas, comme le modèle.
    doc.font("Helvetica").fontSize(8).fillColor("#333").text(
      `${lettre.banque.compteNumero ?? "0000000"}   ${lettre.banque.codeBanque ?? "0000"}   ${String(lettre.numeroCheque)}`,
      X(PAD), Y(0.955),
    );
    doc.fillColor("#000");

    y += chH + 14;

    // Pied de page (2026-09) — voir demande utilisateur : "tu ajouteras sur
    // le règlement comptable... le pied de page" — coordonnées de la
    // société utilisatrice (courtier/compagnie/mutuelle), pas MedAssur.
    this.dessinerPiedDePage(doc, p);

    // État détaillé des factures (2026-09) — voir demande utilisateur : "en
    // plus, de la référence du règlement comptable... une seconde page avec
    // la liste des factures liées au règlement". Toutes les
    // PriseEnCharge de TOUS les bordereaux couverts par ce chèque (une
    // lettre chèque peut en regrouper plusieurs, voir bloc "Bordereaux
    // réglés par ce chèque" ci-dessus), à plat.
    this.dessinerEtatFactures(
      doc, "ÉTAT DÉTAILLÉ DES FACTURES", `Lettre chèque n° ${lettre.numero} — Chèque n° ${lettre.numeroCheque}`,
      lettre.prestataire,
      lettre.bordereaux.flatMap((bd) => bd.prisesEnCharge) as unknown as LigneEtatFacture[],
      p,
    );

    doc.end();
  }

  // État détaillé des factures liées à un règlement (2026-09) — voir
  // demande utilisateur : "un état qui retrace les référence de factures,
  // les personnes qui ont consommé, les frais réelle, les quote part et
  // finalement le net à payer... les coordonnées du prestataire [et] les
  // dates des prestations". Page ajoutée UNE SEULE FOIS (jamais par
  // exemplaire) après le corps du document appelant — partagée par
  // renderLettreCheque (Règlement Comptable) et renderReglement (Règlement
  // Maladie), mêmes colonnes dans les deux cas.
  // Pied de page (2026-09) — voir demande utilisateur : "le pied de page
  // doit être les informations de la société utilisant MedAssur comme
  // outil métier (compagnie, courtier, mutuelle)" — ParametresEntreprise
  // (`p`), jamais MedAssur en tant qu'éditeur du logiciel. Redessiné à
  // chaque page (pas de mécanisme "footer automatique" natif dans PDFKit).
  private dessinerPiedDePage(doc: PDFKit.PDFDocument, p: { nom: string; boitePostale: string; ville: string; pays: string; telephone: string; email?: string | null }) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const yFooter = doc.page.height - 34;
    // Marge basse désactivée le temps du dessin (2026-09) — sinon PDFKit
    // considère qu'écrire dans la marge déborde de la page et insère
    // silencieusement une page vierge supplémentaire avant d'y placer le
    // texte (comportement automatique de doc.text(), déclenché même avec
    // des x/y explicites) — découvert en testant ce pied de page.
    const margeBasOriginale = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(left, yFooter).lineTo(right, yFooter).strokeColor("#ccc").lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#666").text(
      `${p.nom} — ${p.boitePostale} ${p.ville}, ${p.pays} — Tél. : ${p.telephone}${p.email ? ` — Email : ${p.email}` : ""}`,
      left, yFooter + 6, { width, align: "center" },
    );
    doc.page.margins.bottom = margeBasOriginale;
    doc.fillColor("#000");
  }

  private dessinerEtatFactures(
    doc: PDFKit.PDFDocument, titre: string, sousTitre: string,
    prestataire: { nom: string; adresse: string | null; ville: string | null; telephone: string | null; pays: string | null },
    lignes: LigneEtatFacture[],
    p: { nom: string; boitePostale: string; ville: string; pays: string; telephone: string; email?: string | null },
  ) {
    doc.addPage();
    this.dessinerPiedDePage(doc, p);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    let y = 40;

    doc.font("Helvetica-Bold").fontSize(12).text(titre, left, y, { width, align: "center" });
    y += 50;
    doc.font("Helvetica").fontSize(9).text(sousTitre, left, y, { width, align: "center" });
    y += 26;

    // Coordonnées du prestataire — un règlement (bordereau ou lettre
    // chèque) ne porte que sur UN SEUL prestataire.
    doc.font("Helvetica-Bold").fontSize(9).text(prestataire.nom, left, y);
    y += 12;
    doc.font("Helvetica").fontSize(8);
    if (prestataire.adresse) { doc.text(prestataire.adresse, left, y); y += 11; }
    doc.text(`${prestataire.ville}${prestataire.pays ? `, ${prestataire.pays}` : ""}`, left, y);
    y += 11;
    if (prestataire.telephone) { doc.text(`Tél. : ${prestataire.telephone}`, left, y); y += 11; }
    y += 54;

    // "Quote-part" scindée en Part Assurance / Part Assuré (2026-09) — voir
    // demande utilisateur : "les quote part signifie part assurance et part
    // assuré" — une seule colonne "Quote-part" était ambiguë (laquelle des
    // deux ?). Part Assuré = frais réel − part assurance (ticket
    // modérateur/reste à charge), jamais un champ à part recalculé
    // différemment ailleurs.
    const cols = [
      { h: "Réf. Facture", w: width * 0.13 }, { h: "Bénéficiaire", w: width * 0.18 }, { h: "Date", w: width * 0.09 },
      { h: "Frais réel", w: width * 0.14 }, { h: "Part\nAssurance", w: width * 0.14 }, { h: "Part\nAssuré", w: width * 0.14 },
      { h: "Net à payer", w: width * 0.18 },
    ];
    const dessinerEntete = () => {
      doc.rect(left, y, width, 22).fill("#1f2937");
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#fff");
      let cx = left;
      for (const c of cols) { doc.text(c.h, cx + 4, y + 4, { width: c.w - 8, align: cx === left ? "left" : "right" }); cx += c.w; }
      doc.fillColor("#000");
      y += 22;
    };
    dessinerEntete();

    let totalEngage = 0, totalBase = 0, totalAssure = 0, totalNet = 0;
    doc.font("Helvetica").fontSize(7.5);
    for (const l of lignes) {
      if (y + 16 > doc.page.height - 50) { doc.addPage(); this.dessinerPiedDePage(doc, p); y = 40; dessinerEntete(); doc.font("Helvetica").fontSize(7.5); }
      const engage = Number(l.montant) - Number(l.montantRejete ?? 0);
      const base = l.baseRemboursement !== null ? Number(l.baseRemboursement) : 0;
      const partAssure = engage - base;
      const tps = l.montantTps !== null ? Number(l.montantTps) : 0;
      const net = base - tps;
      totalEngage += engage; totalBase += base; totalAssure += partAssure; totalNet += net;
      const valeurs = [l.facture?.referenceFacture ?? "—", `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(), l.date, fmt(engage), fmt(base), fmt(partAssure), fmt(net)];
      let cx = left;
      for (let i = 0; i < valeurs.length; i++) {
        doc.text(valeurs[i], cx + 4, y + 4, { width: cols[i].w - 8, align: i < 3 ? "left" : "right" });
        cx += cols[i].w;
      }
      y += 16;
    }
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();
    y += 4;
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text("TOTAL", left + 4, y + 4, { width: cols[0].w + cols[1].w + cols[2].w - 8 });
    let cxTot = left + cols[0].w + cols[1].w + cols[2].w;
    const totaux = [fmt(totalEngage), fmt(totalBase), fmt(totalAssure), fmt(totalNet)];
    for (let i = 0; i < 4; i++) { doc.text(totaux[i], cxTot + 4, y + 4, { width: cols[3 + i].w - 8, align: "right" }); cxTot += cols[3 + i].w; }
    y += 24;
    doc.font("Helvetica-Oblique").fontSize(7).fillColor("#666").text(`${lignes.length} ligne(s) de facturation.`, left, y);
    doc.fillColor("#000");

    // "POUR LA SOCIÉTÉ" (2026-09) — voir modèle "Lettre-Cheque-
    // LC-000001-2.pdf" : même bloc de signature que la page 1, positionné
    // près du bas de la DERNIÈRE page de l'état (jamais une fraction fixe
    // de la page, qui chevaucherait un tableau long étalé sur plusieurs
    // pages — voir Math.max ci-dessous).
    const ySignature = Math.max(y + 40, doc.page.height - 234);
    doc.font("Helvetica-Bold").fontSize(12).text("POUR LA SOCIÉTÉ", right - 180, ySignature, { width: 180, align: "right" });
  }

  // Règlement (un BordereauReglement) — voir demande utilisateur : "ramener
  // les modèles qu'on avait déjà fixés" (référence papier "Modèle
  // Règlement.pdf", LA RUCHE EXCELLENCE), puis (2026-09) "reprise identique
  // strict dans les moindres détails" après comparaison ligne à ligne avec
  // un règlement réellement généré : bandeau titre, bloc Compagnie/Police/
  // Souscripteur/Bénéficiare [sic, coquille du modèle]/Arriéré, tableau par
  // décompte (Famille/Bénéficiaire du soin/N° DEC/Montant Engagé/Base
  // Remb./%TPS/Montant TPS/Net à Payer), cumul, encadré Montant brut/TPS/
  // Net à payer, ligne "Établir un chèque de... à l'ordre de...", 4
  // exemplaires PROPRES à ce document (EXEMPLAIRES_REGLEMENT ci-dessous —
  // PAS la convention EXEMPLAIRES de Quittance/Avenant, dont le libellé
  // diffère). Seul ajout volontaire par rapport au modèle papier : le QR
  // code de signature électronique (voir demande utilisateur : "le seul
  // plus c'est le QR code").
  async renderReglement(id: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string }) {
    const b = await this.reglementPrestataire.findOne(id);
    const p = await this.parametresEntreprise.findOne();
    const logoImage = await this.chargerImage("logos-entreprises", p.logo, UPLOADS_LOGOS_ENTREPRISES_DIR);
    const lignes = b.prisesEnCharge as unknown as {
      id: string; assureId: string; contratId: string; montant: Prisma.Decimal; montantRejete: Prisma.Decimal | null;
      baseRemboursement: Prisma.Decimal | null; montantTps: Prisma.Decimal | null; decompteNumero: string | null; nSinistre: string | null;
      date: string; facture: { referenceFacture: string } | null;
      assure: { nom: string; prenom: string | null; familleId: string | null };
    }[];

    // N° Sinistre (2026-09) — voir demande utilisateur : "faire remonter le
    // numéro de sinistre". `PriseEnCharge.nSinistre` (champ manuel, quasi
    // jamais renseigné) affichait presque toujours "—" ; corrigé pour lire
    // `Decompte.numeroSinistre` (séquence auto-générée, TOUJOURS renseignée
    // — même correction déjà appliquée à DocumentsService.renderDecompteFacture).
    // Un bordereau peut regrouper plusieurs décomptes (plusieurs assurés/
    // factures) : les numéros distincts sont listés, jamais un seul choisi
    // au hasard parmi plusieurs différents.
    const decompteNumeros = [...new Set(lignes.map((l) => l.decompteNumero).filter((n): n is string => !!n))];
    const decomptesSinistre = decompteNumeros.length
      ? await this.prisma.decompte.findMany({ where: { numero: { in: decompteNumeros } }, select: { numeroSinistre: true } })
      : [];
    const nSinistresDistincts = [...new Set(decomptesSinistre.map((d) => d.numeroSinistre))];
    const nSinistreTexte = nSinistresDistincts.length === 0 ? "—" : nSinistresDistincts.join(", ");

    // Regroupe par décompte (Facture + assuré) — une ligne de tableau par
    // bénéficiaire/dossier réglé, comme sur le modèle de référence.
    const parDecompte = new Map<string, typeof lignes>();
    for (const l of lignes) {
      const cle = l.decompteNumero ?? `${l.assureId}::${l.id}`;
      const arr = parDecompte.get(cle);
      if (arr) arr.push(l); else parDecompte.set(cle, [l]);
    }

    const contratIds = [...new Set(lignes.map((l) => l.contratId))];
    const contrats = contratIds.length
      ? await this.prisma.contrat.findMany({ where: { id: { in: contratIds } }, include: { client: true, compagnie: true } })
      : [];
    const policeTexte = contrats.length === 1 ? (contrats[0].numeroPolice ?? contrats[0].id) : contrats.length > 1 ? `${contrats.length} polices` : "—";
    const compagnieTexte = contrats.length === 1 ? contrats[0].compagnie.nom : contrats.length > 1 ? "Plusieurs compagnies" : "—";
    const souscripteurTexte = contrats.length === 1 ? contrats[0].client.nom : contrats.length > 1 ? "Plusieurs souscripteurs" : "—";

    // Cumul déjà réglé à ce prestataire (bordereaux Payé, celui-ci inclus).
    const cumulAgg = await this.prisma.bordereauReglement.aggregate({
      where: { prestataireId: b.prestataireId, statut: "Payé", id: { not: b.id } },
      _sum: { montantValide: true },
    });
    const montantCeBordereau = Number(b.montantValide ?? b.montantTotal);
    const cumul = Number(cumulAgg._sum.montantValide ?? 0) + montantCeBordereau;

    const beneficiaireTexte = (b as { medecin?: { titre: string | null; nom: string; prenom: string | null } | null }).medecin
      ? `${(b as { medecin?: { titre: string | null } }).medecin!.titre ?? "Dr"} ${(b as { medecin?: { nom: string } }).medecin!.nom} ${(b as { medecin?: { prenom: string | null } }).medecin!.prenom ?? ""}`.trim()
      : (b as { prestataire: { nom: string } }).prestataire.nom;

    // Reproduction à l'identique du modèle papier ("Modèle Règlement.pdf")
    // — voir demande utilisateur : "reproduis à l'identique... n'invente
    // pas". Toutes les positions ci-dessous sont mesurées au point près sur
    // le PDF de référence (extraction pdfplumber, marge gauche/droite 21pt,
    // page portrait 595,32 × 841,92 pt — identique à ce document).
    const doc = new PDFDocument({ size: "A4", margin: 21 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Reglement-${b.numero}.pdf"`);
    doc.pipe(res);

    const dessinerCorps = async (exemplaire: string) => {
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      this.dessinerLogoEntete(doc, logoImage, left, 8);
      doc.fillColor("#000").fontSize(13).font("Helvetica");
      const nomW = doc.widthOfString(p.nom);
      doc.text(p.nom, left, 24);
      doc.fontSize(8).text("Service Maladie", left, 49);
      doc.text(`Tél.: ${p.telephone}`, left, 60);
      // Titre centré sur la pleine largeur (comme le modèle) avec un filet
      // de sécurité si le nom de la société est particulièrement long.
      // SANS accent sur le E ("REGLEMENT", pas "RÈGLEMENT") — reproduction
      // stricte du modèle papier, voir demande utilisateur : "reprise
      // identique strict dans les moindres détails".
      const titreW = Math.min(width, Math.max(width * 0.5, nomW * 2 + 200));
      const titreX = left + (width - titreW) / 2;
      doc.fontSize(12).text("REGLEMENT MALADIE", titreX, 55, { width: titreW, align: "center" });
      doc.fillColor("#000");
      // Gestionnaire ayant établi le règlement (2026-09) — voir demande
      // utilisateur : "la mention 'OL' c'est en réalité l'acronyme du nom
      // du gestionnaire qui aurait créé le règlement... il faut que le
      // système puisse retracer qui fait quoi dans l'application". Position
      // identique au "OL" du modèle papier, mais nom complet (User.nom, via
      // BordereauReglement.creeParId) plutôt qu'un acronyme — absent pour
      // les bordereaux créés avant ce champ (rien affiché, jamais "OL").
      if (b.creePar) doc.fontSize(7).font("Helvetica").text(b.creePar.nom, left, 92);

      // Encadré 2 colonnes (56,5 % / 43,5 %, mesures exactes du modèle) × 4
      // lignes (Compagnie/Agence/Souscripteur/Bénéficiaire · N°Police/
      // N°Sinistre/Date/N°Ordre Mvt) + une 5e ligne DANS LA SEULE COLONNE
      // DROITE, "Arriéré de la police" (jamais pleine largeur — c'est ainsi
      // sur le modèle). Champs sans équivalent applicatif réel (Agence,
      // N° Ordre Mvt, Arriéré) : "—", jamais de valeur inventée.
      const y0 = 121;
      const colGaucheW = width * 0.565;
      const rightX = left + colGaucheW;
      doc.font("Helvetica").fontSize(8);
      let yy = champ(doc, left + 16, y0 + 8, "Compagnie", compagnieTexte, 78, colGaucheW - 94);
      // "Agence" (2026-09) — voir demande utilisateur : "lier un agent de
      // saisie à une agence... afin que ce soit cette agence qui remonte
      // sur le décompte". Agence du gestionnaire ayant établi ce règlement
      // (BordereauReglement.creeParId → User.agenceId) ; "—" tant qu'aucune
      // agence ne lui est assignée.
      yy = champ(doc, left + 16, yy, "Agence :", b.creePar?.agence?.nom ?? "—", 78, colGaucheW - 94);
      yy = champ(doc, left + 16, yy, "Souscripteur :", souscripteurTexte, 78, colGaucheW - 94);
      // "Bénéficiare :" — orthographe EXACTE du modèle papier (coquille
      // d'origine, "i" manquant avant "are") : reproduction stricte, voir
      // demande utilisateur "reprise identique strict dans les moindres
      // détails" — ne jamais corriger en "Bénéficiaire".
      yy = champ(doc, left + 16, yy + 6, "Bénéficiare :", beneficiaireTexte, 78, colGaucheW - 94, { boldValeur: true });
      let ryy = champ(doc, rightX + 16, y0 + 8, "N° Police :", policeTexte, 78, width - colGaucheW - 94);
      ryy = champ(doc, rightX + 16, ryy, "N° Sinistre :", nSinistreTexte, 78, width - colGaucheW - 94);
      ryy = champ(doc, rightX + 16, ryy, "Date", b.datePaiement ?? b.dateReception, 78, width - colGaucheW - 94);
      // N° Ordre Mvt = BordereauReglement.numero (2026-09) — séquence
      // dédiée déjà formatée exactement comme le modèle ("12 835", voir
      // ReglementPrestataireService.genererBordereau, reglement_numero_seq)
      // : corrige un "—" laissé par erreur alors que la vraie valeur
      // existait déjà.
      ryy = champ(doc, rightX + 16, ryy, "N° Ordre Mvt :", b.numero, 78, width - colGaucheW - 94);
      const arriereY = Math.max(yy, ryy) + 2;
      doc.font("Helvetica-Bold").fontSize(9).text("Arriéré de la police :", rightX + 16, arriereY);
      doc.font("Helvetica").text("F CFA", rightX, arriereY, { width: width - colGaucheW - 16, align: "right" });
      const boxBottom = arriereY + 18;
      doc.rect(left, y0, width, boxBottom - y0).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(rightX, y0).lineTo(rightX, boxBottom).strokeColor("#000").lineWidth(0.7).stroke();
      let y = boxBottom + 18;

      // Tableau — 7 colonnes (Famille et Bénéficiaire du soin PARTAGENT la
      // même colonne, sans séparateur, comme sur le modèle — jamais 8
      // colonnes). Largeurs de base mesurées sur le modèle papier (37,66 /
      // 6,93 / 14,73 / 11,88 / 5,19 / 11,21 / 12,41 %) — "N° DEC" élargie à
      // 9,5 % (2026-09, voir demande utilisateur : "il faut afficher
      // l'intégralité et faire que ça tienne sur une ligne", la référence
      // complète "DEC-000008" ne tenait plus dans la largeur d'origine),
      // l'écart repris sur la colonne Famille/Bénéficiaire.
      const cols = [
        { h: "Famille                    Bénéficiaire du soin", w: width * 0.3509 }, { h: "N° DEC", w: width * 0.095 },
        { h: "Montant\nEngagé", w: width * 0.1473 }, { h: "Base\nRemboursement", w: width * 0.1188 },
        { h: "%\ntps", w: width * 0.0519 }, { h: "Montant\ntps", w: width * 0.1121 }, { h: "Net à Payer", w: width * 0.1241 },
      ];
      const tableTop = y;
      let cx = left;
      doc.fillColor("#000").fontSize(7).font("Helvetica-Bold");
      for (const c of cols) { doc.text(c.h, cx + 3, y + 4, { width: c.w - 6, align: cx === left ? "left" : "center" }); cx += c.w; }
      y += 22;
      doc.moveTo(left, tableTop).lineTo(right, tableTop).strokeColor("#000").lineWidth(0.7).stroke();
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();

      // Ligne TOTAL — seuls "Base Remboursement" et "Net à Payer" sont
      // additionnés sur le modèle de référence (Montant Engagé/%tps/
      // Montant tps restent vides).
      let totalBase = 0, totalNet = 0, totalTps = 0;
      doc.font("Helvetica").fontSize(7.5);
      for (const [, grp] of parDecompte) {
        const engage = grp.reduce((s, l) => s + Number(l.montant) - Number(l.montantRejete ?? 0), 0);
        const base = grp.reduce((s, l) => s + (l.baseRemboursement !== null ? Number(l.baseRemboursement) : 0), 0);
        const tps = grp.reduce((s, l) => s + (l.montantTps !== null ? Number(l.montantTps) : 0), 0);
        const net = base - tps;
        totalBase += base; totalNet += net; totalTps += tps;
        // Taux TPS paramétré (9,5%, voir SanteService.TAUX_TPS) — TOUJOURS
        // affiché (2026-09) — voir demande utilisateur : "faire remonter les
        // taux TPS sur le document même si le prestataire n'est pas
        // assujetti" : le taux est une donnée système fixe, informative,
        // indépendante du statut d'assujettissement de CE prestataire
        // précis — ce n'est que "Montant tps" (colonne suivante) qui reste
        // à 0/vide quand la TPS ne s'applique pas réellement.
        const pctTps = TAUX_TPS.toFixed(2).replace(".", ",");
        const premiere = grp[0];
        const rowH = 18;
        if (y + rowH > doc.page.height - 220) { doc.addPage(); y = 40; }
        cx = left;
        // "Famille" abrégée au premier mot du nom (comme sur le modèle de
        // référence, "KOKO B.") — même colonne que Bénéficiaire, positionné
        // au même décalage relatif (38 % de la largeur de colonne).
        doc.text(premiere.assure.nom.split(" ")[0], cx + 4, y + 4, { width: cols[0].w * 0.36 - 6 });
        doc.text(`${premiere.assure.nom} ${premiere.assure.prenom ?? ""}`.trim(), cx + cols[0].w * 0.38, y + 4, { width: cols[0].w * 0.62 - 6 });
        cx += cols[0].w;
        // Référence COMPLÈTE du décompte affichée (2026-09) — voir demande
        // utilisateur : "il faut afficher l'intégralité et faire que ça
        // tienne sur une ligne" (le tronquage à "8"/"9" ne permettait plus
        // de retrouver le décompte). Police réduite (6,5 au lieu de 7,5)
        // pour cette seule cellule, seule façon de faire tenir sur une
        // ligne à la fois le format récent ("DEC-000008") et l'ancien
        // format hérité ("000008 / 2026", plus long) sans élargir encore
        // la colonne au détriment du reste du tableau.
        doc.font("Helvetica").fontSize(6.5).text(premiere.decompteNumero ?? "—", cx + 3, y + 5, { width: cols[1].w - 6, align: "left" });
        doc.font("Helvetica").fontSize(7.5);
        cx += cols[1].w;
        const valeurs = [fmt(engage), fmt(base), pctTps, tps > 0 ? fmt(tps) : "", fmt(net)];
        for (let i = 0; i < valeurs.length; i++) {
          doc.text(valeurs[i], cx + 3, y + 4, { width: cols[i + 2].w - 6, align: "right" });
          cx += cols[i + 2].w;
        }
        y += rowH;
      }
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text("TOTAL", left, y + 4, { width: cols[0].w + cols[1].w - 6, align: "center" });
      cx = left + cols[0].w + cols[1].w;
      const totaux = ["", fmt(totalBase), "", "", fmt(totalNet)];
      for (let i = 0; i < totaux.length; i++) { doc.text(totaux[i], cx + 3, y + 4, { width: cols[i + 2].w - 6, align: "right" }); cx += cols[i + 2].w; }
      y += 20;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();
      cx = left;
      for (let i = 0; i <= cols.length; i++) {
        doc.moveTo(cx, tableTop).lineTo(cx, y).strokeColor("#000").lineWidth(0.5).stroke();
        if (i < cols.length) cx += cols[i].w;
      }
      y += 20;

      doc.font("Helvetica").fontSize(9).text(`Cumul règlement de la police :      ${fmt(cumul)}      F CFA`, left + 7, y);
      y += 28;

      // Encadré de récap — "Montant brut" seul est BOXÉ (comme le modèle) ;
      // "Montant TPS à prélevé"/"Montant Net à Payer" ne sont que soulignés
      // en dessous, jamais dans le même encadré. Positionné depuis la marge
      // gauche (PAS aligné à droite) — largeur ~73,6 % de la page, comme le
      // modèle.
      const recapX = left + 15, recapW = width * 0.736;
      doc.rect(recapX, y, recapW, 24).strokeColor("#000").lineWidth(0.7).stroke();
      champ(doc, recapX + 13, y + 7, "Montant brut :", `${fmt(montantCeBordereau + totalTps)}F CFA`, 90, recapW - 106, { boldValeur: true, alignValeur: "right" });
      y += 24 + 8;
      champ(doc, recapX + 13, y, "Montant TPS à prélevé :", totalTps > 0 ? `${fmt(totalTps)}F CFA` : "F CFA", 130, recapW - 143, { alignValeur: "right" });
      doc.moveTo(recapX + 8, y + 16).lineTo(recapX + recapW - 8, y + 16).strokeColor("#000").lineWidth(0.7).stroke();
      y += 24;
      champ(doc, recapX + 13, y, "Montant Net à Payer :", `${fmt(montantCeBordereau)}F CFA`, 130, recapW - 143, { alignValeur: "right" });
      doc.moveTo(recapX + 8, y + 16).lineTo(recapX + recapW - 8, y + 16).strokeColor("#000").lineWidth(0.7).stroke();
      y += 48;

      doc.font("Helvetica-Oblique").fontSize(9).text("Etablir un chèque de  :", left + 7, y, { continued: true }).text(`          ${fmt(montantCeBordereau)}          F CFA`);
      y += 18;
      doc.text(" à l'ordre de", left + 7, y, { continued: true }).font("Helvetica-BoldOblique").text(`          ${beneficiaireTexte}`);
      y += 30;
      const now = new Date();
      doc.font("Helvetica-Bold").fontSize(9).text("Fait et signé à Libreville", left + 7, y, { continued: true }).font("Helvetica").text(`      le :   ${now.toLocaleDateString("fr-FR")}`);
      y += 24;
      await this.dessinerSignatureElectronique(doc, left, y, "Bordereau de règlement", b.id, utilisateur);

      doc.font("Helvetica").fontSize(9).text(`Exemplaire ${exemplaire}`, left + 6, doc.page.height - 45);
    };

    // Libellés PROPRES au Règlement (pas la convention partagée
    // EXEMPLAIRES de Quittance/Avenant) — reproduction stricte du modèle
    // papier : "Compagnie" apparaît deux fois de suite, puis "Agence",
    // puis "Comptabilité" (pas de 5e exemplaire "Client" sur ce modèle).
    const EXEMPLAIRES_REGLEMENT = ["Compagnie", "Compagnie", "Agence", "Comptabilité"];
    for (let i = 0; i < EXEMPLAIRES_REGLEMENT.length; i++) {
      if (i > 0) doc.addPage();
      await dessinerCorps(EXEMPLAIRES_REGLEMENT[i]);
    }

    // État détaillé des factures liées au bordereau (2026-09) — voir
    // demande utilisateur : "en plus de la référence du règlement
    // comptable... une seconde page avec la liste des factures liées au
    // règlement". Une SEULE fois (pas par exemplaire, contrairement au
    // corps principal ci-dessus) — voir DocumentsService.dessinerEtatFactures,
    // partagé avec renderLettreCheque.
    this.dessinerEtatFactures(doc, "ÉTAT DÉTAILLÉ DES FACTURES", `Bordereau n° ${b.numero} — ${b.periode}`, b.prestataire, lignes, p);

    doc.end();
  }

  async renderHistoriqueReglements(
    filtres: { prestataireId?: string; du?: string; au?: string; numeroReglement?: string; referenceDecompte?: string; assure?: string; referenceReglementComptable?: string },
    format: "pdf" | "xlsx", res: Response,
  ) {
    const { lignes } = await this.reglementPrestataire.historique(filtres);
    const rows = lignes.map((l) => [l.assureNom, l.date, l.prestataireNom, l.bordereauNumero ?? "—", l.bordereauStatut ?? "—", l.montantRembourse]);
    if (format === "xlsx") return this.envoyerTableauXlsx(res, "Historique-Reglements", ["Assuré", "Date", "Prestataire", "N° Règlement", "Statut", "Montant remboursé"], rows);
    return this.envoyerTableauPdf(res, "Historique-Reglements", "HISTORIQUE DES RÈGLEMENTS", `${rows.length} ligne(s)`,
      [{ h: "Assuré", w: 130 }, { h: "Date", w: 80 }, { h: "Prestataire", w: 150 }, { h: "N° Règlement", w: 100 }, { h: "Statut", w: 90 }, { h: "Montant", w: 90 }],
      rows, "TOTAL", `${fmt(rows.reduce((s, r) => s + (r[5] as number), 0))} FCFA`);
  }

  // Avis d'échéance — contrats du client arrivant à échéance (2026-09,
  // reconstruction fidèle à "Modèle d'avis d'échéance.pdf" — voir demande
  // utilisateur : "documents à revoir selon modèle et à reproduire
  // exactement comme sur les modèles". L'ancienne version était un simple
  // épandage de champs libellé/valeur — remplacée par : bandeau titre
  // centré, bloc "Client N°"/coordonnées à droite, texte de courtoisie,
  // tableau bordé N° Police(s)/Nature du contrat/Echéance(s)/Prime(s)
  // ttc/Compagnie(s) avec ligne TOTAL, bloc signature. Reproduit la
  // structure et le texte du modèle OLEA, en substituant l'identité MedAssur
  // (voir mémoire "Fidélité des documents concurrents") — jamais la marque
  // du tiers.
  async renderAvisEcheance(clientId: string, format: "pdf" | "docx", res: Response) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} introuvable`);
    const contrats = await this.prisma.contrat.findMany({ where: { clientId, statut: { not: "Résilié" } }, include: { compagnie: true }, orderBy: { dateFin: "asc" } });
    const p = await this.parametresEntreprise.findOne();

    const lignes = contrats.map((c) => {
      const primeNette = Number(c.primeNette ?? c.prime);
      const accessoires = Number(c.montantAccessoires ?? 0);
      const taxe = Number(c.montantTaxe ?? Math.round((primeNette + accessoires) * TAUX_TAXE_GABON));
      return { police: c.id, nature: `${c.branche.toUpperCase()} ${c.typeAffaire?.toUpperCase() ?? ""}`.trim(), echeance: dateTirets(c.dateFin), primeTtc: primeNette + accessoires + taxe, compagnie: c.compagnie.nom };
    });
    const totalPrime = lignes.reduce((s, l) => s + l.primeTtc, 0);
    const dateEcheancePrincipale = contrats[0]?.dateFin ?? "—";

    if (format === "docx") {
      return this.envoyerDocx(res, `Avis-Echeance-${clientId}`, "AVIS D'ÉCHÉANCE", client.nom, [
        ["Client N° :", refNumerique(client.id)],
        ["Échéance au :", dateTirets(dateEcheancePrincipale)],
      ], { headers: ["N° Police(s)", "Nature du contrat", "Echéance(s)", "Prime(s) ttc", "Compagnie(s)"], rows: lignes.map((l) => [l.police, l.nature, l.echeance, fmt(l.primeTtc), l.compagnie]) });
    }

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Avis-Echeance-${clientId}.pdf"`);
    doc.pipe(res);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(8).font("Helvetica").fillColor("#333").text(`${p.boitePostale} ${p.ville} - ${p.pays}`, left, 56);
    doc.fillColor("#000").fontSize(9).font("Helvetica").text(`${p.ville}, le ${new Date().toLocaleDateString("fr-FR")}`, left, 40, { width, align: "right" });
    doc.text("Page 1 / 1", left, 54, { width, align: "right" });

    let y = 90;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(p.couleurPrimaire).text("A V I S   D ' E C H E A N C E", left, y, { width, align: "center", characterSpacing: 1 });
    doc.moveTo(left + width / 2 - 100, y + 20).lineTo(left + width / 2 + 100, y + 20).strokeColor(p.couleurPrimaire).lineWidth(1).stroke();
    doc.fillColor("#000");
    y += 40;

    doc.font("Helvetica-Bold").fontSize(9).text(`Client N° ${refNumerique(client.id)}`, left, y);
    doc.font("Helvetica-Bold").fontSize(11).text(client.nom, left + 260, y, { width: width - 260, align: "right" });
    let yy = y + 16;
    doc.font("Helvetica").fontSize(9);
    if (client.boitePostale) { doc.text(`BP : ${client.boitePostale}`, left + 260, yy, { width: width - 260, align: "right" }); yy += 12; }
    doc.text(`${client.ville ?? ""}${client.ville && client.pays ? "   " : ""}${client.pays ?? ""}`, left + 260, yy, { width: width - 260, align: "right" });
    y += 50;

    doc.font("Helvetica").fontSize(9).text("Cher client,", left, y);
    y += 20;
    doc.text(`Nous vous informons que votre police ci-dessus référencée arrivera à expiration à la date du ${dateTirets(dateEcheancePrincipale)} à 24 heures, pour les garanties désignées au contrat.`, left, y, { width });
    y += doc.heightOfString("x", { width }) * 2 + 8;
    doc.text("Nous sommes à votre entière disposition pour procéder à son renouvellement, éventuellement y apporter des modifications.", left, y, { width });
    y += doc.heightOfString("x", { width }) * 2 + 8;
    doc.text("Dans l'attente de vous lire et vous remerciant de votre confiance, veuillez agréer, l'expression de nos sentiments distingués.", left, y, { width });
    y += 30;

    // Tableau bordé — colonnes calquées sur le modèle (N° Police(s) 20% /
    // Nature du contrat 27% / Echéance(s) 16% / Prime(s) ttc 17% /
    // Compagnie(s) 20%), TOTAL uniquement sur la colonne Prime(s) ttc.
    const cols = [
      { h: "N° Police(s)", w: width * 0.20 }, { h: "Nature du contrat", w: width * 0.27 },
      { h: "Echéance(s)\nJour/mois/année", w: width * 0.16 }, { h: "Prime(s) ttc", w: width * 0.17 }, { h: "Compagnie(s)", w: width * 0.20 },
    ];
    const tableTop = y;
    let cx = left;
    doc.rect(left, y, width, 24).fillAndStroke("#f0f0f0", "#000");
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(7.5);
    for (const c of cols) { doc.text(c.h, cx + 3, y + 4, { width: c.w - 6, align: "center" }); cx += c.w; }
    y += 24;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();

    doc.font("Helvetica").fontSize(8);
    for (const l of lignes) {
      const rowH = 18;
      if (y + rowH > doc.page.height - 160) { doc.addPage(); y = 40; }
      cx = left;
      const valeurs = [l.police, l.nature, l.echeance, fmt(l.primeTtc), l.compagnie];
      for (let i = 0; i < valeurs.length; i++) { doc.text(String(valeurs[i]), cx + 3, y + 4, { width: cols[i].w - 6, align: i === 3 ? "right" : "left" }); cx += cols[i].w; }
      y += rowH;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").lineWidth(0.5).stroke();
    }
    doc.font("Helvetica-Bold").fontSize(8.5);
    doc.text("TOTAL", left, y + 5, { width: cols[0].w + cols[1].w + cols[2].w - 6, align: "right" });
    doc.text(fmt(totalPrime), left + cols[0].w + cols[1].w + cols[2].w + 3, y + 5, { width: cols[3].w - 6, align: "right" });
    y += 20;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#000").lineWidth(0.7).stroke();
    cx = left;
    for (let i = 0; i <= cols.length; i++) {
      doc.moveTo(cx, tableTop).lineTo(cx, y).strokeColor("#000").lineWidth(0.5).stroke();
      if (i < cols.length) cx += cols[i].w;
    }
    y += 40;

    doc.font("Helvetica").fontSize(9).text("Pour la Société,", right - 150, y, { width: 150, align: "right" });

    doc.fontSize(7.5).font("Helvetica").fillColor("#555");
    const bas = doc.page.height - 60;
    doc.text(`${p.nom}`, left, bas);
    doc.text(`Tél : ${p.telephone}${p.email ? `   Email : ${p.email}` : ""}`, left, bas + 10);
    doc.text(`${p.boitePostale} ${p.ville} - ${p.pays}`, left, bas + 20);
    doc.end();
  }

  // Export Accords Préalables (Prises en Charge) d'un contrat.
  async renderAccordPrealableExport(contratId: string, format: "pdf" | "xlsx" | "docx", res: Response) {
    const accords = await this.accordPrealable.findAll({ contratId });
    const rows = accords.map((a) => [a.assure.nom + " " + (a.assure.prenom ?? ""), a.type, a.dateDemande, a.decision, a.montantAutorise !== null ? Number(a.montantAutorise) : 0]);
    if (format === "xlsx") return this.envoyerTableauXlsx(res, `Accords-Prealables-${contratId}`, ["Assuré", "Type", "Date demande", "Décision", "Montant autorisé"], rows);
    if (format === "docx") return this.envoyerDocx(res, `Accords-Prealables-${contratId}`, "PRISES EN CHARGE", `${accords.length} dossier(s)`, [], { headers: ["Assuré", "Type", "Date demande", "Décision", "Montant"], rows: rows.map((r) => r.map(String)) });
    return this.envoyerTableauPdf(res, `Accords-Prealables-${contratId}`, "PRISES EN CHARGE", `${accords.length} dossier(s)`,
      [{ h: "Assuré", w: 150 }, { h: "Type", w: 100 }, { h: "Date demande", w: 100 }, { h: "Décision", w: 90 }, { h: "Montant autorisé", w: 100 }],
      rows, "TOTAL AUTORISÉ", `${fmt(rows.reduce((s, r) => s + (r[4] as number), 0))} FCFA`);
  }

  // Export Consommations (lignes PriseEnCharge) d'un contrat — voir mémoire
  // "Facture égale détails" : jamais un total agrégé seul.
  async renderConsommationsExport(contratId: string, format: "pdf" | "xlsx" | "docx", res: Response) {
    const lignes = await this.prisma.priseEnCharge.findMany({
      where: { contratId, statut: { not: "Annulé" } },
      include: { assure: true },
      orderBy: { date: "desc" },
    });
    const rows = lignes.map((l) => [`${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(), l.date, l.type, Number(l.montant), l.baseRemboursement !== null ? Number(l.baseRemboursement) : 0]);
    if (format === "xlsx") return this.envoyerTableauXlsx(res, `Consommations-${contratId}`, ["Assuré", "Date", "Type", "Frais réels", "Remboursé"], rows);
    if (format === "docx") return this.envoyerDocx(res, `Consommations-${contratId}`, "CONSOMMATIONS", `${lignes.length} ligne(s)`, [], { headers: ["Assuré", "Date", "Type", "Frais réels", "Remboursé"], rows: rows.map((r) => r.map(String)) });
    return this.envoyerTableauPdf(res, `Consommations-${contratId}`, "CONSOMMATIONS", `${lignes.length} ligne(s)`,
      [{ h: "Assuré", w: 150 }, { h: "Date", w: 90 }, { h: "Type", w: 110 }, { h: "Frais réels", w: 100 }, { h: "Remboursé", w: 100 }],
      rows, "TOTAL REMBOURSÉ", `${fmt(rows.reduce((s, r) => s + (r[4] as number), 0))} FCFA`);
  }

  // Quittance d'une tranche de QuittanceLibre — voir schema.prisma
  // QuittanceLibreTranche (primeNette/accessoires/taxe déjà décomposés à
  // la création, jamais recalculés ici).
  async renderQuittanceTranche(trancheId: string, res: Response) {
    const tranche = await this.prisma.quittanceLibreTranche.findUnique({
      where: { id: trancheId },
      include: { quittanceLibre: { include: { contrat: { include: { client: true, compagnie: true } } } } },
    });
    if (!tranche) throw new NotFoundException(`Tranche ${trancheId} introuvable`);
    const contrat = tranche.quittanceLibre.contrat;
    const p = await this.parametresEntreprise.findOne();
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Quittance-Tranche-${tranche.id}.pdf"`);
    doc.pipe(res);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(`QUITTANCE — TRANCHE N° ${tranche.numero}`, left, 60, { width, align: "right" });
    doc.fillColor("#000");
    let y = 90;
    let yy = champ(doc, left, y, "Police :", contrat.id, 100, 250, { boldLabel: true, boldValeur: true });
    yy = champ(doc, left, yy, "Souscripteur :", contrat.client.nom, 100, 250, { boldLabel: true });
    yy = champ(doc, left, yy, "Compagnie :", contrat.compagnie.nom, 100, 250, { boldLabel: true });
    yy = champ(doc, left, yy, "Échéance :", tranche.dateEcheance, 100, 250, { boldLabel: true });
    y = yy + 16;
    const recap: [string, string][] = [
      ["Prime nette", `${fmt(Number(tranche.primeNette))} FCFA`], ["Accessoires", `${fmt(Number(tranche.accessoires))} FCFA`],
      ["Taxe", `${fmt(Number(tranche.taxe))} FCFA`], ["MONTANT DE LA TRANCHE", `${fmt(Number(tranche.montant))} FCFA`],
    ];
    for (const [label, valeur] of recap) { y = champ(doc, left, y, label, valeur, 220, width - 220, { boldLabel: label.startsWith("MONTANT"), boldValeur: true, alignValeur: "right" }); }
    doc.end();
  }

  // Feuille de Soins/Examen "la plus récente" pour un assuré (2026-09 —
  // voir features/participants/index.tsx : bouton d'impression rapide
  // depuis la fiche assuré, sans connaître la PriseEnCharge précise).
  private async peclaPlusRecente(assureId: string, kind: "soins" | "examen") {
    const lignes = await this.prisma.priseEnCharge.findMany({
      where: { assureId, statut: { not: "Annulé" }, factureId: { not: null } },
      include: { acteMedical: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const estExamen = (famille: string | null | undefined) => GROUPES_EXAMEN.has(groupeDeFamille(famille) ?? "");
    const trouvee = lignes.find((l) => estExamen(l.acteMedical?.famille) === (kind === "examen"));
    if (!trouvee) throw new NotFoundException(`Aucune ${kind === "soins" ? "feuille de soins" : "feuille d'examen"} récente pour cet assuré.`);
    return trouvee.id;
  }

  async renderFeuilleSoinsDeAssure(assureId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string }) {
    const pecId = await this.peclaPlusRecente(assureId, "soins");
    return this.renderFeuilleSoinsLigne(pecId, res, utilisateur);
  }

  async renderFeuilleExamenDeAssure(assureId: string, res: Response, utilisateur: { id: string | null; nom: string; roleId: string }) {
    const pecId = await this.peclaPlusRecente(assureId, "examen");
    return this.renderFeuilleExamenLigne(pecId, res, utilisateur);
  }
}

// Rang au sein d'une famille : assuré principal, puis conjoint(e), puis
// enfants — ces derniers du plus âgé (date de naissance la plus ancienne)
// au plus jeune. Les familles elles-mêmes sont regroupées et ordonnées par
// id de leur racine (déterministe, indépendant de l'ordre de lecture DB).
// dateNaissance est stockée telle que saisie au format DD/MM/YYYY (voir
// src/components/shared/DateInput.tsx) — jamais un type Date Prisma.
function timestampNaissance(dateNaissance: string | null): number {
  if (!dateNaissance) return Infinity;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateNaissance);
  if (!m) return Infinity;
  const [, j, mo, a] = m;
  return new Date(Number(a), Number(mo) - 1, Number(j)).getTime();
}

function ordonnerParFamille(
  assures: { id: string; familleId: string | null; typeAssure: string | null; dateNaissance: string | null }[],
): string[] {
  const rangType: Record<string, number> = { AS: 0, CJ: 1, EF: 2 };
  const groupes = new Map<string, typeof assures>();
  for (const a of assures) {
    const cle = a.familleId ?? a.id;
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(a);
    else groupes.set(cle, [a]);
  }
  const clesTriees = [...groupes.keys()].sort((x, y) => x.localeCompare(y));
  const ids: string[] = [];
  for (const cle of clesTriees) {
    const membres = groupes.get(cle)!;
    membres.sort((x, y) => {
      const rx = rangType[x.typeAssure ?? "EF"] ?? 2;
      const ry = rangType[y.typeAssure ?? "EF"] ?? 2;
      if (rx !== ry) return rx - ry;
      return timestampNaissance(x.dateNaissance) - timestampNaissance(y.dateNaissance);
    });
    for (const m of membres) ids.push(m.id);
  }
  return ids;
}

const CARD_WIDTH = 242.65; // 85,6 mm — format carte CR80 (Evolis Primacy)
const CARD_HEIGHT = 153.01; // 53,98 mm

interface CarteAssureData {
  nom: string;
  prenom?: string | null;
  matricule: string;
  numeroAssure?: string | null;
  typeAssure?: string | null;
  dateNaissance?: string | null;
  telephone?: string | null;
  // Un conjoint/enfant n'a jamais son propre téléphone en base : il hérite
  // systématiquement de celui de sa racine de famille (voir familleId dans
  // schema.prisma) — y compris à l'affichage sur la carte. Si le numéro de
  // la racine change, ses ayants droit le reflètent donc automatiquement,
  // sans mise à jour individuelle nécessaire.
  familleId?: string | null;
  famille?: { telephone?: string | null; nom?: string; prenom?: string | null } | null;
  photo?: string | null;
  contrat: {
    id: string;
    dateDebut: string;
    dateFin: string;
    client: { nom: string };
    compagnie: { nom: string };
    tauxCouvertureAmbulatoire?: string | null;
    tauxCouvertureHospitalisation?: string | null;
  };
}
