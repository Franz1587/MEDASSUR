import * as XLSX from "xlsx";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { normaliserCle } from "./classeur.util";
import { normaliserRubrique } from "../actes-medicaux/rubrique-contrat.util";
import { randomUUID } from "crypto";

// Import PEC (Prises en charge / entente préalable) depuis classeur multi-feuilles
// extrait de l'ancien système — voir demande utilisateur : « ces données doivent être
// récupérées et corrigées... montant négatif à la part de l'assuré dû à une mauvaise
// gestion de quote-part » (2026-11-07).
//
// Règle de correction des montants négatifs :
//   L'ancien système prenait le PLAFOND de la garantie comme part assurance, même quand
//   les frais réels sont inférieurs au plafond. Ex : CHAMBRE (plafond 65 000 F) pour des
//   frais réels de 40 000 F → part assurance = 65 000, part patient = -25 000.
//   Correction : baseRemboursement = min(fraisReels, partAssurance) ; partPatient = 0 au minimum.

export interface EchantillonPec { ref: string; beneficiaire: string; souscripteur: string; detail: string }
export interface EchantillonCorrection { ref: string; acte: string; fraisReels: number; ancienne: number; nouvelle: number }

export interface ResultatPec {
  typeDetecte: "pec";
  planId: string;
  nomFichier: string;
  totalPec: number;
  totalActes: number;
  assuresTrouves: number;
  assuresNonTrouves: number;
  prestatairesTouves: number;
  prestatairesNonTrouves: number;
  montantsNegatifs: number;
  doublons: number;
  actesACreer: number;
  statuts: Record<string, number>;
  anomalies: { type: string; nombre: number; exemples: string[] }[];
  echantillons: {
    nonTrouves: EchantillonPec[];
    corriges: EchantillonCorrection[];
    doublons: EchantillonPec[];
  };
}

export interface BilanPec {
  crees: number;
  doublonsIgnores: number;
  montantsCorrigés: number;
  erreurs: string[];
}

interface ActionPec {
  assureId: string;
  contratId: string;
  prestataireNom: string;
  prestataireId: string | null;
  type: string;
  date: string;
  fraisReels: number;
  baseRemboursement: number;
  statutMedassur: string;
  statutControleMedical: string;
  motifRejet?: string;
  prescriptionRef: string; // N° PEC externe — clé de déduplication au ré-import
  estCorrige: boolean;
}

interface PlanPec { societeId: string | null; lignes: ActionPec[]; expiresAt: number }

const PLANS = new Map<string, PlanPec>();
const PLAN_TTL_MS = 60 * 60 * 1000; // 1 h

// ── Utilitaires ─────────────────────────────────────────────────────────────

function extraireMatricule(refAssure: string): string {
  // "BNF20240005061-FGVQO / LRX-59305S" → "LRX-59305S"
  // "LRX-56995X" → "LRX-56995X"
  const idx = refAssure.indexOf(" / ");
  return idx >= 0 ? refAssure.slice(idx + 3).trim() : refAssure.trim();
}

function parseMontant(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function parseDatePec(valeur: string): string {
  // "06/11/2026 14:22:03" → "06/11/2026"  |  "30/05/2026" → "30/05/2026"
  return (valeur || "").split(" ")[0].trim() || "";
}

function statutVersStatutMedassur(s: string): { statut: string; statutControleMedical: string; motifRejet?: string } {
  const v = s.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (v.startsWith("ACCORD")) return { statut: "Déclaré", statutControleMedical: "Validé" };
  if (v.startsWith("REFUS"))  return { statut: "Rejeté",  statutControleMedical: "Rejeté",  motifRejet: "Refusée (import antériorité)" };
  return { statut: "Déclaré", statutControleMedical: "Non requis" };
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ImportPecService {
  constructor(private prisma: PrismaService) {}

  // Détecte si un Buffer Excel est un classeur PEC (feuilles "PEC" + "Actes").
  static detecter(buffer: Buffer): boolean {
    try {
      const wb = XLSX.read(buffer, { type: "buffer", bookSheets: true });
      return wb.SheetNames.includes("PEC") && wb.SheetNames.includes("Actes");
    } catch {
      return false;
    }
  }

  async apercu(buffer: Buffer, nomFichier: string): Promise<ResultatPec> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    if (!wb.Sheets["PEC"] || !wb.Sheets["Actes"])
      throw new BadRequestException("Le classeur doit contenir les feuilles 'PEC' et 'Actes'.");

    // ── Lire la feuille Actes ─────────────────────────────────────────────
    const rowsActes = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Actes"], { header: 1, defval: "", raw: false, blankrows: false }).slice(1);
    // Map N° PEC → liste d'actes
    const actesByPec = new Map<string, { acte: string; fraisReels: number; partAssurance: number; baseRemboursementCorrige: number; estCorrige: boolean }[]>();
    let totalActes = 0;
    let montantsNegatifs = 0;
    for (const r of rowsActes) {
      const numPec = String(r[0] ?? "").trim();
      if (!numPec) continue;
      const fraisReels = parseMontant(r[4]);
      const partAssurance = parseMontant(r[5]);
      const partPatient = parseMontant(r[6]);
      const estCorrige = partPatient < 0;
      if (estCorrige) montantsNegatifs++;
      const baseRemboursementCorrige = estCorrige ? Math.min(fraisReels, partAssurance) : partAssurance;
      const list = actesByPec.get(numPec) ?? [];
      list.push({ acte: String(r[3] ?? "").trim(), fraisReels, partAssurance, baseRemboursementCorrige, estCorrige });
      actesByPec.set(numPec, list);
      totalActes++;
    }

    // ── Données de référence (société courante via middleware) ─────────────
    const tousContrats = await this.prisma.contrat.findMany({ select: { id: true } });
    const contratIds = tousContrats.map((c) => c.id);

    const toutesAS = await this.prisma.assureSante.findMany({
      where: { contratId: { in: contratIds } },
      select: { id: true, matricule: true, contratId: true },
    });
    const asParMatricule = new Map(toutesAS.map((a) => [a.matricule.trim().toUpperCase(), a]));

    const tousPrestataires = await this.prisma.prestataire.findMany({
      select: { id: true, nom: true, aliases: { select: { alias: true } } },
    });
    const prestParNom = new Map<string, string>();
    for (const p of tousPrestataires) {
      prestParNom.set(normaliserCle(p.nom), p.id);
      for (const a of p.aliases) prestParNom.set(normaliserCle(a.alias), p.id);
    }

    // PEC déjà importées (par prescriptionRef)
    const refExistantes = new Set<string>(
      (await this.prisma.priseEnCharge.findMany({
        where: { prescriptionRef: { not: null } },
        select: { prescriptionRef: true },
      })).map((p) => p.prescriptionRef as string),
    );

    // ── Résoudre chaque ligne PEC ─────────────────────────────────────────
    const rowsPec = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["PEC"], { header: 1, defval: "", raw: false, blankrows: false }).slice(1);
    const statuts: Record<string, number> = {};
    let assuresTrouves = 0, assuresNonTrouves = 0, prestatairesTouves = 0, prestatairesNonTrouves = 0, doublons = 0;
    const echNonTrouves: EchantillonPec[] = [];
    const echCorriges: EchantillonCorrection[] = [];
    const echDoublons: EchantillonPec[] = [];
    const actions: ActionPec[] = [];

    for (const r of rowsPec) {
      // Colonnes : 0=Ligne, 1=N°PEC, 2=RéfFiche, 3=Statut, 4=Date, 5=Période,
      //            6=Bénéficiaire, 7=DdnBenef, 8=Contact, 9=TypeBenef, 10=AssuréprincipalRef,
      //            11=AssurPrincipal, 12=DdnAssure, 13=Souscripteur, 14=Prestataire,
      //            15=Produit, 16=Validité, 17=TypeGarantie
      const numPec       = String(r[1]  ?? "").trim();
      const statutPec    = String(r[3]  ?? "").trim();
      const dateCreation = parseDatePec(String(r[4] ?? ""));
      const beneficiaire = String(r[6]  ?? "").trim();
      const souscripteur = String(r[13] ?? "").trim();
      const nomPrest     = String(r[14] ?? "").trim();
      const refAssure    = String(r[10] ?? "").trim();
      if (!numPec) continue;

      statuts[statutPec] = (statuts[statutPec] ?? 0) + 1;

      const actes = actesByPec.get(numPec) ?? [];
      if (actes.length === 0) continue; // aucun acte → rien à créer

      // Doublon
      if (refExistantes.has(numPec)) {
        doublons++;
        if (echDoublons.length < 5) echDoublons.push({ ref: numPec, beneficiaire, souscripteur, detail: "Déjà importée" });
        continue;
      }

      // Résoudre assuré par matricule
      const matricule = extraireMatricule(refAssure).toUpperCase();
      const assure = asParMatricule.get(matricule);
      if (!assure) {
        assuresNonTrouves++;
        if (echNonTrouves.length < 10) echNonTrouves.push({ ref: numPec, beneficiaire, souscripteur, detail: `Matricule: ${matricule}` });
        continue;
      }
      assuresTrouves++;

      // Résoudre prestataire
      const prestId = prestParNom.get(normaliserCle(nomPrest)) ?? null;
      if (prestId) prestatairesTouves++; else prestatairesNonTrouves++;

      const { statut: statutMedassur, statutControleMedical, motifRejet } = statutVersStatutMedassur(statutPec);

      for (const acte of actes) {
        // Rubrique depuis le libellé de l'acte (ex. "CHAMBRE (65)" → "Hospitalisation")
        const type = normaliserRubrique(acte.acte) !== acte.acte
          ? normaliserRubrique(acte.acte)
          : "Consultation/Divers";
        actions.push({
          assureId: assure.id, contratId: assure.contratId,
          prestataireNom: nomPrest, prestataireId: prestId,
          type, date: dateCreation,
          fraisReels: acte.fraisReels, baseRemboursement: acte.baseRemboursementCorrige,
          statutMedassur, statutControleMedical, motifRejet,
          prescriptionRef: numPec,
          estCorrige: acte.estCorrige,
        });
        if (acte.estCorrige && echCorriges.length < 10) {
          echCorriges.push({ ref: numPec, acte: acte.acte, fraisReels: acte.fraisReels, ancienne: acte.partAssurance, nouvelle: acte.baseRemboursementCorrige });
        }
      }
    }

    const planId = randomUUID();
    PLANS.set(planId, { societeId: TenantContext.getSocieteId(), lignes: actions, expiresAt: Date.now() + PLAN_TTL_MS });

    return {
      typeDetecte: "pec", planId, nomFichier,
      totalPec: rowsPec.length, totalActes,
      assuresTrouves, assuresNonTrouves, prestatairesTouves, prestatairesNonTrouves,
      montantsNegatifs, doublons, actesACreer: actions.length,
      statuts,
      anomalies: [
        ...(assuresNonTrouves > 0 ? [{ type: "Assuré introuvable", nombre: assuresNonTrouves, exemples: echNonTrouves.slice(0, 5).map((e) => `${e.ref} — ${e.beneficiaire} (${e.detail})`) }] : []),
        ...(prestatairesNonTrouves > 0 ? [{ type: "Prestataire sans correspondance", nombre: prestatairesNonTrouves, exemples: [] }] : []),
        ...(doublons > 0 ? [{ type: "Déjà importée", nombre: doublons, exemples: echDoublons.map((e) => e.ref) }] : []),
      ],
      echantillons: { nonTrouves: echNonTrouves, corriges: echCorriges, doublons: echDoublons },
    };
  }

  async confirmer(planId: string): Promise<BilanPec> {
    const plan = PLANS.get(planId);
    if (!plan || plan.expiresAt < Date.now()) throw new NotFoundException("Plan expiré ou introuvable. Relancez l'aperçu.");
    if (plan.societeId !== TenantContext.getSocieteId()) throw new BadRequestException("Société incohérente.");
    PLANS.delete(planId);

    // Recalculer les doublons (ré-import concurrent possible)
    const toutesPrescRef = [...new Set(plan.lignes.map((l) => l.prescriptionRef))];
    const refExistantes = new Set<string>(
      (await this.prisma.priseEnCharge.findMany({
        where: { prescriptionRef: { in: toutesPrescRef } },
        select: { prescriptionRef: true },
      })).map((p) => p.prescriptionRef as string),
    );

    const annee = new Date().getFullYear();
    let crees = 0, doublonsIgnores = 0, montantsCorrigés = 0;
    const erreurs: string[] = [];
    const societeId = plan.societeId;

    // Préparer les données, par chunks de 500
    const data: Parameters<typeof this.prisma.priseEnCharge.createMany>[0]["data"] = [];
    for (const a of plan.lignes) {
      if (refExistantes.has(a.prescriptionRef)) { doublonsIgnores++; continue; }
      if (a.estCorrige) montantsCorrigés++;
      data.push({
        id: `IMP-${annee}-${randomUUID().slice(0, 6).toUpperCase()}`,
        assureId: a.assureId,
        contratId: a.contratId,
        prestataire: a.prestataireNom,
        prestataireId: a.prestataireId ?? undefined,
        type: a.type,
        montant: a.fraisReels,
        baseRemboursement: a.baseRemboursement,
        date: a.date,
        modePaiement: "TiersPayant",
        statut: a.statutMedassur,
        statutControleMedical: a.statutControleMedical,
        ...(a.motifRejet ? { motifRejet: a.motifRejet } : {}),
        prescriptionRef: a.prescriptionRef,
        ...(societeId ? { societeId } : {}),
      });
    }

    // Insertion par lots de 500 pour éviter les timeouts
    for (let i = 0; i < data.length; i += 500) {
      try {
        const result = await this.prisma.priseEnCharge.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
        crees += result.count;
      } catch (e) {
        erreurs.push(`Lot ${Math.floor(i / 500) + 1} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { crees, doublonsIgnores, montantsCorrigés, erreurs };
  }
}
