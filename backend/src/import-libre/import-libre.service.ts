import * as path from "path";
import ExcelJS from "exceljs";
import Anthropic from "@anthropic-ai/sdk";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FacturesService } from "../factures/factures.service";
import { PrestatairesService } from "../prestataires/prestataires.service";

// Import libre de factures (2026-10) — voir demande utilisateur : "un import
// libre pour les factures... Ariana pour lire des milliers de documents ou
// fichier de type excel, csv, txt et même PDF afin de récupérer les
// consommations d'un assuré peu importe le contrat." Contrairement à l'import
// classique (scopé à un contrat, format MedAssur), l'import libre accepte le
// format natif des exports d'autres systèmes (Eyassur "Liste des factures
// détaillées"...) et résout automatiquement l'assuré, le contrat et le
// prestataire.

export interface LigneApercu {
  referenceFacture: string;
  designation: string;        // acte médical (ex: ANALYSES MÉDICALES)
  categorie: string;
  matricule: string;
  beneficiaire: string;
  prestataireNom: string;
  datePrestation: string;     // DD/MM/YYYY
  montantTotal: number;       // frais réels (Total ligne)
  partPatient: number;
  partFinanceur: number;      // net à payer = baseRemboursement
  statut: string;
  // Résolution
  assureId: string | null;
  contratId: string | null;
  prestataireId: string | null;
  erreur: string | null;
  doublon: boolean;
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
}

// Mapping désignation Eyassur → type de prestation MedAssur+
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
  if (n.includes("KINE") || n.includes("KINE") || n.includes("PHYSIO")) return "Centre de Kinésithérapie";
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
  const s = String(v).replace(/\s/g, "").replace(",", ".");
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

  // ── Parsing Excel (format Eyassur "Liste des factures détaillées") ──────
  // Format : lignes 1-6 = métadonnées, ligne 7 (ou proche) = en-têtes,
  // puis alternance FACTURE (header) / ACTE (détail) / ligne vide.
  private async parserExcelEyassur(buffer: Buffer): Promise<{ contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon">[] }> {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const feuille = classeur.worksheets[0];
    if (!feuille) throw new BadRequestException("Fichier Excel vide ou illisible.");

    // Métadonnées
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

    // Trouver la ligne des en-têtes (cherche "type" dans col A)
    let headerRow = 7;
    for (let r = 1; r <= 12; r++) {
      const val = celluleEnTexte(feuille.getRow(r).getCell(1).value).toLowerCase().trim();
      if (val === "type ligne" || val === "type de ligne" || val === "type") { headerRow = r; break; }
    }

    // Mapper colonnes par en-tête
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

    const lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon">[] = [];
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
          // Part financeur de la ligne d'acte si disponible, sinon montant "A Payer" du header
          partFinanceur: partFinanceurLigne > 0 ? partFinanceurLigne : (header.partFinanceur ?? 0),
        });
      }
    }

    return { contratRef, organisme, periode, lignesRaw };
  }

  // ── Parsing PDF via Claude Vision ─────────────────────────────────────
  private async parserPdfViaClaude(buffer: Buffer): Promise<{ contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon">[] }> {
    const client = this.getAnthropicClient();
    const data = buffer.toString("base64");

    const reponse = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          {
            type: "text",
            text: `Ce PDF est une "Liste des factures détaillées" d'un organisme d'assurance santé gabonais.

Extrais TOUTES les factures et leurs actes médicaux. Pour chaque acte, crée une ligne JSON.

Structure JSON attendue (un seul objet racine) :
{
  "contratRef": "numéro de contrat/police",
  "organisme": "nom de la société/souscripteur",
  "periode": "période de prestation ex: 01/01/2025-31/12/2025",
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
- partFinanceur = Part financeur = montant payé par la compagnie d'assurance = net à payer
- montantTotal = Total de la ligne (frais réels)
- Les montants sont des nombres entiers en FCFA
- datePrestation au format JJ/MM/AAAA
- Retourne UNIQUEMENT le JSON, sans markdown ni commentaire`,
          },
        ],
      }],
    });

    const texte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let parsed: { contratRef?: string; organisme?: string; periode?: string; lignes?: unknown[] };
    try {
      const match = texte.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Pas de JSON");
      parsed = JSON.parse(match[0]);
    } catch {
      throw new BadRequestException("Impossible d'extraire les données de ce PDF — vérifiez que c'est un fichier 'Liste des factures détaillées'.");
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

  // ── Résolution d'une ligne (lecture seule) ──────────────────────────
  private async resoudreLigne(l: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon">): Promise<LigneApercu> {
    if (!l.matricule) {
      return { ...l, assureId: null, contratId: null, prestataireId: null, erreur: "Matricule absent", doublon: false };
    }

    // 1. Assuré par matricule (tous contrats)
    const mat = l.matricule.trim();
    let assure = await this.prisma.assureSante.findFirst({
      where: { matricule: { equals: mat, mode: "insensitive" } },
      select: { id: true, contratId: true },
    });

    if (!assure) {
      // Repli sur historique MatriculeAssuree
      const alias = await this.prisma.matriculeAssuree.findFirst({
        where: { matricule: { equals: mat, mode: "insensitive" } },
        select: { identiteId: true },
      });
      if (alias) {
        const parIdentite = await this.prisma.assureSante.findFirst({
          where: { identiteId: alias.identiteId },
          orderBy: { id: "desc" },
          select: { id: true, contratId: true },
        });
        assure = parIdentite ?? null;
      }
    }

    if (!assure) {
      return { ...l, assureId: null, contratId: null, prestataireId: null, erreur: `Assuré introuvable pour le matricule "${mat}"`, doublon: false };
    }

    // 2. Prestataire (lecture seule — pas de création à l'aperçu)
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

    // 3. Doublon
    const typePrestation = mapperDesignation(l.designation);
    let doublon = false;
    if (prestataireId) {
      const existant = await this.prisma.priseEnCharge.findFirst({
        where: { assureId: assure.id, date: l.datePrestation, type: typePrestation, facture: { prestataireId, referenceFacture: l.referenceFacture } },
        select: { id: true },
      }) as { id: string } | null;
      doublon = existant !== null;
    }

    return { ...l, assureId: assure.id, contratId: assure.contratId, prestataireId, erreur: null, doublon };
  }

  // ── Aperçu (lecture seule) ────────────────────────────────────────────
  async apercu(file: Express.Multer.File): Promise<ResultatApercu> {
    const ext = path.extname(file.originalname).toLowerCase();
    let parsed: { contratRef: string; organisme: string; periode: string; lignesRaw: Omit<LigneApercu, "assureId" | "contratId" | "prestataireId" | "erreur" | "doublon">[] };

    if (ext === ".xlsx" || ext === ".xls") {
      parsed = await this.parserExcelEyassur(file.buffer);
    } else if (ext === ".pdf") {
      parsed = await this.parserPdfViaClaude(file.buffer);
    } else if (ext === ".csv" || ext === ".txt") {
      // Pour CSV/TXT : déléguer à Claude Vision (traite le contenu comme texte)
      const client = this.getAnthropicClient();
      const texteContenu = file.buffer.toString("utf-8");
      const reponse = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: `Ce fichier ${ext} contient des données de factures médicales. Extrait TOUTES les lignes de prestation et retourne un JSON avec la structure : {"contratRef":"...","organisme":"...","periode":"...","lignes":[{"referenceFacture":"...","designation":"...","categorie":"...","matricule":"...","beneficiaire":"...","prestataireNom":"...","datePrestation":"JJ/MM/AAAA","montantTotal":0,"partPatient":0,"partFinanceur":0,"statut":"..."}]}. Retourne UNIQUEMENT le JSON.\n\n${texteContenu.slice(0, 100000)}`,
        }],
      });
      const texteR = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      try {
        const match = texteR.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Pas de JSON");
        const p = JSON.parse(match[0]) as { contratRef?: string; organisme?: string; periode?: string; lignes?: unknown[] };
        parsed = {
          contratRef: p.contratRef ?? "", organisme: p.organisme ?? "", periode: p.periode ?? "",
          lignesRaw: (p.lignes ?? []).map((ligne: unknown) => {
            const l = ligne as Record<string, unknown>;
            return {
              referenceFacture: String(l.referenceFacture ?? "").trim(),
              designation: String(l.designation ?? "").trim(),
              categorie: String(l.categorie ?? "").trim(),
              matricule: String(l.matricule ?? "").trim(),
              beneficiaire: String(l.beneficiaire ?? "").trim(),
              prestataireNom: String(l.prestataireNom ?? "").trim(),
              datePrestation: String(l.datePrestation ?? "").trim(),
              montantTotal: toNombre(l.montantTotal),
              partPatient: toNombre(l.partPatient),
              partFinanceur: toNombre(l.partFinanceur),
              statut: String(l.statut ?? "").trim(),
            };
          }),
        };
      } catch {
        throw new BadRequestException("Impossible d'extraire les données de ce fichier — format non reconnu.");
      }
    } else {
      throw new BadRequestException("Format non supporté. Utilisez un fichier PDF, Excel (.xlsx/.xls), CSV ou TXT.");
    }

    const lignesResolues: LigneApercu[] = [];
    for (const l of parsed.lignesRaw) {
      if (!l.referenceFacture && !l.matricule) continue;
      lignesResolues.push(await this.resoudreLigne(l));
    }

    const totalResolues = lignesResolues.filter((l) => l.assureId && !l.doublon && !l.erreur).length;
    const totalDoublons = lignesResolues.filter((l) => l.doublon).length;
    const totalErreurs = lignesResolues.filter((l) => !!l.erreur).length;

    return {
      contratRef: parsed.contratRef,
      organisme: parsed.organisme,
      periode: parsed.periode,
      lignes: lignesResolues,
      totalLignes: lignesResolues.length,
      totalResolues,
      totalDoublons,
      totalErreurs,
    };
  }

  // ── Confirmer l'import ───────────────────────────────────────────────
  async confirmer(lignes: LigneApercu[]): Promise<{ importees: number; ignorees: number }> {
    const lignesValides = lignes.filter((l) => l.assureId && l.contratId && !l.doublon && !l.erreur);
    let importees = 0;
    let ignorees = lignes.length - lignesValides.length;

    // Acte générique (reprise d'antériorité — voir ImportService)
    const acteGenerique = await this.prisma.acteMedical.findFirst({
      where: { libelle: { contains: "non détaillée" } },
      select: { id: true },
    });

    // Résoudre prestataires (créer si absent)
    const prestataireCache = new Map<string, string>();
    for (const l of lignesValides) {
      if (l.prestataireId) {
        prestataireCache.set(l.prestataireNom, l.prestataireId);
        continue;
      }
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
      } catch {
        // Prestataire non créé — lignes concernées seront ignorées
      }
    }

    // Grouper et créer Factures + PriseEnCharge
    const facturesParGroupe = new Map<string, string>();

    for (const l of lignesValides) {
      const prestataireId = prestataireCache.get(l.prestataireNom);
      if (!prestataireId || !l.assureId || !l.contratId) { ignorees++; continue; }

      const cleGroupe = `${prestataireId}|${l.referenceFacture}|${l.contratId}`;
      if (!facturesParGroupe.has(cleGroupe)) {
        const existante = await this.prisma.facture.findFirst({
          where: { prestataireId, referenceFacture: l.referenceFacture, contratId: l.contratId },
          select: { id: true },
        });
        if (existante) {
          facturesParGroupe.set(cleGroupe, existante.id);
        } else {
          try {
            const nouvelleFacture = await this.factures.create({
              prestataireId, contratId: l.contratId,
              dateReception: l.datePrestation,
              referenceFacture: l.referenceFacture,
            });
            facturesParGroupe.set(cleGroupe, nouvelleFacture.id);
          } catch {
            ignorees++;
            continue;
          }
        }
      }

      const factureId = facturesParGroupe.get(cleGroupe);
      if (!factureId) { ignorees++; continue; }

      try {
        const typePrestation = mapperDesignation(l.designation);
        await this.factures.ajouterLigne(factureId, {
          assureId: l.assureId,
          typePrestation,
          datePrestation: l.datePrestation,
          acteMedicalId: acteGenerique?.id,
          montant: l.montantTotal,
        }, {
          ignorerDoublonMemeJour: true,
          exigerAffection: false,
          // Reprise d'antériorité (2026-10) — partFinanceur = net à payer =
          // baseRemboursement, jamais recalculé depuis les taux du contrat
          // (voir ImportService.creerFacturesDepuisLignesResolues).
          baseRemboursementImpose: l.partFinanceur,
          ignorerRetrait: true,
        });
        importees++;
      } catch {
        ignorees++;
      }
    }

    return { importees, ignorees };
  }
}
