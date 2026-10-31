import * as path from "path";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import Anthropic from "@anthropic-ai/sdk";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FacturesService } from "../factures/factures.service";
import { PrestatairesService } from "../prestataires/prestataires.service";

// Import libre Ariana (2026-10) — voir demande utilisateur : "elle doit
// pouvoir traiter les données et dire à quoi ça correspond et ne jamais
// créer les doublons. Si le statut de la personne a changé sur le nouvel
// import il faut également le changer, si la personne a changé de contrat
// dans le nouvel import, appliquer les changements." (2026-10-31)

export type TypeImportLibre =
  | "auto"
  | "factures"
  | "population"
  | "actes-medicaux"
  | "souscripteurs"
  | "contrats"
  | "assures"
  | "prises-en-charge"
  | "reglements";

// ── Types pour l'import de factures ────────────────────────────────────
export interface LigneApercu {
  referenceFacture: string;
  designation: string;
  categorie: string;
  matricule: string;
  beneficiaire: string;
  prestataireNom: string;
  datePrestation: string;
  montantTotal: number;
  partPatient: number;
  partFinanceur: number;
  statut: string;
  assureId: string | null;
  contratId: string | null;
  prestataireId: string | null;
  erreur: string | null;
  doublon: boolean;
  miseAJour?: boolean;
  priseEnChargeId?: string;
}

export interface ResultatApercu {
  contratRef: string;
  organisme: string;
  periode: string;
  lignes: LigneApercu[];
  totalLignes: number;
  totalResolues: number;
  totalDoublons: number;
  totalErreurs: number;
  totalMisesAJour: number;
  typeDetecte?: TypeImportLibre;
  apercu?: string;
  colonnesDetectees?: string[];
}

// ── Types pour l'import de population (assurés) ────────────────────────
export interface LignePopulation {
  matricule: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: string;        // M | F
  typeAssure: string;  // AS | CJ | EF
  prime: number;
  dateEffet: string;
  statutFichier: string;  // Actif | Terminé (dans le fichier source)
  // Résolution
  assureId: string | null;
  contratId: string | null;
  statutActuel: string | null;  // statut actuel en DB
  changementStatut: boolean;    // statut change
  changementContrat: boolean;   // contrat change
  contratIdNouveau: string | null;
  erreur: string | null;
  doublon: boolean;
}

export interface ResultatPopulation {
  police: string;
  organisme: string;
  periode: string;
  lignes: LignePopulation[];
  totalLignes: number;
  totalNouveaux: number;
  totalChangementsStatut: number;
  totalChangementsContrat: number;
  totalDoublons: number;
  totalErreurs: number;
  typeDetecte: "population";
}

// ── Types pour l'import d'actes médicaux ───────────────────────────────
export interface LigneActeMedical {
  code: string;
  libelle: string;
  famille: string;
  prixDefaut: number;
  categorieGarantie: string;
  // Résolution
  acteId: string | null;
  estNouvel: boolean;
  prixActuel: number | null;
  changementPrix: boolean;
  erreur: string | null;
}

export interface ResultatActesMedicaux {
  titre: string;
  lignes: LigneActeMedical[];
  totalLignes: number;
  totalNouveaux: number;
  totalMisesAJour: number;
  totalDoublons: number;
  totalErreurs: number;
  typeDetecte: "actes-medicaux";
}

// ── Mapping désignation → type de prestation ───────────────────────────
const MAP_DESIGNATION: [string, string][] = [
  ["ANALYSES", "Analyses Médicale"],
  ["LABORATOIRE", "Analyses Médicale"],
  ["LABO", "Analyses Médicale"],
  ["PHARMACIE", "Pharmacie"],
  ["MÉDICAMENTS", "Pharmacie"],
  ["MEDICAMENTS", "Pharmacie"],
  ["RADIO", "Imagerie"],
  ["RADIOLOGIE", "Imagerie"],
  ["SCANNER", "Imagerie"],
  ["ECHOGRAPHIE", "Imagerie"],
  ["IMAGERIE", "Imagerie"],
  ["IRM", "Imagerie"],
  ["ECHO", "Imagerie"],
  ["HOSPITALISATION", "Hospitalisation"],
  ["HOSPI", "Hospitalisation"],
  ["PETITE CHIRURGIE", "Petite Chirurgie/Soins"],
  ["CHIRURGIE", "Petite Chirurgie/Soins"],
  ["SOINS INFIRMIERS", "Petite Chirurgie/Soins"],
  ["DENTAIRE", "Soins & Prothèses dentaires"],
  ["OPTIQUE", "Optique"],
  ["KINE", "Kinésithérapie & Cure thermale"],
  ["KINÉ", "Kinésithérapie & Cure thermale"],
  ["MATERNITÉ", "Maternité"],
  ["MATERNITE", "Maternité"],
  ["CS GENERALISTE", "Consultations"],
  ["CONSULTATION GENERALISTE", "Consultations"],
  ["GENERALISTE", "Consultations"],
  ["CS SPECIALISTE", "Actes de Spécialités"],
  ["CONSULTATION SPECIALISTE", "Actes de Spécialités"],
  ["SPECIALISTE", "Actes de Spécialités"],
  ["CONSULTATION", "Consultations"],
];

function mapperDesignation(d: string): string {
  const upper = (d || "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [k, v] of MAP_DESIGNATION) {
    const kNorm = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (upper.includes(kNorm)) return v;
  }
  return "Actes de Spécialités";
}

function deviverTypePrestataire(nom: string): string {
  const n = nom.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("PHARMAC") || n.includes("DEPOT") || n.includes("OFFICINE")) return "Pharmacie";
  if (n.includes("LABORATOIRE") || n.includes("LABO ")) return "Laboratoire";
  if (n.includes("DENTAIRE") || n.includes("DENTAL")) return "Cabinet Dentaire";
  if (n.includes("IMAGERIE") || n.includes("SCANNER") || n.includes("RADIOLOGIE") || n.includes("IRM")) return "Centre d'Imagerie";
  if (n.includes("KINE") || n.includes("PHYSIO")) return "Centre de Kinésithérapie";
  if (n.includes("OPTIC") || n.includes("OPTIQUE") || n.includes("VISION")) return "Opticien";
  if (n.includes("HOPITAL") || n.includes("CENTRE HOSPITALIER") || n.includes("CHU") || n.includes("CHL")) return "Hôpital";
  if (n.includes("CLINIQUE")) return "Clinique";
  return "Cabinet";
}

function deviverSecteurPrestataire(nom: string): string {
  const n = nom.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if ((n.includes("HOPITAL") || n.includes("CHU") || n.includes("CHL")) && (n.includes("UNIVERSI") || n.includes("INSTRUCTION") || n.includes("ARMEE") || n.includes("PUBLIC"))) return "Public";
  return "Privé";
}

function toNombre(v: unknown): number {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return 0;
  const s0 = String(v).trim().replace(/ /g, " ");
  const match = s0.match(/[\d\s.,]+/);
  if (!match) return 0;
  let s = match[0].replace(/\s/g, "");
  if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function celluleEnTexte(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return ((v as { richText: { text: string }[] }).richText ?? []).map((r) => r.text ?? "").join("");
  }
  if (typeof v === "object" && "result" in (v as object)) {
    const res = (v as { result: unknown }).result;
    return res === null || res === undefined ? "" : String(res);
  }
  return String(v);
}

function celluleEnDate(v: unknown): string {
  if (v instanceof Date) {
    const d = v.getDate().toString().padStart(2, "0");
    const m = (v.getMonth() + 1).toString().padStart(2, "0");
    const y = v.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return celluleEnTexte(v);
}

// ── Prompt pour la détection automatique du type de document ───────────
const PROMPT_DETECTION = `Tu es Ariana, l'assistant IA d'un système d'assurance santé gabonais (MEDASSUR+).

Analyse ce document et identifie son type parmi les catégories suivantes :
- "factures" : liste de factures médicales avec références, montants, prestataires, matricules d'assurés
- "population" : liste de participants/assurés avec matricules, noms, dates de naissance, affiliation (AS/CJ/EF/EN), statuts (Actif/Terminé)
- "actes-medicaux" : catalogue d'actes médicaux avec libellés, familles, prix
- "souscripteurs" : liste d'entreprises clientes/souscripteurs avec noms, contacts
- "contrats" : liste de contrats d'assurance avec numéros de police, dates, primes
- "reglements" : liste de règlements/paiements de factures
- "prises-en-charge" : liste de prises en charge médicales

Réponds avec ce JSON (et SEULEMENT ce JSON, sans markdown) :
{
  "type": "<type détecté>",
  "police": "<numéro de police/contrat trouvé ou vide>",
  "organisme": "<nom de l'organisme/entreprise ou vide>",
  "periode": "<période couverte ou vide>",
  "confiance": "<haute|moyenne|faible>",
  "explication": "<1 phrase sur ce que contient ce document>"
}`;

// ── Prompt pour extraire les données de population ─────────────────────
const PROMPT_POPULATION = `Tu es Ariana, l'assistant IA de MEDASSUR+.
Ce document contient une liste de participants/assurés d'un contrat d'assurance santé gabonais.

Extrais TOUS les participants et renvoie ce JSON :
{
  "police": "numéro de police trouvé",
  "organisme": "nom de l'entreprise",
  "periode": "exercice ou période",
  "lignes": [
    {
      "matricule": "ex: LRX-57026K",
      "nom": "NOM",
      "prenom": "Prénom",
      "dateNaissance": "JJ/MM/AAAA",
      "sexe": "M ou F",
      "typeAssure": "AS ou CJ ou EF",
      "prime": 0,
      "dateEffet": "JJ/MM/AAAA ou vide",
      "statut": "Actif ou Terminé"
    }
  ]
}

Règles :
- typeAssure : AS = Assuré principal, CJ = Conjoint, EN ou Enfant → utilise "EF"
- sexe : Masculin → "M", Féminin → "F"
- statut : "Actif" ou "Terminé" (normalise toute variante)
- prime : nombre entier en FCFA (0 si absent)
- Retourne UNIQUEMENT le JSON, sans markdown ni commentaire`;

// ── Prompt pour extraire les actes médicaux ────────────────────────────
const PROMPT_ACTES = `Tu es Ariana, l'assistant IA de MEDASSUR+.
Ce document contient un catalogue d'actes médicaux avec codes, libellés, familles et prix.

Extrais TOUS les actes et renvoie ce JSON :
{
  "titre": "nom du catalogue",
  "lignes": [
    {
      "code": "code court de l'acte ou vide",
      "libelle": "libellé complet de l'acte",
      "famille": "rubrique/famille de l'acte",
      "prixDefaut": 0,
      "categorieGarantie": "Acte ou Consultation ou Imagerie ou Analyses ou Pharmacie ou Hospitalisation ou Dentaire ou Optique ou Maternité ou vide"
    }
  ]
}

Règles :
- libelle : texte MAJUSCULE complet (ex: "BIOPSIE SOPHAGIENNE")
- famille : groupe de l'acte (ex: "ACTES ORL", "EXAMENS LABORATOIRE")
- prixDefaut : nombre entier en FCFA (0 si absent)
- N'inclure que les lignes qui ont un libellé non vide
- Retourne UNIQUEMENT le JSON, sans markdown ni commentaire`;

// ── Prompt pour les factures ───────────────────────────────────────────
const PROMPT_LIGNES = `Structure JSON attendue (un seul objet racine) :
{
  "contratRef": "numéro de contrat/police",
  "organisme": "nom de la société/souscripteur",
  "periode": "période ex: 01/01/2025-31/12/2025",
  "lignes": [
    {
      "referenceFacture": "ex: LRX-91044H",
      "designation": "ex: ANALYSES MÉDICALES",
      "categorie": "ex: MALADIE",
      "matricule": "ex: LRX-00234 ou 0493-01232",
      "beneficiaire": "NOM PRÉNOM",
      "prestataireNom": "nom du prestataire",
      "datePrestation": "JJ/MM/AAAA",
      "montantTotal": 15000,
      "partPatient": 3000,
      "partFinanceur": 12000,
      "statut": "ex: Payé"
    }
  ]
}

Règles impératives :
- Une facture peut avoir plusieurs actes → une ligne JSON par ACTE (jamais par facture)
- partFinanceur = Part financeur = montant payé par l'assurance = net à payer
- montantTotal = Total de la ligne (frais réels)
- TOUS les montants sont des NOMBRES ENTIERS en FCFA
- datePrestation au format JJ/MM/AAAA
- Retourne UNIQUEMENT le JSON, sans markdown ni commentaire`;

@Injectable()
export class ImportLibreService {
  private anthropic: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private factures: FacturesService,
    private prestataires: PrestatairesService,
  ) {}

  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new BadRequestException("ANTHROPIC_API_KEY non configurée — analyse de document impossible.");
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  // ── Extraction du contenu textuel d'un fichier (tous formats) ──────────
  private async extraireContenu(buffer: Buffer, ext: string): Promise<string> {
    if (ext === ".xls" || ext === ".xlsx") {
      // SheetJS gère XLS BIFF8 ET XLSX
      const wb = XLSX.read(buffer, { type: "buffer" });
      const lignes: string[] = [];
      for (const nomFeuille of wb.SheetNames.slice(0, 3)) {
        const ws = wb.Sheets[nomFeuille];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        lignes.push(`=== Feuille: ${nomFeuille} ===`);
        for (const row of rows.slice(0, 600)) {
          const vals = (row as unknown[]).map((c) => String(c ?? "").trim()).filter(Boolean);
          if (vals.length > 0) lignes.push(vals.join(" | "));
        }
      }
      return lignes.join("\n");
    }
    if (ext === ".csv" || ext === ".txt") {
      return buffer.toString("utf-8").slice(0, 80000);
    }
    // PDF → retourner le buffer base64 pour Claude (traitement spécial)
    return buffer.toString("base64");
  }

  // ── Détection automatique du type de document via Claude ───────────────
  private async detecterType(buffer: Buffer, ext: string): Promise<{ type: TypeImportLibre; police: string; organisme: string; periode: string }> {
    const client = this.getAnthropicClient();

    let messages: Anthropic.MessageParam[];
    if (ext === ".pdf") {
      const data = buffer.toString("base64");
      messages = [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: PROMPT_DETECTION },
        ],
      }];
    } else {
      const texte = await this.extraireContenu(buffer, ext);
      messages = [{ role: "user", content: `${PROMPT_DETECTION}\n\nContenu du fichier (${ext}) :\n${texte.slice(0, 30000)}` }];
    }

    const reponse = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 512, messages });
    const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    try {
      const m = texte.match(/\{[\s\S]*\}/);
      if (m) {
        const r = JSON.parse(m[0]);
        return { type: r.type as TypeImportLibre ?? "factures", police: r.police ?? "", organisme: r.organisme ?? "", periode: r.periode ?? "" };
      }
    } catch { /* ok */ }
    return { type: "factures", police: "", organisme: "", periode: "" };
  }

  // ── Extraction des données de population via Claude ─────────────────────
  private async extrairePopulation(buffer: Buffer, ext: string): Promise<{ police: string; organisme: string; periode: string; lignesRaw: Omit<LignePopulation, "assureId" | "contratId" | "statutActuel" | "changementStatut" | "changementContrat" | "contratIdNouveau" | "erreur" | "doublon">[] }> {
    const client = this.getAnthropicClient();

    let messages: Anthropic.MessageParam[];
    if (ext === ".pdf") {
      const data = buffer.toString("base64");
      messages = [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: PROMPT_POPULATION },
        ],
      }];
    } else {
      const texte = await this.extraireContenu(buffer, ext);
      messages = [{ role: "user", content: `${PROMPT_POPULATION}\n\nContenu :\n${texte.slice(0, 60000)}` }];
    }

    const reponse = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 16000, messages });
    const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

    let parsed: { police?: string; organisme?: string; periode?: string; lignes?: unknown[] } = {};
    try {
      const m = texte.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { throw new BadRequestException("Impossible d'extraire les données de population du fichier."); }

    const lignesRaw = (parsed.lignes ?? []).map((l: unknown) => {
      const ligne = l as Record<string, unknown>;
      return {
        matricule: String(ligne.matricule ?? "").trim(),
        nom: String(ligne.nom ?? "").trim(),
        prenom: String(ligne.prenom ?? "").trim(),
        dateNaissance: String(ligne.dateNaissance ?? "").trim(),
        sexe: String(ligne.sexe ?? "").trim(),
        typeAssure: String(ligne.typeAssure ?? "AS").trim(),
        prime: toNombre(ligne.prime),
        dateEffet: String(ligne.dateEffet ?? "").trim(),
        statutFichier: String(ligne.statut ?? "Actif").trim(),
      };
    });

    return { police: parsed.police ?? "", organisme: parsed.organisme ?? "", periode: parsed.periode ?? "", lignesRaw };
  }

  // ── Extraction des actes médicaux via SheetJS ou Claude ─────────────────
  private async extraireActesMedicaux(buffer: Buffer, ext: string): Promise<{ titre: string; lignesRaw: Omit<LigneActeMedical, "acteId" | "estNouvel" | "prixActuel" | "changementPrix" | "erreur">[] }> {
    // Pour XLS/XLSX : parsing direct (structure connue)
    if (ext === ".xls" || ext === ".xlsx") {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });

      // Détecter les colonnes depuis la première ligne d'en-tête
      const headers = (rows[0] as unknown[]).map((c) => String(c).toLowerCase().trim());
      const iCode = headers.findIndex((h) => h === "code");
      const iNom = headers.findIndex((h) => h === "nom" || h === "libelle" || h === "libellé");
      const iRubrique = headers.findIndex((h) => h.includes("rubrique") && !h.includes("cde"));
      const iPrix = headers.findIndex((h) => h.includes("prix"));
      const iCategorie = headers.findIndex((h) => h.includes("catégorie") || h.includes("categorie"));

      const lignesRaw: Omit<LigneActeMedical, "acteId" | "estNouvel" | "prixActuel" | "changementPrix" | "erreur">[] = [];
      for (const row of rows.slice(1)) {
        const r = row as unknown[];
        const libelle = String(r[iNom >= 0 ? iNom : 2] ?? "").trim().toUpperCase();
        if (!libelle) continue;
        const famille = String(r[iRubrique >= 0 ? iRubrique : 4] ?? "").trim().toUpperCase() || "DIVERS";
        lignesRaw.push({
          code: String(r[iCode >= 0 ? iCode : 0] ?? "").trim(),
          libelle,
          famille,
          prixDefaut: toNombre(r[iPrix >= 0 ? iPrix : 7]),
          categorieGarantie: String(r[iCategorie >= 0 ? iCategorie : 8] ?? "").trim(),
        });
      }
      return { titre: wb.SheetNames[0] ?? "Catalogue", lignesRaw };
    }

    // Pour PDF ou CSV : appel Claude
    const client = this.getAnthropicClient();
    let messages: Anthropic.MessageParam[];
    if (ext === ".pdf") {
      const data = buffer.toString("base64");
      messages = [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }, { type: "text", text: PROMPT_ACTES }] }];
    } else {
      const texte = await this.extraireContenu(buffer, ext);
      messages = [{ role: "user", content: `${PROMPT_ACTES}\n\nContenu :\n${texte.slice(0, 60000)}` }];
    }
    const reponse = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 16000, messages });
    const texteR = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let parsed: { titre?: string; lignes?: unknown[] } = {};
    try {
      const m = texteR.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { throw new BadRequestException("Impossible d'extraire les actes médicaux."); }
    const lignesRaw = (parsed.lignes ?? []).map((l: unknown) => {
      const ligne = l as Record<string, unknown>;
      return {
        code: String(ligne.code ?? "").trim(),
        libelle: String(ligne.libelle ?? "").trim().toUpperCase(),
        famille: String(ligne.famille ?? "DIVERS").trim().toUpperCase(),
        prixDefaut: toNombre(ligne.prixDefaut),
        categorieGarantie: String(ligne.categorieGarantie ?? "").trim(),
      };
    }).filter((l: { libelle: string }) => l.libelle);
    return { titre: parsed.titre ?? "Catalogue", lignesRaw };
  }

  // ── Résolution d'une ligne de population contre la DB ────────────────
  private async resoudrePopulation(
    l: Omit<LignePopulation, "assureId" | "contratId" | "statutActuel" | "changementStatut" | "changementContrat" | "contratIdNouveau" | "erreur" | "doublon">,
    contratIdCible: string | null,
  ): Promise<LignePopulation> {
    if (!l.matricule) {
      return { ...l, assureId: null, contratId: null, statutActuel: null, changementStatut: false, changementContrat: false, contratIdNouveau: null, erreur: "Matricule absent", doublon: false };
    }

    const mat = l.matricule.trim();
    const assure = await this.prisma.assureSante.findFirst({
      where: { matricule: { equals: mat, mode: "insensitive" } },
      select: { id: true, statut: true, contratId: true },
    });

    const statutNormalise = l.statutFichier.toLowerCase().includes("termin") || l.statutFichier.toLowerCase().includes("inactif") ? "Inactif" : "Actif";

    if (!assure) {
      // Nouvel assuré
      return {
        ...l,
        assureId: null,
        contratId: contratIdCible,
        statutActuel: null,
        changementStatut: false,
        changementContrat: false,
        contratIdNouveau: contratIdCible,
        erreur: contratIdCible ? null : "Contrat introuvable pour ce numéro de police",
        doublon: false,
      };
    }

    const changementStatut = assure.statut !== statutNormalise;
    const changementContrat = contratIdCible !== null && assure.contratId !== contratIdCible;

    return {
      ...l,
      assureId: assure.id,
      contratId: assure.contratId,
      statutActuel: assure.statut,
      changementStatut,
      changementContrat,
      contratIdNouveau: changementContrat ? contratIdCible : null,
      erreur: null,
      doublon: !changementStatut && !changementContrat,
    };
  }

  // ── Résolution d'un acte médical contre la DB ─────────────────────────
  private async resoudreActe(
    l: Omit<LigneActeMedical, "acteId" | "estNouvel" | "prixActuel" | "changementPrix" | "erreur">,
  ): Promise<LigneActeMedical> {
    if (!l.libelle) {
      return { ...l, acteId: null, estNouvel: false, prixActuel: null, changementPrix: false, erreur: "Libellé absent" };
    }
    const acte = await this.prisma.acteMedical.findFirst({
      where: { libelle: { equals: l.libelle, mode: "insensitive" }, famille: { equals: l.famille, mode: "insensitive" } },
      select: { id: true, prixDefaut: true },
    });
    if (!acte) {
      return { ...l, acteId: null, estNouvel: true, prixActuel: null, changementPrix: false, erreur: null };
    }
    const prixActuel = Number(acte.prixDefaut);
    return { ...l, acteId: acte.id, estNouvel: false, prixActuel, changementPrix: l.prixDefaut > 0 && l.prixDefaut !== prixActuel, erreur: null };
  }

  // ── Aperçu population ──────────────────────────────────────────────────
  async apercuPopulation(file: Express.Multer.File): Promise<ResultatPopulation> {
    const ext = path.extname(file.originalname).toLowerCase();
    const { police, organisme, periode, lignesRaw } = await this.extrairePopulation(file.buffer, ext);

    // Trouver le contrat via le numéro de police
    let contratId: string | null = null;
    if (police) {
      const contrat = await this.prisma.contrat.findFirst({
        where: { OR: [{ numeroPolice: police }, { numeroPolice: { contains: police } }] },
        select: { id: true },
      });
      contratId = contrat?.id ?? null;
    }

    const BATCH = 20;
    const lignes: LignePopulation[] = [];
    for (let i = 0; i < lignesRaw.length; i += BATCH) {
      const batch = lignesRaw.slice(i, i + BATCH);
      const resolus = await Promise.all(batch.map((l) => this.resoudrePopulation(l, contratId)));
      lignes.push(...resolus);
    }

    return {
      police,
      organisme,
      periode,
      lignes,
      totalLignes: lignes.length,
      totalNouveaux: lignes.filter((l) => !l.assureId && !l.erreur).length,
      totalChangementsStatut: lignes.filter((l) => l.changementStatut).length,
      totalChangementsContrat: lignes.filter((l) => l.changementContrat).length,
      totalDoublons: lignes.filter((l) => l.doublon).length,
      totalErreurs: lignes.filter((l) => !!l.erreur).length,
      typeDetecte: "population",
    };
  }

  // ── Aperçu actes médicaux ──────────────────────────────────────────────
  async apercuActesMedicaux(file: Express.Multer.File): Promise<ResultatActesMedicaux> {
    const ext = path.extname(file.originalname).toLowerCase();
    const { titre, lignesRaw } = await this.extraireActesMedicaux(file.buffer, ext);

    const BATCH = 30;
    const lignes: LigneActeMedical[] = [];
    for (let i = 0; i < lignesRaw.length; i += BATCH) {
      const batch = lignesRaw.slice(i, i + BATCH);
      const resolus = await Promise.all(batch.map((l) => this.resoudreActe(l)));
      lignes.push(...resolus);
    }

    return {
      titre,
      lignes,
      totalLignes: lignes.length,
      totalNouveaux: lignes.filter((l) => l.estNouvel).length,
      totalMisesAJour: lignes.filter((l) => !l.estNouvel && l.changementPrix).length,
      totalDoublons: lignes.filter((l) => !l.estNouvel && !l.changementPrix && !l.erreur).length,
      totalErreurs: lignes.filter((l) => !!l.erreur).length,
      typeDetecte: "actes-medicaux",
    };
  }

  // ── Parsing Excel Eyassur (factures) ────────────────────────────────────
  private async parserExcelEyassur(buffer: Buffer): Promise<{ contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon" | "miseAJour" | "priseEnChargeId">[] }> {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const feuille = classeur.worksheets[0];
    if (!feuille) throw new BadRequestException("Fichier Excel vide ou illisible.");

    let contratRef = "";
    let organisme = "";
    let periode = "";
    for (let r = 1; r <= 8; r++) {
      const row = feuille.getRow(r);
      const a = celluleEnTexte(row.getCell(1).value).trim().toLowerCase();
      const b = celluleEnTexte(row.getCell(2).value).trim();
      if (a.includes("contrat")) contratRef = b;
      else if (a.includes("organisme") || a.includes("société") || a.includes("societe") || a.includes("souscripteur")) organisme = b;
      else if (a.includes("période") || a.includes("periode") || a.includes("prestation")) periode = b;
    }

    let headerRow = 7;
    for (let r = 1; r <= 12; r++) {
      const val = celluleEnTexte(feuille.getRow(r).getCell(1).value).toLowerCase().trim();
      if (val === "type ligne" || val === "type de ligne" || val === "type") { headerRow = r; break; }
    }

    const col: Record<string, number> = {};
    feuille.getRow(headerRow).eachCell((cell, colNum) => {
      const h = celluleEnTexte(cell.value).toLowerCase().trim().replace(/\s+/g, " ");
      if (h === "type ligne" || h === "type") col.type = colNum;
      else if (h.includes("catégorie") || h.includes("categorie")) col.categorie = colNum;
      else if (h.includes("référence externe") || h.includes("reference externe") || h.includes("référence") || h.includes("reference")) col.referenceFacture = colNum;
      else if (h.includes("bénéficiaire") || h.includes("beneficiaire")) col.beneficiaire = colNum;
      else if (h.includes("matricule")) col.matricule = colNum;
      else if (h === "a payer" || h === "à payer") col.aPayer = colNum;
      else if (h.includes("prestataire") && !h.includes("id")) col.prestataire = colNum;
      else if (h.includes("date prestation") || h.includes("date de prestation")) col.datePrestation = colNum;
      else if (h.includes("statut")) col.statut = colNum;
      else if (h.includes("désignation") || h.includes("designation")) col.designation = colNum;
      else if (h === "total ligne" || h === "total") col.totalLigne = colNum;
      else if (h.includes("part patient")) col.partPatient = colNum;
      else if (h.includes("part financeur") || h.includes("financeur")) col.partFinanceur = colNum;
    });

    const lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon" | "miseAJour" | "priseEnChargeId">[] = [];
    let header: Partial<typeof lignesRaw[0]> | null = null;

    for (let r = headerRow + 1; r <= feuille.rowCount; r++) {
      const row = feuille.getRow(r);
      const type = celluleEnTexte(row.getCell(col.type ?? 1).value).trim().toUpperCase();
      if (!type) continue;

      if (type === "FACTURE") {
        header = {
          referenceFacture: celluleEnTexte(row.getCell(col.referenceFacture ?? 3).value).trim(),
          categorie: celluleEnTexte(row.getCell(col.categorie ?? 2).value).trim(),
          matricule: celluleEnTexte(row.getCell(col.matricule ?? 5).value).trim(),
          beneficiaire: celluleEnTexte(row.getCell(col.beneficiaire ?? 4).value).trim(),
          prestataireNom: celluleEnTexte(row.getCell(col.prestataire ?? 7).value).trim(),
          datePrestation: celluleEnDate(row.getCell(col.datePrestation ?? 8).value).trim(),
          statut: celluleEnTexte(row.getCell(col.statut ?? 9).value).trim(),
          partFinanceur: toNombre(row.getCell(col.aPayer ?? 6).value),
        };
      } else if (type === "ACTE" && header) {
        const totalLigne = toNombre(row.getCell(col.totalLigne ?? 14).value);
        const partPatient = toNombre(row.getCell(col.partPatient ?? 15).value);
        const partFinanceurLigne = toNombre(row.getCell(col.partFinanceur ?? 16).value);
        const designation = celluleEnTexte(row.getCell(col.designation ?? 12).value).trim();

        lignesRaw.push({
          referenceFacture: header.referenceFacture ?? "",
          categorie: header.categorie ?? "",
          matricule: header.matricule ?? "",
          beneficiaire: header.beneficiaire ?? "",
          prestataireNom: header.prestataireNom ?? "",
          datePrestation: header.datePrestation ?? "",
          statut: header.statut ?? "",
          designation,
          montantTotal: totalLigne,
          partPatient,
          partFinanceur: partFinanceurLigne > 0 ? partFinanceurLigne : (header.partFinanceur ?? 0),
        });
      }
    }

    return { contratRef, organisme, periode, lignesRaw };
  }

  // ── Parsing PDF/texte via Claude (factures) ────────────────────────────
  private async parserFichierViaClaude(buffer: Buffer, ext: string): Promise<{ contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon" | "miseAJour" | "priseEnChargeId">[] }> {
    const client = this.getAnthropicClient();
    let messages: Anthropic.MessageParam[];

    if (ext === ".pdf") {
      const data = buffer.toString("base64");
      messages = [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: `Ce PDF est une "Liste des factures détaillées" d'un organisme d'assurance santé gabonais.\n\nExtrais TOUTES les factures et leurs actes médicaux.\n\n${PROMPT_LIGNES}` },
        ],
      }];
    } else {
      const texteContenu = buffer.toString("utf-8");
      messages = [{ role: "user", content: `Ce fichier ${ext} contient des données de factures médicales.\n\n${PROMPT_LIGNES}\n\n${texteContenu.slice(0, 100000)}` }];
    }

    const reponse = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 8192, messages });
    const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    return this.parseLignesJson(texte, ext);
  }

  private parseLignesJson(texte: string, source: string) {
    let parsed: { contratRef?: string; organisme?: string; periode?: string; lignes?: unknown[] };
    try {
      const match = texte.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Pas de JSON");
      parsed = JSON.parse(match[0]);
    } catch {
      throw new BadRequestException(`Impossible d'extraire les données de ce ${source}.`);
    }
    const lignesRaw = (parsed.lignes ?? []).map((l: unknown) => {
      const ligne = l as Record<string, unknown>;
      return {
        referenceFacture: String(ligne.referenceFacture ?? "").trim(),
        designation: String(ligne.designation ?? "").trim(),
        categorie: String(ligne.categorie ?? "").trim(),
        matricule: String(ligne.matricule ?? "").trim(),
        beneficiaire: String(ligne.beneficiaire ?? "").trim(),
        prestataireNom: String(ligne.prestataireNom ?? "").trim(),
        datePrestation: String(ligne.datePrestation ?? "").trim(),
        montantTotal: toNombre(ligne.montantTotal),
        partPatient: toNombre(ligne.partPatient),
        partFinanceur: toNombre(ligne.partFinanceur),
        statut: String(ligne.statut ?? "").trim(),
      };
    });
    return { contratRef: parsed.contratRef ?? "", organisme: parsed.organisme ?? "", periode: parsed.periode ?? "", lignesRaw };
  }

  // ── Résolution d'une ligne de facture ──────────────────────────────────
  private async resoudreLigne(
    l: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon" | "miseAJour" | "priseEnChargeId">,
    modeCorrection: boolean,
  ): Promise<LigneApercu> {
    if (!l.matricule) {
      return { ...l, assureId: null, contratId: null, prestataireId: null, erreur: "Matricule absent", doublon: false };
    }

    const mat = l.matricule.trim();
    let assure = await this.prisma.assureSante.findFirst({
      where: { matricule: { equals: mat, mode: "insensitive" } },
      select: { id: true, contratId: true },
    });

    if (!assure) {
      const alias = await this.prisma.matriculeAssuree.findFirst({
        where: { matricule: { equals: mat, mode: "insensitive" } },
        select: { identiteId: true },
      });
      if (alias) {
        assure = await this.prisma.assureSante.findFirst({
          where: { identiteId: alias.identiteId },
          orderBy: { id: "desc" },
          select: { id: true, contratId: true },
        }) ?? null;
      }
    }

    if (!assure) {
      return { ...l, assureId: null, contratId: null, prestataireId: null, erreur: `Assuré introuvable pour le matricule "${mat}"`, doublon: false };
    }

    let prestataireId: string | null = null;
    if (l.prestataireNom) {
      const aliasP = await this.prisma.prestataireAlias.findFirst({
        where: { nomOrigine: { equals: l.prestataireNom.trim(), mode: "insensitive" } },
        select: { prestataireId: true },
      });
      prestataireId = aliasP?.prestataireId ?? (
        await this.prisma.prestataire.findFirst({ where: { nom: { equals: l.prestataireNom.trim(), mode: "insensitive" } }, select: { id: true } })
      )?.id ?? null;
    }

    const typePrestation = mapperDesignation(l.designation);
    if (prestataireId) {
      const existant = await this.prisma.priseEnCharge.findFirst({
        where: { assureId: assure.id, date: l.datePrestation, type: typePrestation, facture: { prestataireId, referenceFacture: l.referenceFacture } },
        select: { id: true, baseRemboursement: true },
      });
      if (existant) {
        if (modeCorrection) {
          const baseActuelle = existant.baseRemboursement ? Number(existant.baseRemboursement) : 0;
          if (baseActuelle === 0 && l.partFinanceur > 0) {
            return { ...l, assureId: assure.id, contratId: assure.contratId, prestataireId, erreur: null, doublon: false, miseAJour: true, priseEnChargeId: existant.id };
          }
        }
        return { ...l, assureId: assure.id, contratId: assure.contratId, prestataireId, erreur: null, doublon: true };
      }
    }

    return { ...l, assureId: assure.id, contratId: assure.contratId, prestataireId, erreur: null, doublon: false };
  }

  // ── Aperçu principal (point d'entrée) ──────────────────────────────────
  async apercu(
    file: Express.Multer.File,
    modeCorrection = false,
    type: TypeImportLibre = "auto",
  ): Promise<ResultatApercu | ResultatPopulation | ResultatActesMedicaux> {
    const ext = path.extname(file.originalname).toLowerCase();

    // Détection automatique du type
    let typeFinal = type;
    let metaDetecte = { police: "", organisme: "", periode: "" };
    if (type === "auto") {
      const detection = await this.detecterType(file.buffer, ext);
      typeFinal = detection.type;
      metaDetecte = { police: detection.police, organisme: detection.organisme, periode: detection.periode };
    }

    // Router selon le type
    if (typeFinal === "population") {
      return this.apercuPopulation(file);
    }
    if (typeFinal === "actes-medicaux") {
      return this.apercuActesMedicaux(file);
    }

    // Types génériques (résumé Ariana)
    if (typeFinal !== "factures") {
      return this.apercuGenerique(file, typeFinal, metaDetecte);
    }

    // ── Factures ─────────────────────────────────────────────────────────
    let parsed: { contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon" | "miseAJour" | "priseEnChargeId">[] };

    if (ext === ".xlsx") {
      parsed = await this.parserExcelEyassur(file.buffer);
    } else if (ext === ".xls") {
      // XLS BIFF8 : déterminer si c'est un format Eyassur ou générique
      // On essaie d'abord via Claude pour les XLS non-Eyassur
      parsed = await this.parserFichierViaClaude(file.buffer, ext);
    } else if (ext === ".pdf") {
      parsed = await this.parserFichierViaClaude(file.buffer, ".pdf");
    } else if (ext === ".csv" || ext === ".txt") {
      parsed = await this.parserFichierViaClaude(file.buffer, ext);
    } else {
      throw new BadRequestException("Format non supporté. Utilisez PDF, Excel (.xlsx/.xls), CSV ou TXT.");
    }

    const lignesRaw = parsed.lignesRaw.filter((l) => l.referenceFacture || l.matricule);
    const BATCH = 20;
    const lignesResolues: LigneApercu[] = [];
    for (let i = 0; i < lignesRaw.length; i += BATCH) {
      const batch = lignesRaw.slice(i, i + BATCH);
      const resolus = await Promise.all(batch.map((l) => this.resoudreLigne(l, modeCorrection)));
      lignesResolues.push(...resolus);
    }

    return {
      contratRef: parsed.contratRef,
      organisme: parsed.organisme,
      periode: parsed.periode,
      lignes: lignesResolues,
      totalLignes: lignesResolues.length,
      totalResolues: lignesResolues.filter((l) => l.assureId && !l.doublon && !l.erreur).length,
      totalDoublons: lignesResolues.filter((l) => l.doublon).length,
      totalErreurs: lignesResolues.filter((l) => !!l.erreur).length,
      totalMisesAJour: lignesResolues.filter((l) => l.miseAJour).length,
      typeDetecte: "factures",
    };
  }

  // ── Aperçu générique (types non-factures non-population non-actes) ─────
  private async apercuGenerique(
    file: Express.Multer.File,
    type: TypeImportLibre,
    meta: { police: string; organisme: string; periode: string },
  ): Promise<ResultatApercu> {
    const labels: Record<string, string> = {
      souscripteurs: "souscripteurs (entreprises clientes)",
      contrats: "contrats d'assurance santé",
      assures: "assurés (personnes couvertes)",
      "prises-en-charge": "prises en charge médicales",
      reglements: "règlements de factures",
    };
    const ext = path.extname(file.originalname).toLowerCase();
    let texteContenu = "";

    if (ext === ".xlsx" || ext === ".xls") {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      texteContenu = rows.slice(0, 500).map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()).filter(Boolean).join(" | ")).join("\n");
    } else if (ext === ".csv" || ext === ".txt") {
      texteContenu = file.buffer.toString("utf-8").slice(0, 80000);
    } else if (ext === ".pdf") {
      // Pour PDF générique on envoie via Claude
      const client = this.getAnthropicClient();
      const data = file.buffer.toString("base64");
      const reponse = await client.messages.create({
        model: "claude-sonnet-5", max_tokens: 2048,
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: `Résume ce document en JSON : {"contratRef":"","organisme":"","periode":"","totalDetecte":0,"colonnesDetectees":[],"apercu":""}` },
        ]}],
      });
      const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      let resume: { contratRef?: string; organisme?: string; periode?: string; totalDetecte?: number; colonnesDetectees?: string[]; apercu?: string } = {};
      try { const m = texte.match(/\{[\s\S]*\}/); if (m) resume = JSON.parse(m[0]); } catch { /* ok */ }
      return {
        contratRef: resume.contratRef ?? meta.police,
        organisme: resume.organisme ?? meta.organisme,
        periode: resume.periode ?? meta.periode,
        lignes: [],
        totalLignes: resume.totalDetecte ?? 0,
        totalResolues: 0, totalDoublons: 0, totalErreurs: 0, totalMisesAJour: 0,
        typeDetecte: type as TypeImportLibre,
        apercu: resume.apercu,
        colonnesDetectees: resume.colonnesDetectees,
      } as ResultatApercu;
    } else {
      throw new BadRequestException(`Format ${ext} non supporté pour ce type d'import.`);
    }

    const client = this.getAnthropicClient();
    const reponse = await client.messages.create({
      model: "claude-sonnet-5", max_tokens: 2048,
      messages: [{ role: "user", content: `Ce fichier contient des données de ${labels[type] ?? type} pour un système d'assurance santé gabonais.\n\nAnalyse et renvoie : {"contratRef":"","organisme":"","periode":"","lignes":[],"totalDetecte":0,"colonnesDetectees":[],"apercu":""}\n\n${texteContenu.slice(0, 60000)}` }],
    });
    const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let resume: { contratRef?: string; organisme?: string; periode?: string; totalDetecte?: number; colonnesDetectees?: string[]; apercu?: string } = {};
    try { const m = texte.match(/\{[\s\S]*\}/); if (m) resume = JSON.parse(m[0]); } catch { /* ok */ }

    return {
      contratRef: resume.contratRef ?? meta.police,
      organisme: resume.organisme ?? meta.organisme,
      periode: resume.periode ?? meta.periode,
      lignes: [],
      totalLignes: resume.totalDetecte ?? 0,
      totalResolues: 0, totalDoublons: 0, totalErreurs: 0, totalMisesAJour: 0,
      typeDetecte: type as TypeImportLibre,
      apercu: resume.apercu,
      colonnesDetectees: resume.colonnesDetectees,
    } as ResultatApercu;
  }

  // ── Confirmer l'import ─────────────────────────────────────────────────
  async confirmer(
    lignes: LigneApercu[],
    modeCorrection = false,
    type: TypeImportLibre = "factures",
  ): Promise<{ importees: number; corrigees: number; ignorees: number }> {
    if (type === "population") {
      throw new BadRequestException("Utilisez confirmerPopulation() pour les données de population.");
    }
    if (type === "actes-medicaux") {
      throw new BadRequestException("Utilisez confirmerActesMedicaux() pour le catalogue d'actes.");
    }
    if (type !== "factures") {
      throw new BadRequestException(`L'import en mode libre pour « ${type} » nécessite d'utiliser l'import dédié (/api/import/).`);
    }

    const lignesValides = lignes.filter((l) => l.assureId && l.contratId && !l.doublon && !l.erreur);
    let importees = 0;
    let corrigees = 0;
    let ignorees = lignes.length - lignesValides.length;

    if (modeCorrection) {
      const lignesMaj = lignes.filter((l) => l.miseAJour && l.priseEnChargeId && l.partFinanceur > 0);
      for (const l of lignesMaj) {
        try {
          await this.prisma.priseEnCharge.update({ where: { id: l.priseEnChargeId! }, data: { baseRemboursement: l.partFinanceur } });
          corrigees++;
        } catch { ignorees++; }
      }
    }

    const acteGenerique = await this.prisma.acteMedical.findFirst({ where: { libelle: { contains: "non détaillée" } }, select: { id: true } });
    const prestataireCache = new Map<string, string>();

    for (const l of lignesValides) {
      if (l.prestataireId) { prestataireCache.set(l.prestataireNom, l.prestataireId); continue; }
      if (prestataireCache.has(l.prestataireNom)) continue;
      const nomTrim = l.prestataireNom.trim();
      if (!nomTrim) continue;
      const aliasP = await this.prisma.prestataireAlias.findFirst({ where: { nomOrigine: { equals: nomTrim, mode: "insensitive" } }, select: { prestataireId: true } });
      if (aliasP) { prestataireCache.set(l.prestataireNom, aliasP.prestataireId); continue; }
      const direct = await this.prisma.prestataire.findFirst({ where: { nom: { equals: nomTrim, mode: "insensitive" } }, select: { id: true } });
      if (direct) { prestataireCache.set(l.prestataireNom, direct.id); continue; }
      try {
        const cree = await this.prestataires.create({ nom: nomTrim, type: deviverTypePrestataire(nomTrim), secteur: deviverSecteurPrestataire(nomTrim), pays: "Gabon", ville: "Libreville", statutConvention: "En négociation" });
        prestataireCache.set(l.prestataireNom, cree.id);
      } catch { /* non créé */ }
    }

    const facturesParGroupe = new Map<string, string>();
    for (const l of lignesValides) {
      const prestataireId = prestataireCache.get(l.prestataireNom);
      if (!prestataireId || !l.assureId || !l.contratId) { ignorees++; continue; }
      const cleGroupe = `${prestataireId}|${l.referenceFacture}|${l.contratId}`;
      if (!facturesParGroupe.has(cleGroupe)) {
        const existante = await this.prisma.facture.findFirst({ where: { prestataireId, referenceFacture: l.referenceFacture, contratId: l.contratId }, select: { id: true } });
        if (existante) {
          facturesParGroupe.set(cleGroupe, existante.id);
        } else {
          try {
            const nouvelleFacture = await this.factures.create({ prestataireId, contratId: l.contratId, dateReception: l.datePrestation, referenceFacture: l.referenceFacture });
            facturesParGroupe.set(cleGroupe, nouvelleFacture.id);
          } catch { ignorees++; continue; }
        }
      }
      const factureId = facturesParGroupe.get(cleGroupe);
      if (!factureId) { ignorees++; continue; }
      try {
        await this.factures.ajouterLigne(factureId, {
          assureId: l.assureId,
          typePrestation: mapperDesignation(l.designation),
          datePrestation: l.datePrestation,
          acteMedicalId: acteGenerique?.id,
          montant: l.montantTotal,
        }, { ignorerDoublonMemeJour: true, exigerAffection: false, baseRemboursementImpose: l.partFinanceur, ignorerRetrait: true });
        importees++;
      } catch { ignorees++; }
    }

    return { importees, corrigees, ignorees };
  }

  // ── Confirmer import population ────────────────────────────────────────
  async confirmerPopulation(lignes: LignePopulation[]): Promise<{ crees: number; miseAJour: number; ignorees: number }> {
    let crees = 0;
    let miseAJour = 0;
    let ignorees = 0;

    for (const l of lignes) {
      if (l.erreur || l.doublon) { ignorees++; continue; }

      if (l.assureId) {
        // Assuré existant : mettre à jour statut et/ou contrat
        const update: Record<string, unknown> = {};
        if (l.changementStatut) {
          update.statut = l.statutFichier.toLowerCase().includes("termin") ? "Inactif" : "Actif";
        }
        if (l.changementContrat && l.contratIdNouveau) {
          update.contratId = l.contratIdNouveau;
        }
        if (Object.keys(update).length > 0) {
          try {
            await this.prisma.assureSante.update({ where: { id: l.assureId }, data: update });
            miseAJour++;
          } catch { ignorees++; }
        } else {
          ignorees++;
        }
      } else {
        // Nouvel assuré
        if (!l.contratId) { ignorees++; continue; }
        try {
          const { randomUUID } = await import("crypto");
          const nomComplet = l.nom.trim();
          await this.prisma.assureSante.create({
            data: {
              id: randomUUID(),
              nom: nomComplet,
              prenom: l.prenom.trim() || undefined,
              matricule: l.matricule.trim(),
              contratId: l.contratId,
              statut: l.statutFichier.toLowerCase().includes("termin") ? "Inactif" : "Actif",
              dateNaissance: l.dateNaissance || undefined,
              sexe: l.sexe || undefined,
              typeAssure: l.typeAssure || "AS",
              cotisation: l.prime,
              beneficiaires: 1,
              dateAffiliation: l.dateEffet || undefined,
            },
          });
          crees++;
        } catch { ignorees++; }
      }
    }

    return { crees, miseAJour, ignorees };
  }

  // ── Confirmer import actes médicaux ───────────────────────────────────
  async confirmerActesMedicaux(lignes: LigneActeMedical[]): Promise<{ crees: number; miseAJour: number; ignorees: number }> {
    let crees = 0;
    let miseAJour = 0;
    let ignorees = 0;

    for (const l of lignes) {
      if (l.erreur || (!l.estNouvel && !l.changementPrix)) { ignorees++; continue; }

      if (l.acteId && l.changementPrix) {
        try {
          await this.prisma.acteMedical.update({ where: { id: l.acteId }, data: { prixDefaut: l.prixDefaut } });
          miseAJour++;
        } catch { ignorees++; }
      } else if (l.estNouvel) {
        try {
          await this.prisma.acteMedical.create({
            data: {
              libelle: l.libelle,
              famille: l.famille,
              prixDefaut: l.prixDefaut,
              categorieGarantie: l.categorieGarantie || null,
            },
          });
          crees++;
        } catch { ignorees++; }
      }
    }

    return { crees, miseAJour, ignorees };
  }
}
