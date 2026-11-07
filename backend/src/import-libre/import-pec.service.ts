import * as XLSX from "xlsx";
import { lireXlsxSur } from "../import/safe-xlsx.util";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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

export interface SuggestionPrestataire { id: string; nom: string }
export interface PrestatairePecInconnu { nom: string; compte: number; suggestions: SuggestionPrestataire[] }

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
  prestatairesInconnus: PrestatairePecInconnu[];
}

export interface BilanPec {
  crees: number;
  creesAccords: number;
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
  taux: number;
  resteACharge: number;
  acteLibelle: string;
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

// Scoring fuzzy entre deux noms normalisés (0 = aucun rapport, 1 = identique)
function scoreFuzzy(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const tA = a.split(" ").filter(Boolean);
  const tB = new Set(b.split(" ").filter(Boolean));
  const overlap = tA.filter((t) => tB.has(t)).length;
  if (tA.length > 0 && overlap / tA.length >= 0.5) return 0.5 + (overlap / tA.length) * 0.3;
  return 0;
}

function extraireMatricule(refAssure: string): string {
  // "BNF20240005061-FGVQO / LRX-59305S" → "LRX-59305S"
  // "LRX-56995X" → "LRX-56995X"
  const idx = refAssure.indexOf(" / ");
  return idx >= 0 ? refAssure.slice(idx + 3).trim() : refAssure.trim();
}

function parseMontant(v: unknown): number {
  let s = String(v ?? "0").replace(/\s/g, "").trim();
  if (!s || s === "-") return 0;
  const hasComma = s.includes(",");
  const hasDot   = s.includes(".");
  if (hasComma && hasDot) {
    // "1,234.56" (anglais) ou "1.234,56" (français) — dernier séparateur = décimale
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) s = s.replace(/,/g, "");        // anglais
    else s = s.replace(/\./g, "").replace(",", ".");                               // français
  } else if (hasComma) {
    // "220,000" → virgule suivie de 3 chiffres = séparateur milliers (FCFA)
    if (/,\d{3}(,|$)/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// "CHAMBRE (50)" → { libelle: "CHAMBRE", plafond: 50000 }
// "(50)" = plafond en milliers de FCFA (voir demande utilisateur 2026-11-07)
function extrairePlafond(acte: string): { libelle: string; plafond: number | null } {
  const m = acte.match(/^(.+?)\s*\((\d+)\)\s*$/);
  if (m) return { libelle: m[1].trim(), plafond: parseInt(m[2]) * 1000 };
  return { libelle: acte, plafond: null };
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
      const wb = lireXlsxSur(buffer, { bookSheets: true });
      return wb.SheetNames.includes("PEC") && wb.SheetNames.includes("Actes");
    } catch {
      return false;
    }
  }

  async apercu(buffer: Buffer, nomFichier: string): Promise<ResultatPec> {
    const wb = lireXlsxSur(buffer);
    if (!wb.Sheets["PEC"] || !wb.Sheets["Actes"])
      throw new BadRequestException("Le classeur doit contenir les feuilles 'PEC' et 'Actes'.");

    // ── Lire la feuille Actes ─────────────────────────────────────────────
    const rowsActes = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Actes"], { header: 1, defval: "", raw: false, blankrows: false }).slice(1);
    // Map N° PEC → liste d'actes (avec prestataire par ligne)
    const actesByPec = new Map<string, { acte: string; prestataire: string; fraisReels: number; partAssurance: number; baseRemboursementCorrige: number; estCorrige: boolean }[]>();
    let totalActes = 0;
    let montantsNegatifs = 0;
    for (const r of rowsActes) {
      const numPec = String(r[0] ?? "").trim();
      if (!numPec) continue;
      // Colonnes Actes : 0=N°PEC, 1=Bénéficiaire, 2=TypeBénéf, 3=AssuréPrincipal,
      //   4=Souscripteur, 5=Prestataire, 6=StatutPEC, 7=Acte, 8=FraisRéels, 9=PartAssurance, 10=PartPatient
      const fraisReels = parseMontant(r[8]);
      const partAssurance = parseMontant(r[9]);
      const partPatient = parseMontant(r[10]);
      const estCorrige = partPatient < 0;
      if (estCorrige) montantsNegatifs++;
      const baseRemboursementCorrige = estCorrige ? Math.min(fraisReels, partAssurance) : partAssurance;
      const list = actesByPec.get(numPec) ?? [];
      list.push({ acte: String(r[7] ?? "").trim(), prestataire: String(r[5] ?? "").trim(), fraisReels, partAssurance, baseRemboursementCorrige, estCorrige });
      actesByPec.set(numPec, list);
      totalActes++;
    }

    // ── Lire la feuille Rubriques (garantie + taux par PEC) ───────────────
    const rowsRubriques = wb.Sheets["Rubriques"]
      ? XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Rubriques"], { header: 1, defval: "", raw: false, blankrows: false }).slice(1)
      : [];
    // Map N° PEC → garantie principale et taux (première ligne gagne)
    const garantieByPec = new Map<string, string>();
    const tauxByPec = new Map<string, number>();
    for (const r of rowsRubriques) {
      // Colonnes Rubriques : 0=N°PEC, 1=Bénéficiaire, 2=Souscripteur, 3=Prestataire,
      //   4=StatutPEC, 5=Garantie, 6=Taux(%)
      const numPec = String(r[0] ?? "").trim();
      if (numPec && !garantieByPec.has(numPec)) {
        garantieByPec.set(numPec, String(r[5] ?? "").trim());
        tauxByPec.set(numPec, parseMontant(r[6]));
      }
    }

    // ── Données de référence (société courante via middleware) ─────────────
    const tousContrats = await this.prisma.contrat.findMany({ select: { id: true } });
    const contratIds = tousContrats.map((c) => c.id);

    const toutesAS = await this.prisma.assureSante.findMany({
      where: { contratId: { in: contratIds } },
      select: { id: true, matricule: true, contratId: true },
    });
    const asParMatricule = new Map(toutesAS.map((a) => [a.matricule.trim().toUpperCase(), a]));

    // Enrichir avec les anciens matricules (import depuis un ancien système —
    // le fichier PEC peut référencer l'ancien matricule d'un assuré qui a
    // depuis été aligné sur son nouveau matricule).
    const anciensMats = await this.prisma.matriculeAssuree.findMany({
      where: { identite: { affiliations: { some: { contratId: { in: contratIds } } } } },
      select: { matricule: true, identite: { select: { affiliations: { where: { contratId: { in: contratIds } }, select: { id: true, matricule: true, contratId: true }, take: 1 } } } },
    });
    for (const h of anciensMats) {
      const assure = h.identite.affiliations[0];
      if (assure && !asParMatricule.has(h.matricule.trim().toUpperCase()))
        asParMatricule.set(h.matricule.trim().toUpperCase(), assure);
    }

    const tousPrestataires = await this.prisma.prestataire.findMany({
      select: { id: true, nom: true, aliases: { select: { nomOrigine: true } } },
    });
    const prestParNom = new Map<string, string>();
    for (const p of tousPrestataires) {
      prestParNom.set(normaliserCle(p.nom), p.id);
      for (const a of p.aliases) prestParNom.set(normaliserCle(a.nomOrigine), p.id);
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
    const nomsInconnus = new Map<string, number>(); // nom original → nombre de lignes

    for (const r of rowsPec) {
      // Colonnes PEC : 0=Ligne, 1=N°PEC(liste), 2=N°PEC(fiche), 3=Statut, 4=Date, 5=Période,
      //   6=Bénéficiaire, 7=DdnBenef, 8=ContactBenef, 9=TypeBenef, 10=RéfAssuréPrincipal,
      //   11=NomAssuréPrincipal, 12=DdnAssuré, 13=ContactAssuré, 14=Souscripteur, 15=Prestataire,
      //   16=Produit, 17=Validité, 18=TypeGarantie, 19=NbActes, 20=TotalFrais, 21=TotalPartAss, 22=TotalPartPat
      const numPec       = String(r[1]  ?? "").trim();
      const statutPec    = String(r[3]  ?? "").trim();
      const dateCreation = parseDatePec(String(r[4] ?? ""));
      const beneficiaire = String(r[6]  ?? "").trim();
      const souscripteur = String(r[14] ?? "").trim();
      const nomPrest     = String(r[15] ?? "").trim();
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
      if (prestId) prestatairesTouves++; else {
        prestatairesNonTrouves++;
        nomsInconnus.set(nomPrest, (nomsInconnus.get(nomPrest) ?? 0) + 1);
      }

      const { statut: statutMedassur, statutControleMedical, motifRejet } = statutVersStatutMedassur(statutPec);
      // Garantie et taux depuis la feuille Rubriques (priorité sur la détection par libellé)
      const garantiePec = garantieByPec.get(numPec);
      const tauxPec = tauxByPec.get(numPec) ?? 100;

      for (const acte of actes) {
        // Prestataire par ligne depuis la feuille Actes (col 5) ; fallback : feuille PEC
        const prestActeNom = acte.prestataire || nomPrest;
        const prestActeId = prestParNom.get(normaliserCle(prestActeNom)) ?? prestId ?? null;
        if (!prestActeId && !prestParNom.has(normaliserCle(prestActeNom)))
          nomsInconnus.set(prestActeNom, (nomsInconnus.get(prestActeNom) ?? 0) + 1);

        // Type/garantie : Rubriques en priorité, sinon normalisation par libellé d'acte
        const type = garantiePec || (normaliserRubrique(acte.acte) !== acte.acte ? normaliserRubrique(acte.acte) : "Consultation/Divers");
        const resteACharge = Math.max(0, acte.fraisReels - acte.baseRemboursementCorrige);

        actions.push({
          assureId: assure.id, contratId: assure.contratId,
          prestataireNom: prestActeNom, prestataireId: prestActeId,
          type, date: dateCreation,
          fraisReels: acte.fraisReels, baseRemboursement: acte.baseRemboursementCorrige,
          taux: tauxPec, resteACharge,
          acteLibelle: acte.acte,
          statutMedassur, statutControleMedical, motifRejet,
          prescriptionRef: numPec,
          estCorrige: acte.estCorrige,
        });
        if (acte.estCorrige && echCorriges.length < 10) {
          echCorriges.push({ ref: numPec, acte: acte.acte, fraisReels: acte.fraisReels, ancienne: acte.partAssurance, nouvelle: acte.baseRemboursementCorrige });
        }
      }
    }

    // Suggestions fuzzy pour les prestataires inconnus (top 50 par volume)
    const prestatairesInconnus: PrestatairePecInconnu[] = [...nomsInconnus.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([nom, compte]) => {
        const nNorm = normaliserCle(nom);
        const suggestions = tousPrestataires
          .map((p) => ({ id: p.id, nom: p.nom, score: scoreFuzzy(nNorm, normaliserCle(p.nom)) }))
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(({ id, nom: n }) => ({ id, nom: n }));
        return { nom, compte, suggestions };
      });

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
        ...(prestatairesNonTrouves > 0 ? [{ type: "Prestataire sans correspondance", nombre: prestatairesNonTrouves, exemples: prestatairesInconnus.slice(0, 5).map((p) => `${p.nom} (${p.compte} ligne${p.compte > 1 ? "s" : ""})`) }] : []),
        ...(doublons > 0 ? [{ type: "Déjà importée", nombre: doublons, exemples: echDoublons.map((e) => e.ref) }] : []),
      ],
      echantillons: { nonTrouves: echNonTrouves, corriges: echCorriges, doublons: echDoublons },
      prestatairesInconnus,
    };
  }

  async confirmer(planId: string, mappingPrestataires?: Record<string, string>): Promise<BilanPec> {
    const plan = PLANS.get(planId);
    if (!plan || plan.expiresAt < Date.now()) throw new NotFoundException("Plan expiré ou introuvable. Relancez l'aperçu.");
    if (plan.societeId !== TenantContext.getSocieteId()) throw new BadRequestException("Société incohérente.");
    PLANS.delete(planId);
    const societeId = plan.societeId;

    // Appliquer le mapping et créer les alias + auto-créer les prestataires encore inconnus
    if (mappingPrestataires && Object.keys(mappingPrestataires).length > 0) {
      for (const [nomOrigine, prestataireId] of Object.entries(mappingPrestataires)) {
        await this.prisma.prestataireAlias.upsert({
          where: { societeId_nomOrigine: { societeId: societeId ?? "", nomOrigine } },
          create: { nomOrigine, prestataireId, ...(societeId ? { societeId } : {}) },
          update: { prestataireId },
        });
      }
    }
    // Noms encore inconnus après mapping → auto-créer (même comportement que import-libre)
    const nomsAutoCreer = new Set<string>();
    for (const a of plan.lignes) {
      if (!a.prestataireId && !(mappingPrestataires?.[a.prestataireNom])) {
        nomsAutoCreer.add(a.prestataireNom);
      }
    }
    const autoCreated = new Map<string, string>();
    for (const nom of nomsAutoCreer) {
      if (!nom) continue;
      const exist = await this.prisma.prestataire.findFirst({ where: { nom: { equals: nom, mode: "insensitive" } }, select: { id: true } });
      if (exist) {
        autoCreated.set(nom, exist.id);
      } else {
        const type = /pharma/i.test(nom) ? "Pharmacie" : /labo/i.test(nom) ? "Laboratoire" : "Clinique/Hôpital";
        const nouveau = await this.prisma.prestataire.create({
          data: { id: randomUUID(), nom, type, secteur: "Santé", pays: "Gabon", ville: "Libreville", statutConvention: "En négociation" },
          select: { id: true },
        });
        autoCreated.set(nom, nouveau.id);
      }
    }
    // Résoudre chaque ligne non mappée
    for (const a of plan.lignes) {
      if (!a.prestataireId) {
        a.prestataireId = mappingPrestataires?.[a.prestataireNom] ?? autoCreated.get(a.prestataireNom) ?? null;
      }
    }

    // Recalculer les doublons (ré-import concurrent possible)
    const toutesPrescRef = [...new Set(plan.lignes.map((l) => l.prescriptionRef))];
    const refExistantes = new Set<string>(
      (await this.prisma.priseEnCharge.findMany({
        where: { prescriptionRef: { in: toutesPrescRef } },
        select: { prescriptionRef: true },
      })).map((p) => p.prescriptionRef as string),
    );

    const annee = new Date().getFullYear();
    let creesAccords = 0, crees = 0, doublonsIgnores = 0, montantsCorrigés = 0;
    const erreurs: string[] = [];

    // Grouper par N° PEC pour créer un AccordPrealable par dossier
    const parPec = new Map<string, ActionPec[]>();
    for (const a of plan.lignes) {
      const list = parPec.get(a.prescriptionRef) ?? [];
      list.push(a);
      parPec.set(a.prescriptionRef, list);
    }

    const accords: Prisma.AccordPrealableCreateManyInput[] = [];
    const data: Prisma.PriseEnChargeCreateManyInput[] = [];

    for (const [numPec, lignes] of parPec) {
      if (refExistantes.has(numPec)) { doublonsIgnores += lignes.length; continue; }

      const first = lignes[0];
      const accordId = `IMP-${annee}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const montantTotal = lignes.reduce((s, l) => s + l.baseRemboursement, 0);

      // Toutes les PEC importées sont des dossiers déjà accordés dans l'ancien système
      accords.push({
        id: accordId,
        assureId: first.assureId,
        contratId: first.contratId,
        type: first.type,
        description: [...new Set(lignes.map((l) => extrairePlafond(l.acteLibelle).libelle).filter(Boolean))].slice(0, 5).join(", ") || first.type,
        dateDemande: first.date,
        dateDecision: first.date,
        statutAnalyseMedicale: "Validé",
        statutValidationFinanciere: "Validé",
        decision: "Accordé",
        montantAutorise: montantTotal,
        prestataire: first.prestataireNom,
        ...(first.prestataireId ? { prestataireId: first.prestataireId } : {}),
        ...(societeId ? { societeId } : {}),
      });

      for (const a of lignes) {
        if (a.estCorrige) montantsCorrigés++;
        data.push({
          id: `IMP-${annee}-${randomUUID().slice(0, 6).toUpperCase()}`,
          assureId: a.assureId,
          contratId: a.contratId,
          prestataire: a.prestataireNom,
          prestataireId: a.prestataireId ?? undefined,
          accordPrealableId: accordId,
          type: a.type,
          montant: a.fraisReels,
          baseRemboursement: a.baseRemboursement,
          ...(a.taux > 0 ? { tauxRemboursement: a.taux / 100 } : {}),
          ...(a.resteACharge > 0 ? { resteACharge: a.resteACharge } : {}),
          ...(() => {
            const { libelle, plafond } = extrairePlafond(a.acteLibelle);
            return { ...(libelle ? { lettreCleCode: libelle } : {}), ...(plafond ? { plafondApplique: plafond } : {}) };
          })(),
          date: a.date,
          modePaiement: "TiersPayant",
          statut: "Déclaré",
          statutControleMedical: "Validé",
          prescriptionRef: a.prescriptionRef,
          ...(societeId ? { societeId } : {}),
        });
      }
    }

    // Accords préalables d'abord (clé étrangère des PEC)
    for (let i = 0; i < accords.length; i += 500) {
      try {
        const result = await this.prisma.accordPrealable.createMany({ data: accords.slice(i, i + 500), skipDuplicates: true });
        creesAccords += result.count;
      } catch (e) {
        erreurs.push(`Accords lot ${Math.floor(i / 500) + 1} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Puis les lignes de prise en charge
    for (let i = 0; i < data.length; i += 500) {
      try {
        const result = await this.prisma.priseEnCharge.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
        crees += result.count;
      } catch (e) {
        erreurs.push(`PEC lot ${Math.floor(i / 500) + 1} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { crees, creesAccords, doublonsIgnores, montantsCorrigés, erreurs };
  }
}
