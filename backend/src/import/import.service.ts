import { randomUUID } from "crypto";
import * as path from "path";
import ExcelJS from "exceljs";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SanteService } from "../sante/sante.service";
import { FacturesService } from "../factures/factures.service";
import { AccordPrealableService } from "../accord-prealable/accord-prealable.service";
import { PrestatairesService } from "../prestataires/prestataires.service";
import { TYPES_PRESTATION } from "../sante/dto/create-facture-ligne.dto";
import { ImportFactureRowDto } from "./dto/import-facture.dto";
import { ImportReglementRowDto } from "./dto/import-reglement.dto";
import { ImportAccordPrealableRowDto } from "./dto/import-accord-prealable.dto";
import { ImportAssureRowDto } from "./dto/import-assure.dto";
import { normaliserDateImport } from "../lib/date-import.util";
import { texteBrutDeCellule } from "../lib/excel-cell.util";

// Onglet Import (Système) — 2026-08 — voir demande utilisateur : "pour
// permettre aux sociétés d'assurance qui voudraient changer de logiciel
// mais commencer à utiliser MedAssur... importer les factures saisies, les
// règlements qui ont été faits, importer même les photos dans un dossier en
// une fois... les prises en charge." Même patron que ContratsService
// (modèle .xlsx téléchargeable → aperçu dry-run → confirmation), répliqué
// ici pour Factures/Règlements/Prises en charge — RIEN n'est recalculé à
// l'aveugle : chaque import délègue au VRAI service métier déjà utilisé par
// la saisie manuelle (FacturesService, AccordPrealableService), jamais une
// écriture Prisma directe qui court-circuiterait les règles applicatives —
// SAUF les Règlements (BordereauReglement), en-tête seul par nature : voir
// import-reglement.dto.ts pour pourquoi aucun rattachement ligne à ligne
// n'est tenté.
type Rejet = { ligne: number; motif: string };

function parseDateFrImport(value: string): Date | null {
  const [day, month, year] = value.split("/").map(Number);
  return day && month && year ? new Date(year, month - 1, day) : null;
}

function dateDuJourImport(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Le "( … )" de chaque en-tête n'est qu'une indication pour l'utilisateur
// (format attendu, exemple de valeurs) — jamais exigé au caractère près.
// Retiré avant comparaison (2026-08 — voir demande utilisateur : un modèle
// réellement rencontré avait ce texte d'aide légèrement altéré par un
// outil tiers, "EF = Enfant" devenu "EF = EF" — la colonne "Type assuré"
// entière n'était alors plus reconnue). Seul le libellé stable ("Type
// assuré", "Matricule"…) doit correspondre.
function normaliserEntete(s: string): string {
  return s.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim().replace(/\s+/g, " ");
}

// Référence de télétransmission (2026-08) — voir demande utilisateur :
// "je voudrais que toute facture à ce format soit considérée comme
// télétransmise par le prestataire car c'est le cas :
// MS-PRESTA-349bbdea-fb66-433d-bc8b-7c64a9382d0e-20260306133600455". Ce
// format ("MS-PRESTA-" + UUID + horodatage numérique) est généré par le
// système externe du prestataire lors d'une VRAIE télétransmission —
// jamais saisi manuellement (le portail MedAssur génère ses propres
// références via genererReferencePortail, format différent). Une facture
// importée avec cette référence est donc créée directement au statut
// "Soumise" (voir Facture.statut, PortailPrestataireController.
// teletransmettre — même statut que le bouton "Télétransmettre le
// dossier"), jamais "En saisie" par défaut.
const REGEX_REFERENCE_TELETRANSMISE = /^MS-PRESTA-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{10,20}$/i;
function estReferenceTeleTransmise(reference: string): boolean {
  return REGEX_REFERENCE_TELETRANSMISE.test(reference.trim());
}

// Tolérance de format (2026-08 — voir demande utilisateur : "l'application
// doit tenir compte du format des données de l'origine et non rester
// figée sur le format de l'application... lire les données dans n'importe
// quel format"). Un vrai fichier rencontré porte "ACTES AMBULATOIRES" là
// où l'application attend "Ambulatoire" — correspondance par mot-clé
// (chacun contient l'autre une fois normalisé), puis un petit
// dictionnaire de synonymes usuels, puis repli sur "Autre" (déjà une
// vraie valeur de la taxonomie) — jamais un rejet pour un simple écart de
// formulation.
const DIACRITIQUES_IMPORT = /[̀-ͯ]/g;
function normaliserPourComparaison(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(DIACRITIQUES_IMPORT, "").replace(/[^A-Z0-9]/g, "");
}

// Distance de Levenshtein — voir resoudreAssureDuContrat ci-dessous
// (rapprochement tolérant du nom d'un assuré). Implémentation classique en
// O(n·m), largement suffisante pour comparer des noms de quelques dizaines
// de caractères, jamais appelée en boucle sur un gros volume (seulement en
// repli, une fois la correspondance exacte déjà tentée).
function distanceLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}
const SYNONYMES_TYPE_PRESTATION: Record<string, string> = {
  AMBU: "Ambulatoire", HOSPI: "Hospitalisation", DENTAIRE: "Dentisterie", DENT: "Dentisterie",
  KINE: "Kinésithérapie & Cure thermale", MATERNITE: "Maternité",
};
function normaliserTypePrestation(valeur: string): string {
  const norm = normaliserPourComparaison(valeur);
  const exact = TYPES_PRESTATION.find((t) => normaliserPourComparaison(t) === norm);
  if (exact) return exact;
  const parMotCle = TYPES_PRESTATION.find((t) => {
    const tNorm = normaliserPourComparaison(t);
    return norm.includes(tNorm) || tNorm.includes(norm);
  });
  if (parMotCle) return parMotCle;
  for (const [cle, type] of Object.entries(SYNONYMES_TYPE_PRESTATION)) {
    if (norm.includes(cle)) return type;
  }
  return "Autre";
}

// Acte médical FACULTATIF (2026-08 — voir demande utilisateur : "voici le
// fichier d'import de facture avec les données remplies, il faut rendre
// la prestation facultative") — un ancien système n'a pas toujours de
// code d'acte précis par ligne. Une ligne de PriseEnCharge a néanmoins
// TOUJOURS besoin d'un acte ou d'une lettre clé (règle réelle, voir
// SanteService.creerLigneFacture) : repli sur un repère générique du
// catalogue plutôt qu'un rejet — jamais un acte clinique inventé, et le
// montant réel reste TOUJOURS celui de la ligne importée, jamais le tarif
// par défaut de ce repère (voir seed-actes-medicaux.ts).
const LIBELLE_ACTE_NON_DETAILLE = "Prestation non détaillée (reprise d'antériorité)";

// Prestataire introuvable — CRÉÉ plutôt que bloqué (2026-08 — voir demande
// utilisateur : "Centre diagnostic de Libreville = Polyclinique centre
// diagnostic. Pour les autres prestataires, il faut les créer et rendre
// possible l'import des données"). Deux mécanismes complémentaires (voir
// resoudrePrestataire ci-dessous) :
//  1. Alias déclaré (PrestataireAlias) — un nom d'origine qui désigne en
//     réalité un prestataire DÉJÀ réel sous un autre nom ("Centre
//     diagnostic de Libreville" = PRS-027 "Polyclinique centre
//     diagnostic") — jamais détectable par une simple comparaison de nom.
//  2. Auto-création — pour tout le reste, un VRAI nouveau Prestataire est
//     créé (via PrestatairesService.create, même moteur que la saisie
//     manuelle), avec un type/secteur devinés du mieux possible à partir
//     du nom (ville "Libreville" et statut "En négociation" par défaut —
//     à corriger ensuite via l'écran Prestataires si besoin, jamais
//     présenté comme une fiche définitive).
function deviverTypePrestataire(nom: string): string {
  const n = nom.toUpperCase();
  if (n.includes("DEPOT PHARMA") || n.includes("DÉPÔT PHARMA")) return "Dépôt pharmaceutique";
  if (n.includes("PHARMAC")) return "Pharmacie";
  if (n.includes("LABORATOIRE") || n.includes("LABO ")) return "Laboratoire";
  if (n.includes("DENTAIRE")) return "Cabinet Dentaire";
  if (n.includes("IMAGERIE") || n.includes("SCANNER") || n.includes("RADIOLOGIE")) return "Centre d'Imagerie";
  if (n.includes("KINE") || n.includes("KINÉ")) return "Centre de Kinésithérapie";
  if (n.includes("OPTIC") || n.includes("OPTIQUE") || n.includes("VISION")) return "Opticien";
  if (n.includes("HOPITAL") || n.includes("HÔPITAL") || n.includes("CENTRE HOSPITALIER")) return "Hôpital";
  if (n.includes("CLINIQUE")) return "Clinique";
  if (n.includes("CABINET")) return "Cabinet";
  return "Cabinet"; // repli le plus neutre — jamais un établissement lourd présumé à tort
}
function deviverSecteurPrestataire(nom: string): string {
  const n = nom.toUpperCase();
  if (n.includes("CENTRE HOSPITALIER UNIVERSITAIRE") || n.includes("HOPITAL D'INSTRUCTION") || n.includes("ARMEE") || n.includes("ARMÉE")) return "Public";
  return "Privé"; // la grande majorité des cliniques/cabinets/pharmacies du Gabon
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private sante: SanteService,
    private factures: FacturesService,
    private accordPrealable: AccordPrealableService,
    private prestataires: PrestatairesService,
  ) {}

  // ── Résolutions partagées ────────────────────────────────────────────
  // Scopée à UN contrat (2026-08 — voir demande utilisateur : "rendre
  // l'import des factures et des prises en charge possible pour un
  // contrat... les factures doivent s'importer par numéro matricule ou le
  // nom de l'assuré ou l'ayant droit... l'application doit chercher la
  // correspondance exacte du nom dans la population du contrat"). Le
  // matricule est tenté en premier (le plus précis) ; si absent ou
  // introuvable DANS CE CONTRAT, repli sur une correspondance EXACTE
  // nom(+prénom) — jamais une recherche floue, et jamais hors de la
  // population de ce contrat (jamais globale sur toute la base, à la
  // différence de l'ancien resoudreAssureParMatricule).
  private async resoudreAssureDuContrat(contratId: string, identite: { matricule?: string; nom?: string; prenom?: string }) {
    if (identite.matricule) {
      const trouves = await this.prisma.assureSante.findMany({
        where: { contratId, matricule: { equals: identite.matricule.trim(), mode: "insensitive" } },
      });
      if (trouves.length === 1) return { ok: true as const, assure: trouves[0] };
      if (trouves.length > 1) return { ok: false as const, erreur: `Plusieurs assurés de ce contrat partagent le matricule "${identite.matricule}" — corrigez les données avant import.` };
    }
    if (identite.nom) {
      const trouves = await this.prisma.assureSante.findMany({
        where: {
          contratId,
          nom: { equals: identite.nom.trim(), mode: "insensitive" },
          ...(identite.prenom ? { prenom: { equals: identite.prenom.trim(), mode: "insensitive" } } : {}),
        },
      });
      if (trouves.length === 1) return { ok: true as const, assure: trouves[0] };
      if (trouves.length > 1) {
        return { ok: false as const, erreur: `Plusieurs assurés de ce contrat portent le nom "${identite.nom}${identite.prenom ? " " + identite.prenom : ""}" — précisez le matricule ou le prénom pour lever l'ambiguïté.` };
      }
      // Repli tolérant (2026-09 — voir demande utilisateur : "fait une
      // correspondance de nom lors de l'import de facture pour ne perdre
      // aucune donnée") — aucune correspondance EXACTE, mais une simple
      // variante orthographique (apostrophe/espace/accent, ou une lettre
      // en trop/en moins) ne doit pas faire perdre la ligne. Normalise
      // (voir normaliserPourComparaison) puis tolère une petite distance
      // de Levenshtein — n'accepte QUE s'il y a UN SEUL candidat plausible
      // dans toute la population du contrat ; plusieurs candidats ⇒
      // ambiguïté explicite plutôt qu'un rattachement au hasard.
      const nomCible = normaliserPourComparaison(identite.nom);
      const prenomCible = identite.prenom ? normaliserPourComparaison(identite.prenom) : null;
      const population = await this.prisma.assureSante.findMany({ where: { contratId } });
      const toleranceNom = nomCible.length <= 4 ? 1 : nomCible.length <= 10 ? 2 : 3;
      const candidats = population.filter((a) => {
        const nomA = normaliserPourComparaison(a.nom);
        if (distanceLevenshtein(nomCible, nomA) > toleranceNom) return false;
        if (!prenomCible) return true;
        const prenomA = normaliserPourComparaison(a.prenom ?? "");
        if (!prenomA) return false;
        const tolerancePrenom = prenomCible.length <= 4 ? 1 : prenomCible.length <= 10 ? 2 : 3;
        return prenomA === prenomCible || prenomA.includes(prenomCible) || prenomCible.includes(prenomA) || distanceLevenshtein(prenomCible, prenomA) <= tolerancePrenom;
      });
      if (candidats.length === 1) return { ok: true as const, assure: candidats[0] };
      if (candidats.length > 1) {
        return { ok: false as const, erreur: `Plusieurs assurés de ce contrat portent un nom proche de "${identite.nom}${identite.prenom ? " " + identite.prenom : ""}" — précisez le matricule ou le prénom pour lever l'ambiguïté.` };
      }
    }
    const repere = identite.matricule ? `matricule "${identite.matricule}"` : identite.nom ? `nom "${identite.nom}${identite.prenom ? " " + identite.prenom : ""}"` : "identité manquante";
    return { ok: false as const, erreur: `Aucun assuré ne correspond à ce ${repere} dans la population de ce contrat.` };
  }

  // Résolution GLOBALE par matricule (2026-08) — seule utilisée par l'import
  // Photos, qui n'a pas de notion de contrat (un dossier entier de photos,
  // chaque fichier apparié par son nom = matricule, quel que soit le
  // contrat de la personne). Factures/Prises en charge, eux, passent
  // désormais par resoudreAssureDuContrat ci-dessus, scopée à UN contrat.
  private async resoudreAssureParMatriculeGlobal(matricule: string) {
    const trouves = await this.prisma.assureSante.findMany({ where: { matricule: { equals: matricule.trim(), mode: "insensitive" } } });
    if (trouves.length === 0) return { ok: false as const, erreur: `Assuré introuvable pour le matricule "${matricule}".` };
    if (trouves.length > 1) return { ok: false as const, erreur: `Plusieurs assurés partagent le matricule "${matricule}" — corrigez les données avant import.` };
    return { ok: true as const, assure: trouves[0] };
  }

  // Réservée aux chemins de CONFIRMATION (jamais l'aperçu, qui ne doit rien
  // écrire) — voir deviverTypePrestataire ci-dessus pour le détail des deux
  // mécanismes (alias déclaré, puis auto-création).
  private async resoudrePrestataire(valeur: string) {
    const alias = await this.prisma.prestataireAlias.findFirst({ where: { nomOrigine: { equals: valeur.trim(), mode: "insensitive" } }, include: { prestataire: true } });
    if (alias) return alias.prestataire;
    const direct = await this.prisma.prestataire.findFirst({ where: { OR: [{ id: valeur }, { nom: { equals: valeur.trim(), mode: "insensitive" } }] } });
    if (direct) return direct;
    return this.prestataires.create({
      nom: valeur.trim(), type: deviverTypePrestataire(valeur), secteur: deviverSecteurPrestataire(valeur),
      pays: "Gabon", ville: "Libreville", statutConvention: "En négociation",
    });
  }

  // Même résolution que resoudrePrestataire, mais en LECTURE SEULE — jamais
  // d'auto-création (utilisée à l'APERÇU pour la détection de doublon
  // ci-dessous, qui ne doit rien écrire). Un prestataire pas encore connu
  // signifie qu'aucune ligne n'a jamais pu être importée sous son nom —
  // donc rien à détecter comme doublon, `null` est le bon résultat.
  private async resoudrePrestataireLectureSeule(valeur: string) {
    const alias = await this.prisma.prestataireAlias.findFirst({ where: { nomOrigine: { equals: valeur.trim(), mode: "insensitive" } }, include: { prestataire: true } });
    if (alias) return alias.prestataire;
    return this.prisma.prestataire.findFirst({ where: { OR: [{ id: valeur }, { nom: { equals: valeur.trim(), mode: "insensitive" } }] } });
  }

  // Détection de ré-import (2026-09 — voir demande utilisateur : "si
  // import à nouveau des factures en utilisant un fichier qui avait déjà
  // des lignes importées, que l'application sache ignorer les lignes
  // importées et n'ajoute que celles qui n'existent pas encore"). Une
  // ligne est considérée déjà importée quand une PriseEnCharge existe déjà
  // pour EXACTEMENT le même (prestataire, référence facture, assuré, date
  // de prestation, type de prestation, montant) — volontairement SANS
  // l'acte médical (souvent résolu de façon approximative/générique en
  // reprise d'antériorité, voir LIBELLE_ACTE_NON_DETAILLE — l'exiger
  // identique laisserait passer un vrai doublon si le mapping d'acte a
  // changé d'une tentative d'import à l'autre).
  private async ligneFactureExisteDeja(
    prestataireId: string, referenceFacture: string, assureId: string, datePrestation: string, typePrestation: string, montant: number,
  ): Promise<boolean> {
    const existante = await this.prisma.priseEnCharge.findFirst({
      where: {
        assureId, date: datePrestation, type: typePrestation, montant,
        facture: { prestataireId, referenceFacture },
      },
      select: { id: true },
    });
    return !!existante;
  }

  // Même résolution que resoudrePrestataire ci-dessus, mais EN LOTS — pour
  // les chemins gros volume (importerFacturesGlobal/
  // synchroniserFacturesEnAttente, voir demande utilisateur : "gérer de
  // façon optimum plus de 50000 lignes en une fois") : une seule requête
  // "direct" + une seule requête "alias" pour TOUTES les valeurs distinctes,
  // puis une auto-création par valeur encore non résolue (jamais par
  // ligne — le nombre de prestataires réellement nouveaux dans un fichier
  // reste modeste même quand le fichier fait 50000 lignes).
  private async resoudrePrestatairesEnLot(valeurs: string[]): Promise<Map<string, { id: string; nom: string }>> {
    const distinctes = [...new Set(valeurs.map((v) => v.trim()).filter(Boolean))];
    const resultat = new Map<string, { id: string; nom: string }>();
    if (distinctes.length === 0) return resultat;

    const alias = await this.prisma.prestataireAlias.findMany({
      where: { nomOrigine: { in: distinctes, mode: "insensitive" } },
      include: { prestataire: true },
    });
    const directs = await this.prisma.prestataire.findMany({ where: { OR: [{ id: { in: distinctes } }, { nom: { in: distinctes, mode: "insensitive" } }] } });
    const restantes: string[] = [];
    for (const val of distinctes) {
      const aliasTrouve = alias.find((a) => a.nomOrigine.toLowerCase() === val.toLowerCase());
      const direct = directs.find((p) => p.id === val || p.nom.toLowerCase() === val.toLowerCase());
      if (aliasTrouve) resultat.set(val, aliasTrouve.prestataire);
      else if (direct) resultat.set(val, direct);
      else restantes.push(val);
    }
    if (restantes.length === 0) return resultat;

    // Auto-création — voir resoudrePrestataire ci-dessus pour le même
    // principe. Une erreur sur UNE valeur (ex. type/secteur devinés
    // invalides) ne doit pas faire échouer les autres.
    for (const val of restantes) {
      try {
        const cree = await this.prestataires.create({
          nom: val, type: deviverTypePrestataire(val), secteur: deviverSecteurPrestataire(val),
          pays: "Gabon", ville: "Libreville", statutConvention: "En négociation",
        });
        resultat.set(val, cree);
      } catch {
        // Laissé absent de `resultat` — le point d'appel traite ça comme
        // "prestataire introuvable", un rejet par ligne concernée plutôt
        // qu'un échec de tout le lot.
      }
    }
    return resultat;
  }

  // Repère générique (voir LIBELLE_ACTE_NON_DETAILLE ci-dessus) — mis en
  // cache le temps d'un import, jamais requêté par ligne.
  private acteGeneriqueCache: { id: string } | null | undefined;
  private async acteGenerique(): Promise<{ id: string } | null> {
    if (this.acteGeneriqueCache === undefined) {
      this.acteGeneriqueCache = await this.prisma.acteMedical.findFirst({ where: { libelle: LIBELLE_ACTE_NON_DETAILLE }, select: { id: true } });
    }
    return this.acteGeneriqueCache;
  }

  // Résout un acte par libellé, avec repli sur le repère générique — pour
  // les chemins qui traitent une ligne à la fois (import scopé à un
  // contrat, volume modeste). Le mode global utilise sa propre résolution
  // EN LOTS (voir importerFacturesGlobal) pour rester performant.
  private async resoudreActe(libelle?: string): Promise<{ id: string } | null> {
    if (libelle) {
      const trouve = await this.prisma.acteMedical.findFirst({ where: { libelle: { equals: libelle.trim(), mode: "insensitive" } }, select: { id: true } });
      if (trouve) return trouve;
    }
    return this.acteGenerique();
  }

  // `lignes` : plusieurs rangées de départ possibles (2026-08 — voir
  // demande utilisateur : le modèle Factures/Prises en charge se génère
  // désormais PRÉ-REMPLI avec la population réelle du contrat choisi,
  // matricule/nom/prénom déjà servis, plutôt qu'une seule ligne d'exemple
  // générique). `colonnesNumeriques` est une liste EXPLICITE de clés
  // (jamais déduite du contenu d'une ligne d'exemple, qui peut être vide
  // pour ces colonnes-là dans le cas d'un pré-remplissage population).
  private genererClasseur(
    feuilleNom: string,
    colonnes: { header: string; key: string; width?: number }[],
    lignes: Record<string, string | number>[],
    colonnesNumeriques: string[] = [],
  ) {
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet(feuilleNom);
    feuille.columns = colonnes.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 26 }));
    feuille.getRow(1).font = { bold: true };
    for (const ligne of lignes) feuille.addRow(ligne);
    // Colonnes numériques (2026-08) — voir demande utilisateur : "il faut
    // que les montants et les quantités soient des nombres et non des
    // textes" — sur TOUTE la colonne, pas seulement les lignes déjà
    // servies, pour que celles ajoutées ensuite héritent aussi d'un vrai
    // type numérique dans le tableur.
    for (const cle of colonnesNumeriques) feuille.getColumn(cle).numFmt = "#,##0";
    return classeur.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
  }

  private async chargerFeuille(buffer: Buffer, colonnes: { header: string; key: string }[], colonnesObligatoires: string[]) {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const feuille = classeur.worksheets[0];
    if (!feuille) throw new BadRequestException("Fichier illisible ou vide.");
    const indexParCle = new Map<string, number>();
    feuille.getRow(1).eachCell((cell, colNumber) => {
      const norm = normaliserEntete(String(cell.value ?? ""));
      const colonne = colonnes.find((c) => normaliserEntete(c.header) === norm);
      if (colonne) indexParCle.set(colonne.key, colNumber);
    });
    const manquantes = colonnesObligatoires.filter((k) => !indexParCle.has(k));
    if (manquantes.length > 0) {
      throw new BadRequestException(`Colonne(s) introuvable(s) : ${manquantes.join(", ")} — utilisez le modèle téléchargeable.`);
    }
    return { feuille, indexParCle };
  }

  // Colonne "date…" (2026-08 — voir demande utilisateur) : les anciens
  // systèmes exportent parfois leurs dates au format Date.toString()
  // ("Wed Jul 15 00:00:00 UTC 2026") plutôt que JJ/MM/AAAA — traduit
  // systématiquement pour TOUTE colonne dont la clé commence par "date"
  // (dateReception, datePrestation, dateDemande, dateDecision,
  // datePaiement, dateNaissance…), quelle que soit la rubrique d'import.
  private lireValeur(feuille: ExcelJS.Worksheet, indexParCle: Map<string, number>, r: number, cle: string): string | undefined {
    const idx = indexParCle.get(cle);
    if (!idx) return undefined;
    const v = feuille.getRow(r).getCell(idx).value;
    if (v === null || v === undefined) return undefined;
    const estDate = cle.toLowerCase().startsWith("date");
    if (estDate && v instanceof Date) return normaliserDateImport(v);
    const brut = texteBrutDeCellule(v);
    return estDate ? normaliserDateImport(brut) : brut;
  }

  // ══════════════════════════════════════════════════════════════════
  // FACTURES — voir import-facture.dto.ts
  // ══════════════════════════════════════════════════════════════════
  private readonly COLONNES_FACTURE = [
    { header: "Matricule assuré (si connu)", key: "matricule" },
    { header: "Nom de l'assuré/ayant droit (si matricule inconnu)", key: "nom" },
    { header: "Prénom (facultatif — précise le nom en cas d'homonymie)", key: "prenom" },
    { header: "Prestataire (nom exact ou id)", key: "prestataire" },
    { header: "Référence facture", key: "referenceFacture" },
    { header: "Date de réception (JJ/MM/AAAA)", key: "dateReception" },
    { header: `Type de prestation (${TYPES_PRESTATION.join(", ")})`, key: "typePrestation" },
    { header: "Date de la prestation (JJ/MM/AAAA)", key: "datePrestation" },
    { header: "Acte médical (facultatif — libellé du catalogue, texte libre toléré)", key: "acteMedical" },
    { header: "Montant (FCFA)", key: "montant" },
    { header: "Quantité (facultatif, défaut 1)", key: "quantite" },
    { header: "Statut (Accepté ou Rejeté, défaut Accepté)", key: "statut" },
    { header: "Motif de rejet (si Rejeté)", key: "motifRejet" },
  ];
  private readonly COLONNES_NUMERIQUES_FACTURE = ["montant", "quantite"];

  // Création des Factures/lignes depuis des lignes DÉJÀ résolues (assuré,
  // prestataire, acte médical identifiés) — partagée par l'import scopé à
  // un contrat, l'import global "tous contrats confondus" et la
  // synchronisation de la file d'attente, pour ne jamais dupliquer cette
  // logique. RIEN de recalculé à l'aveugle : chaque ligne passe par le VRAI
  // moteur métier (FacturesService.create/ajouterLigne), jamais une
  // écriture Prisma directe. Les en-têtes (un par groupe prestataire+
  // référence) sont créés séquentiellement — leur nombre est très
  // inférieur au nombre de lignes — puis les lignes par LOTS de taille
  // limitée (2026-08 — voir demande utilisateur : "gérer de façon optimum
  // plus de 50000 lignes en une fois") : jamais 50 000 requêtes
  // simultanées, qui épuiseraient le pool de connexions Postgres.
  private async creerFacturesDepuisLignesResolues(
    lignes: {
      ligne: number; contratId: string; assureId: string; prestataireId: string; referenceFacture: string;
      dateReception: string; typePrestation: string; datePrestation: string; acteMedicalId: string;
      montant: number; quantite?: number; statut?: string; motifRejet?: string;
    }[],
    rejets: Rejet[],
    concurrence = 25,
  ): Promise<number> {
    let crees = 0;
    const facturesParGroupe = new Map<string, string>(); // "prestataireId|referenceFacture" -> factureId
    const groupesEnErreur = new Set<string>();

    for (const l of lignes) {
      const cleGroupe = `${l.prestataireId}|${l.referenceFacture}`;
      if (facturesParGroupe.has(cleGroupe) || groupesEnErreur.has(cleGroupe)) continue;
      try {
        const facture = await this.factures.create({ prestataireId: l.prestataireId, contratId: l.contratId, dateReception: l.dateReception, referenceFacture: l.referenceFacture });
        facturesParGroupe.set(cleGroupe, facture.id);
        // Référence de télétransmission (voir estReferenceTeleTransmise
        // ci-dessus) — jamais "En saisie" par défaut pour ces dossiers-là.
        if (estReferenceTeleTransmise(l.referenceFacture)) {
          await this.factures.update(facture.id, { statut: "Soumise" });
        }
      } catch {
        groupesEnErreur.add(cleGroupe);
      }
    }

    for (let i = 0; i < lignes.length; i += concurrence) {
      const lot = lignes.slice(i, i + concurrence);
      const resultats = await Promise.allSettled(lot.map(async (l) => {
        const cleGroupe = `${l.prestataireId}|${l.referenceFacture}`;
        const factureId = facturesParGroupe.get(cleGroupe);
        if (!factureId) throw new Error("Impossible de créer l'en-tête de facture pour cette référence.");
        const statutInitial = l.statut === "Rejeté" ? "Rejeté" : undefined;
        if (statutInitial === "Rejeté" && !l.motifRejet) throw new Error("Motif de rejet obligatoire pour une ligne Rejetée.");
        await this.factures.ajouterLigne(factureId, {
          assureId: l.assureId, typePrestation: l.typePrestation, datePrestation: l.datePrestation,
          acteMedicalId: l.acteMedicalId, montant: l.montant, quantite: l.quantite,
          statutInitial, motifRejet: l.motifRejet,
        }, {
          ignorerDoublonMemeJour: true, exigerAffection: false,
          // Reprise d'antériorité (2026-09 — voir demande utilisateur : "le
          // montant qui remonte est le résultat après le calcul des
          // parts... c'est déjà le net à payer") — voir SanteService.
          // creerLigneCommune pour le détail : jamais recalculé depuis les
          // taux du contrat, qui ne sont d'ailleurs pas toujours renseignés
          // sur un contrat repris.
          baseRemboursementImpose: statutInitial === "Rejeté" ? 0 : l.montant,
        });
      }));
      resultats.forEach((res, idx) => {
        if (res.status === "fulfilled") crees++;
        else rejets.push({ ligne: lot[idx].ligne, motif: res.reason instanceof Error ? res.reason.message : "Erreur inattendue lors de la création de la ligne." });
      });
    }
    return crees;
  }

  // Modèle simple (2026-08 — voir demande utilisateur : "ce n'est pas ce
  // que je demande pour le modèle... le fichier doit juste être lié au
  // contrat, pas rempli avec toute la population" — précisé ensuite : "on
  // doit renseigner soit le nom ou le matricule, pas les deux"). Le fichier
  // en lui-même reste léger (deux lignes d'exemple, PAS un export de toute
  // la population) ; c'est l'IMPORT (aperçu/confirmation, voir
  // parseFactures/importerFactures) qui est rattaché au contrat choisi —
  // matricule/nom y sont résolus dans SA population uniquement. Les deux
  // exemples illustrent chacune des deux voies alternatives : la première
  // ligne identifie par matricule (nom vide), la seconde par nom (matricule
  // vide) — jamais les deux renseignés sur une même ligne.
  genererModeleFactures(): Promise<Buffer> {
    return this.genererClasseur("Factures", this.COLONNES_FACTURE, [
      {
        matricule: "EXEMPLE-000001", nom: "", prenom: "", prestataire: "CHU Libreville", referenceFacture: "FAC-2025-000123",
        dateReception: "15/01/2025", typePrestation: "Ambulatoire", datePrestation: "10/01/2025",
        acteMedical: "CS Généraliste", montant: 15000, quantite: 1, statut: "Accepté", motifRejet: "",
      },
      {
        matricule: "", nom: "EXEMPLE", prenom: "Ayant Droit", prestataire: "CHU Libreville", referenceFacture: "FAC-2025-000124",
        dateReception: "15/01/2025", typePrestation: "Ambulatoire", datePrestation: "10/01/2025",
        acteMedical: "CS Généraliste", montant: 15000, quantite: 1, statut: "Accepté", motifRejet: "",
      },
    ], this.COLONNES_NUMERIQUES_FACTURE);
  }

  async parseFactures(buffer: Buffer, contratId: string): Promise<{ lignes: ImportFactureRowDto[]; rejets: Rejet[] }> {
    const { feuille, indexParCle } = await this.chargerFeuille(buffer, this.COLONNES_FACTURE, ["prestataire", "referenceFacture", "dateReception", "typePrestation", "datePrestation", "montant"]);
    const lignes: ImportFactureRowDto[] = [];
    const rejets: Rejet[] = [];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const v = (cle: string) => this.lireValeur(feuille, indexParCle, r, cle);
      const matricule = v("matricule");
      const nom = v("nom");
      if (!matricule && !nom && !v("prestataire") && !v("montant")) continue; // ligne vide
      const prestataire = v("prestataire");
      const referenceFacture = v("referenceFacture");
      const dateReception = v("dateReception");
      const typePrestationBrut = v("typePrestation");
      const datePrestation = v("datePrestation");
      const acteMedical = v("acteMedical"); // facultatif — voir LIBELLE_ACTE_NON_DETAILLE
      const montant = v("montant");
      if (!matricule && !nom) { rejets.push({ ligne: r, motif: "Matricule ou nom de l'assuré obligatoire." }); continue; }
      if (!prestataire || !referenceFacture || !dateReception || !typePrestationBrut || !datePrestation || !montant) {
        rejets.push({ ligne: r, motif: "Prestataire, référence facture, date de réception, type de prestation, date de prestation et montant sont obligatoires." });
        continue;
      }
      const datePrestationParsed = normaliserDateImport(datePrestation) ?? datePrestation;
      const datePrestationDate = parseDateFrImport(datePrestationParsed);
      if (datePrestationDate && datePrestationDate > dateDuJourImport()) {
        rejets.push({ ligne: r, motif: `Date de prestation future (${datePrestationParsed}) — seules les prestations du jour ou passées sont importables.` });
        continue;
      }
      try {
        const typePrestation = normaliserTypePrestation(typePrestationBrut);
        const resAssure = await this.resoudreAssureDuContrat(contratId, { matricule, nom, prenom: v("prenom") });
        if (!resAssure.ok) { rejets.push({ ligne: r, motif: resAssure.erreur }); continue; }
        // Prestataire jamais vérifié ici (voir demande utilisateur : "pour
        // les autres prestataires, il faut les créer et rendre possible
        // l'import des données") — l'aperçu ne doit rien créer ; un
        // prestataire introuvable sera de toute façon créé à la
        // confirmation (voir resoudrePrestataire), jamais un rejet.
        // Ré-import du même fichier (2026-09 — voir demande utilisateur : "si
        // import à nouveau des factures... ignorer les lignes déjà importées
        // et n'ajoute que celles qui n'existent pas encore") — en LECTURE
        // SEULE (voir resoudrePrestataireLectureSeule) : un prestataire
        // encore inconnu ne peut, par construction, avoir aucune ligne
        // existante à comparer.
        const prestataireExistant = await this.resoudrePrestataireLectureSeule(prestataire);
        if (prestataireExistant) {
          const datePrestationNorm = datePrestationParsed;
          const dejaImportee = await this.ligneFactureExisteDeja(prestataireExistant.id, referenceFacture, resAssure.assure.id, datePrestationNorm, typePrestation, Number(montant));
          if (dejaImportee) {
            rejets.push({ ligne: r, motif: `Déjà importée — une ligne identique existe pour ${resAssure.assure.nom} ${resAssure.assure.prenom ?? ""} chez "${prestataire}" (facture ${referenceFacture}, ${datePrestationNorm}, ${montant} FCFA). Ignorée automatiquement.` });
            continue;
          }
        }
        lignes.push({
          matricule, nom, prenom: v("prenom"), prestataire, referenceFacture, dateReception, typePrestation, datePrestation: datePrestationParsed,
          acteMedical, montant, quantite: v("quantite"), statut: v("statut"), motifRejet: v("motifRejet"),
        });
      } catch (err) {
        console.error(`Erreur pendant l'aperçu de la ligne ${r} de l'import de factures`, err);
        rejets.push({ ligne: r, motif: "Impossible de traiter cette ligne. Vérifiez le contrat et les données de la ligne." });
      }
    }
    return { lignes, rejets };
  }

  // Regroupe les lignes du même (prestataire + référence facture) sous UNE
  // Facture (en-tête) — comme la saisie manuelle. `contratId` dérivé de
  // l'assuré de la PREMIÈRE ligne du groupe (une facture est rattachée à UN
  // contrat, voir schema.prisma Facture) ; une ligne suivante du même
  // groupe dont l'assuré serait sur un AUTRE contrat est rejetée plutôt que
  // silencieusement rattachée au mauvais contrat.
  async importerFactures(contratId: string, rows: ImportFactureRowDto[]): Promise<{ crees: number; rejets: Rejet[] }> {
    let crees = 0;
    const rejets: Rejet[] = [];
    const facturesParGroupe = new Map<string, string>(); // "prestataireId|referenceFacture" -> factureId

    for (let i = 0; i < rows.length; i++) {
      const ligne = rows[i];
      const resAssure = await this.resoudreAssureDuContrat(contratId, { matricule: ligne.matricule, nom: ligne.nom, prenom: ligne.prenom });
      if (!resAssure.ok) { rejets.push({ ligne: i + 1, motif: resAssure.erreur }); continue; }
      // Auto-création possible (voir resoudrePrestataire) — peut lever une
      // erreur (ex. type/secteur devinés invalides), jamais laissée
      // remonter et faire échouer tout le lot.
      let prestataireRow: Awaited<ReturnType<typeof this.resoudrePrestataire>>;
      try {
        prestataireRow = await this.resoudrePrestataire(ligne.prestataire);
      } catch (err) {
        rejets.push({ ligne: i + 1, motif: err instanceof Error ? err.message : `Impossible de créer le prestataire "${ligne.prestataire}".` });
        continue;
      }

      // Re-normalisées ici aussi (pas seulement à l'aperçu) — un appel
      // direct à /import/factures avec des dates encore au format
      // Date.toString() reste correctement traduit.
      const dateReception = normaliserDateImport(ligne.dateReception) ?? ligne.dateReception;
      const datePrestation = normaliserDateImport(ligne.datePrestation) ?? ligne.datePrestation;

      // Ré-import du même fichier (2026-09, défense en profondeur — voir
      // parseFactures ci-dessus pour le même contrôle à l'aperçu) : refait
      // ICI aussi, au cas où confirmer serait appelé directement (API) sans
      // repasser par un aperçu frais, ou si des lignes ont été importées
      // entre-temps par ailleurs. Avant toute création d'en-tête — pour ne
      // jamais laisser une Facture vide si TOUTES ses lignes sont déjà
      // connues.
      const montantVerif = Number(ligne.montant);
      if (Number.isFinite(montantVerif) && await this.ligneFactureExisteDeja(prestataireRow.id, ligne.referenceFacture, resAssure.assure.id, datePrestation, ligne.typePrestation, montantVerif)) {
        rejets.push({ ligne: i + 1, motif: `Déjà importée — une ligne identique existe pour ${resAssure.assure.nom} ${resAssure.assure.prenom ?? ""} chez "${prestataireRow.nom}" (facture ${ligne.referenceFacture}, ${datePrestation}, ${ligne.montant} FCFA). Ignorée automatiquement.` });
        continue;
      }

      const cleGroupe = `${prestataireRow.id}|${ligne.referenceFacture}`;
      let factureId = facturesParGroupe.get(cleGroupe);
      if (!factureId) {
        try {
          const facture = await this.factures.create({
            prestataireId: prestataireRow.id, contratId: resAssure.assure.contratId,
            dateReception, referenceFacture: ligne.referenceFacture,
          });
          factureId = facture.id;
          facturesParGroupe.set(cleGroupe, factureId);
          // Référence de télétransmission (voir estReferenceTeleTransmise)
          // — jamais "En saisie" par défaut pour ces dossiers-là.
          if (estReferenceTeleTransmise(ligne.referenceFacture)) {
            await this.factures.update(factureId, { statut: "Soumise" });
          }
        } catch {
          rejets.push({ ligne: i + 1, motif: "Impossible de créer l'en-tête de facture pour cette référence." });
          continue;
        }
      }

      const montant = Number(ligne.montant);
      if (!Number.isFinite(montant) || montant < 0) { rejets.push({ ligne: i + 1, motif: `Montant "${ligne.montant}" invalide.` }); continue; }
      // Acte facultatif (voir resoudreActe/LIBELLE_ACTE_NON_DETAILLE) —
      // repli sur le repère générique plutôt qu'un rejet.
      const acte = await this.resoudreActe(ligne.acteMedical);
      if (!acte) { rejets.push({ ligne: i + 1, motif: "Aucun acte médical catalogué disponible." }); continue; }
      const statutInitial = ligne.statut === "Rejeté" ? "Rejeté" : undefined;
      if (statutInitial === "Rejeté" && !ligne.motifRejet) { rejets.push({ ligne: i + 1, motif: "Motif de rejet obligatoire pour une ligne Rejetée." }); continue; }

      try {
        await this.factures.ajouterLigne(factureId, {
          assureId: resAssure.assure.id, typePrestation: normaliserTypePrestation(ligne.typePrestation), datePrestation,
          acteMedicalId: acte.id, montant, quantite: ligne.quantite ? Number(ligne.quantite) : undefined,
          statutInitial, motifRejet: ligne.motifRejet,
        }, {
          ignorerDoublonMemeJour: true, exigerAffection: false,
          // Reprise d'antériorité — voir creerFacturesDepuisLignesResolues
          // ci-dessous pour le détail (même règle, même demande
          // utilisateur : "le montant qui remonte... c'est déjà le net à
          // payer").
          baseRemboursementImpose: statutInitial === "Rejeté" ? 0 : montant,
        });
        crees++;
      } catch (err) {
        rejets.push({ ligne: i + 1, motif: err instanceof Error ? err.message : "Erreur inattendue lors de la création de la ligne." });
      }
    }
    return { crees, rejets };
  }

  // ══════════════════════════════════════════════════════════════════
  // FACTURES — IMPORT GLOBAL "TOUS CONTRATS CONFONDUS" (2026-08) — voir
  // demande utilisateur : "il faut aussi une option de fichier d'import de
  // tous les contrats confondus. Dans celui-ci il faut juste faire
  // remonter le numéro matricule et l'application fera un matching avec
  // les matricules de la population globale de tous les contrats... [les]
  // factures des matricules trouvés [sont créées], mettre les autres en
  // attente que les bonnes populations soient chargées... l'application
  // devra systématiquement synchroniser... gérer de façon optimum plus de
  // 50000 lignes en une fois." Contrairement à l'import scopé à un
  // contrat : matricule SEUL (jamais de repli par nom — trop ambigu sans
  // le périmètre d'un contrat), résolution EN LOTS (une poignée de
  // requêtes au total, jamais une par ligne), et PAS d'aperçu ligne à
  // ligne — un tableau de 50 000 lignes gèlerait le navigateur : upload
  // direct, résultat en résumé (créées / mises en attente / rejetées).
  // ══════════════════════════════════════════════════════════════════
  private readonly COLONNES_FACTURE_GLOBALE = [
    { header: "Matricule assuré", key: "matricule" },
    { header: "Numéro de police compagnie (facultatif)", key: "numeroPolice" },
    { header: "Prestataire (nom exact ou id)", key: "prestataire" },
    { header: "Référence facture", key: "referenceFacture" },
    { header: "Date de réception (JJ/MM/AAAA)", key: "dateReception" },
    { header: `Type de prestation (${TYPES_PRESTATION.join(", ")})`, key: "typePrestation" },
    { header: "Date de la prestation (JJ/MM/AAAA)", key: "datePrestation" },
    { header: "Acte médical (facultatif — libellé du catalogue, texte libre toléré)", key: "acteMedical" },
    { header: "Montant (FCFA)", key: "montant" },
    { header: "Quantité (facultatif, défaut 1)", key: "quantite" },
    { header: "Statut (Accepté ou Rejeté, défaut Accepté)", key: "statut" },
    { header: "Motif de rejet (si Rejeté)", key: "motifRejet" },
  ];
  private readonly COLONNES_NUMERIQUES_FACTURE_GLOBALE = ["montant", "quantite"];

  genererModeleFacturesGlobal(): Promise<Buffer> {
    return this.genererClasseur("Factures", this.COLONNES_FACTURE_GLOBALE, [{
      matricule: "EXEMPLE-000001", prestataire: "CHU Libreville", referenceFacture: "FAC-2025-000123",
      dateReception: "15/01/2025", typePrestation: "Ambulatoire", datePrestation: "10/01/2025",
      acteMedical: "CS Généraliste", montant: 15000, quantite: 1, statut: "Accepté", motifRejet: "",
    }], this.COLONNES_NUMERIQUES_FACTURE_GLOBALE);
  }

  async importerFacturesGlobal(buffer: Buffer): Promise<{ total: number; crees: number; enAttente: number; rejets: Rejet[] }> {
    const { feuille, indexParCle } = await this.chargerFeuille(buffer, this.COLONNES_FACTURE_GLOBALE, [
      "matricule", "prestataire", "referenceFacture", "dateReception", "typePrestation", "datePrestation", "montant",
    ]);

    // ── Passe 1 : lecture + validation structurelle, AUCUNE requête DB
    // (nécessaire pour rester rapide sur un très gros fichier). ──
    type LigneLue = {
      r: number; matricule: string; numeroPolice?: string; prestataire: string; referenceFacture: string; dateReception: string;
      typePrestation: string; datePrestation: string; acteMedical?: string; montant: number;
      quantite?: number; statut?: string; motifRejet?: string;
    };
    const lignes: LigneLue[] = [];
    const rejets: Rejet[] = [];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const v = (cle: string) => this.lireValeur(feuille, indexParCle, r, cle);
      const matricule = v("matricule");
      if (!matricule && !v("prestataire") && !v("montant")) continue; // ligne vide
      const prestataire = v("prestataire");
      const referenceFacture = v("referenceFacture");
      const dateReception = v("dateReception");
      const typePrestationBrut = v("typePrestation");
      const datePrestation = v("datePrestation");
      const acteMedical = v("acteMedical"); // facultatif — voir LIBELLE_ACTE_NON_DETAILLE
      const montantBrut = v("montant");
      if (!matricule || !prestataire || !referenceFacture || !dateReception || !typePrestationBrut || !datePrestation || !montantBrut) {
        rejets.push({ ligne: r, motif: "Matricule, prestataire, référence facture, date de réception, type de prestation, date de prestation et montant sont obligatoires." });
        continue;
      }
      const datePrestationParsed = normaliserDateImport(datePrestation) ?? datePrestation;
      const datePrestationDate = parseDateFrImport(datePrestationParsed);
      if (datePrestationDate && datePrestationDate > dateDuJourImport()) {
        rejets.push({ ligne: r, motif: `Date de prestation future (${datePrestationParsed}) — seules les prestations du jour ou passées sont importables.` });
        continue;
      }
      // Les montants sont stockés en FCFA entiers : < 0,5 par défaut,
      // >= 0,5 par excès, avant signature d'idempotence et création.
      const montant = Math.round(Number(montantBrut));
      if (!Number.isFinite(montant) || montant < 0) { rejets.push({ ligne: r, motif: `Montant "${montantBrut}" invalide.` }); continue; }
      const statut = v("statut");
      const motifRejet = v("motifRejet");
      if (statut === "Rejeté" && !motifRejet) { rejets.push({ ligne: r, motif: "Motif de rejet obligatoire pour une ligne Rejetée." }); continue; }
      const quantiteBrut = v("quantite");
      lignes.push({
        r, matricule, numeroPolice: v("numeroPolice"), prestataire, referenceFacture,
        dateReception: normaliserDateImport(dateReception) ?? dateReception,
        typePrestation: normaliserTypePrestation(typePrestationBrut), datePrestation: datePrestationParsed,
        acteMedical, montant, quantite: quantiteBrut ? Number(quantiteBrut) : undefined, statut, motifRejet,
      });
    }
    if (lignes.length === 0) return { total: 0, crees: 0, enAttente: 0, rejets };

    // ── Passe 2 : résolution EN LOTS — matricule/prestataire/acte médical,
    // une requête chacun pour TOUT le fichier (voir demande utilisateur :
    // "gérer de façon optimum plus de 50000 lignes en une fois"). ──
    const matricules = [...new Set(lignes.map((l) => l.matricule.trim()))];
    const assures = await this.prisma.assureSante.findMany({
      where: { matricule: { in: matricules, mode: "insensitive" } },
      include: { contrat: { select: { numeroPolice: true, statut: true } } },
    });
    const assureParMatricule = new Map<string, typeof assures>();
    for (const a of assures) {
      const cle = a.matricule.trim().toLowerCase();
      const liste = assureParMatricule.get(cle);
      if (liste) liste.push(a); else assureParMatricule.set(cle, [a]);
    }

    // Alias déclaré puis auto-création EN LOTS — voir
    // resoudrePrestatairesEnLot (même mécanisme que le mode par contrat,
    // voir demande utilisateur : "pour les autres prestataires, il faut
    // les créer et rendre possible l'import des données").
    const prestataireParValeur = await this.resoudrePrestatairesEnLot(lignes.map((l) => l.prestataire));

    // Acte facultatif (2026-08 — voir demande utilisateur : "il faut
    // rendre la prestation facultative") — seules les valeurs RENSEIGNÉES
    // sont recherchées en lot ; le repère générique (une seule requête,
    // jamais par ligne) couvre le reste.
    const acteValeurs = [...new Set(lignes.filter((l) => l.acteMedical).map((l) => l.acteMedical!.trim()))];
    const acteRows = acteValeurs.length > 0
      ? await this.prisma.acteMedical.findMany({ where: { libelle: { in: acteValeurs, mode: "insensitive" } } })
      : [];
    const acteParLibelle = new Map<string, (typeof acteRows)[number]>();
    for (const a of acteRows) acteParLibelle.set(a.libelle.trim().toLowerCase(), a);
    const acteGenerique = await this.acteGenerique();

    // Ré-import du même fichier, EN LOTS (2026-09 — voir demande
    // utilisateur : "si import à nouveau des factures... ignorer les
    // lignes déjà importées et n'ajoute que celles qui n'existent pas
    // encore" — voir ligneFactureExisteDeja/parseFactures pour le même
    // principe côté import par contrat). Une seule requête sur TOUTES les
    // références distinctes du fichier, puis une seule sur les lignes des
    // factures trouvées — jamais une requête par ligne, même à 50 000+.
    const referencesDuLot = [...new Set(lignes.map((l) => l.referenceFacture.trim()))];
    const facturesExistantesDuLot = referencesDuLot.length > 0
      ? await this.prisma.facture.findMany({ where: { referenceFacture: { in: referencesDuLot } }, select: { id: true, prestataireId: true, referenceFacture: true } })
      : [];
    const factureExistanteParId = new Map(facturesExistantesDuLot.map((f) => [f.id, f]));
    const lignesExistantesDuLot = facturesExistantesDuLot.length > 0
      ? await this.prisma.priseEnCharge.findMany({ where: { factureId: { in: facturesExistantesDuLot.map((f) => f.id) } }, select: { factureId: true, assureId: true, date: true, type: true, montant: true } })
      : [];
    const signaturesExistantes = new Set(lignesExistantesDuLot.map((l) => {
      const f = factureExistanteParId.get(l.factureId!)!;
      return `${f.prestataireId}|${f.referenceFacture}|${l.assureId}|${l.date}|${l.type}|${Number(l.montant)}`;
    }));

    // ── Répartition (2026-08 — voir demande utilisateur : "seulement faire
    // remonter les factures des matricules trouvés et mettre les autres en
    // attente"). ──
    const aCreer: Parameters<typeof this.creerFacturesDepuisLignesResolues>[0] = [];
    const aMettreEnAttente: LigneLue[] = [];
    for (const l of lignes) {
      const candidats = (assureParMatricule.get(l.matricule.trim().toLowerCase()) ?? [])
        .filter((a) => !l.numeroPolice || a.contrat.numeroPolice?.trim().toLowerCase() === l.numeroPolice.trim().toLowerCase());
      if (!candidats || candidats.length === 0) { aMettreEnAttente.push(l); continue; }
      const candidatsActifs = candidats.filter((a) => a.statut === "Actif" && ["Actif", "En renouvellement"].includes(a.contrat.statut));
      const candidatsEligibles = candidatsActifs.length === 1 ? candidatsActifs : candidats;
      if (candidatsEligibles.length > 1) { rejets.push({ ligne: l.r, motif: `Le matricule "${l.matricule}" existe sur plusieurs polices actives — renseignez le numéro de police compagnie dans le fichier.` }); continue; }
      const prestataireRow = prestataireParValeur.get(l.prestataire.trim());
      if (!prestataireRow) { rejets.push({ ligne: l.r, motif: `Prestataire "${l.prestataire}" introuvable.` }); continue; }
      const assure = candidatsEligibles[0];
      const signature = `${prestataireRow.id}|${l.referenceFacture.trim()}|${assure.id}|${l.datePrestation}|${l.typePrestation}|${l.montant}`;
      if (signaturesExistantes.has(signature)) {
        rejets.push({ ligne: l.r, motif: `Déjà importée — une ligne identique existe pour le matricule "${l.matricule}" chez "${l.prestataire}" (facture ${l.referenceFacture}, ${l.datePrestation}, ${l.montant} FCFA). Ignorée automatiquement.` });
        continue;
      }
      const acte = (l.acteMedical ? acteParLibelle.get(l.acteMedical.trim().toLowerCase()) : undefined) ?? acteGenerique ?? undefined;
      if (!acte) { rejets.push({ ligne: l.r, motif: "Aucun acte médical catalogué disponible." }); continue; }
      aCreer.push({
        ligne: l.r, contratId: assure.contratId, assureId: assure.id, prestataireId: prestataireRow.id,
        referenceFacture: l.referenceFacture, dateReception: l.dateReception, typePrestation: l.typePrestation,
        datePrestation: l.datePrestation, acteMedicalId: acte.id, montant: l.montant, quantite: l.quantite,
        statut: l.statut, motifRejet: l.motifRejet,
      });
    }

    // ── Mise en attente en masse (2026-08 — un INSERT groupé, jamais un
    // par ligne). ──
    if (aMettreEnAttente.length > 0) {
      await this.prisma.factureEnAttente.createMany({
        data: aMettreEnAttente.map((l) => ({
          matricule: l.matricule, numeroPolice: l.numeroPolice ?? null, prestataire: l.prestataire, referenceFacture: l.referenceFacture,
          dateReception: l.dateReception, typePrestation: l.typePrestation, datePrestation: l.datePrestation,
          acteMedical: l.acteMedical ?? "", montant: l.montant, quantite: l.quantite, statut: l.statut, motifRejet: l.motifRejet,
        })),
      });
    }

    const crees = await this.creerFacturesDepuisLignesResolues(aCreer, rejets);
    return { total: lignes.length, crees, enAttente: aMettreEnAttente.length, rejets };
  }

  // Rejoue la file d'attente (2026-08 — voir demande utilisateur : "une
  // fois cela fait, l'application devra systématiquement synchroniser [et]
  // charger les factures sur les bons contrats") — une ligne mise en
  // attente est rejouée dès que son matricule apparaît (enfin) dans une
  // population de contrat. Même moteur de résolution EN LOTS que
  // l'import global ci-dessus. Une ligne dont le matricule résout
  // maintenant, mais dont le prestataire/acte reste introuvable, sort de
  // la file (ce n'était pas un problème de population) et devient un rejet
  // définitif plutôt que de rester bloquée indéfiniment.
  async synchroniserFacturesEnAttente(): Promise<{ synchronisees: number; restantes: number; rejets: Rejet[] }> {
    const enAttente = await this.prisma.factureEnAttente.findMany();
    if (enAttente.length === 0) return { synchronisees: 0, restantes: 0, rejets: [] };

    const matricules = [...new Set(enAttente.map((l) => l.matricule.trim()))];
    const assures = await this.prisma.assureSante.findMany({
      where: { matricule: { in: matricules, mode: "insensitive" } },
      include: { contrat: { select: { numeroPolice: true, statut: true } } },
    });
    const assureParMatricule = new Map<string, typeof assures>();
    for (const a of assures) {
      const cle = a.matricule.trim().toLowerCase();
      const liste = assureParMatricule.get(cle);
      if (liste) liste.push(a); else assureParMatricule.set(cle, [a]);
    }

    const resolues = enAttente.filter((l) => (assureParMatricule.get(l.matricule.trim().toLowerCase())?.length ?? 0) >= 1);
    if (resolues.length === 0) return { synchronisees: 0, restantes: enAttente.length, rejets: [] };

    // Alias déclaré puis auto-création EN LOTS — voir
    // resoudrePrestatairesEnLot / importerFacturesGlobal ci-dessus.
    const prestataireParValeur = await this.resoudrePrestatairesEnLot(resolues.map((l) => l.prestataire));

    const acteValeurs = [...new Set(resolues.filter((l) => l.acteMedical).map((l) => l.acteMedical.trim()))];
    const acteRows = acteValeurs.length > 0
      ? await this.prisma.acteMedical.findMany({ where: { libelle: { in: acteValeurs, mode: "insensitive" } } })
      : [];
    const acteParLibelle = new Map<string, (typeof acteRows)[number]>();
    for (const a of acteRows) acteParLibelle.set(a.libelle.trim().toLowerCase(), a);
    const acteGenerique = await this.acteGenerique();

    // Ré-import du même fichier, EN LOTS — voir importerFacturesGlobal
    // ci-dessus pour le même principe (une ligne en attente peut avoir
    // déjà été rejouée par un synchroniser() précédent si le fichier
    // source a été soumis plusieurs fois entre-temps).
    const referencesDuLot = [...new Set(resolues.map((l) => l.referenceFacture.trim()))];
    const facturesExistantesDuLot = referencesDuLot.length > 0
      ? await this.prisma.facture.findMany({ where: { referenceFacture: { in: referencesDuLot } }, select: { id: true, prestataireId: true, referenceFacture: true } })
      : [];
    const factureExistanteParId = new Map(facturesExistantesDuLot.map((f) => [f.id, f]));
    const lignesExistantesDuLot = facturesExistantesDuLot.length > 0
      ? await this.prisma.priseEnCharge.findMany({ where: { factureId: { in: facturesExistantesDuLot.map((f) => f.id) } }, select: { factureId: true, assureId: true, date: true, type: true, montant: true } })
      : [];
    const signaturesExistantes = new Set(lignesExistantesDuLot.map((l) => {
      const f = factureExistanteParId.get(l.factureId!)!;
      return `${f.prestataireId}|${f.referenceFacture}|${l.assureId}|${l.date}|${l.type}|${Number(l.montant)}`;
    }));

    const rejets: Rejet[] = [];
    const aCreer: Parameters<typeof this.creerFacturesDepuisLignesResolues>[0] = [];
    const idsSortisDeLaFile: string[] = [];
    for (const l of resolues) {
      const candidats = (assureParMatricule.get(l.matricule.trim().toLowerCase()) ?? [])
        .filter((a) => !l.numeroPolice || a.contrat.numeroPolice?.trim().toLowerCase() === l.numeroPolice.trim().toLowerCase());
      if (candidats.length === 0) { continue; }
      idsSortisDeLaFile.push(l.id);
      const candidatsActifs = candidats.filter((a) => a.statut === "Actif" && ["Actif", "En renouvellement"].includes(a.contrat.statut));
      const candidatsEligibles = candidatsActifs.length === 1 ? candidatsActifs : candidats;
      if (candidatsEligibles.length > 1) { rejets.push({ ligne: 0, motif: `Le matricule "${l.matricule}" existe sur plusieurs polices actives — renseignez le numéro de police compagnie.` }); continue; }
      const prestataireRow = prestataireParValeur.get(l.prestataire.trim());
      if (!prestataireRow) { rejets.push({ ligne: 0, motif: `Matricule "${l.matricule}" résolu, mais prestataire "${l.prestataire}" introuvable.` }); continue; }
      const assure = candidatsEligibles[0];
      const signature = `${prestataireRow.id}|${l.referenceFacture.trim()}|${assure.id}|${l.datePrestation}|${l.typePrestation}|${Number(l.montant)}`;
      if (signaturesExistantes.has(signature)) {
        rejets.push({ ligne: 0, motif: `Déjà importée — une ligne identique existe pour le matricule "${l.matricule}" chez "${l.prestataire}" (facture ${l.referenceFacture}, ${l.datePrestation}, ${l.montant} FCFA). Ignorée automatiquement.` });
        continue;
      }
      const acte = (l.acteMedical ? acteParLibelle.get(l.acteMedical.trim().toLowerCase()) : undefined) ?? acteGenerique ?? undefined;
      if (!acte) { rejets.push({ ligne: 0, motif: `Matricule "${l.matricule}" résolu, mais aucun acte médical catalogué disponible.` }); continue; }
      aCreer.push({
        ligne: 0, contratId: assure.contratId, assureId: assure.id, prestataireId: prestataireRow.id,
        referenceFacture: l.referenceFacture, dateReception: l.dateReception, typePrestation: l.typePrestation,
        datePrestation: l.datePrestation, acteMedicalId: acte.id, montant: Number(l.montant), quantite: l.quantite ?? undefined,
        statut: l.statut ?? undefined, motifRejet: l.motifRejet ?? undefined,
      });
    }

    const synchronisees = await this.creerFacturesDepuisLignesResolues(aCreer, rejets);
    if (idsSortisDeLaFile.length > 0) {
      await this.prisma.factureEnAttente.deleteMany({ where: { id: { in: idsSortisDeLaFile } } });
    }
    const restantes = await this.prisma.factureEnAttente.count();
    return { synchronisees, restantes, rejets };
  }

  async compterFacturesEnAttente(): Promise<number> {
    return this.prisma.factureEnAttente.count();
  }

  // ══════════════════════════════════════════════════════════════════
  // RÈGLEMENTS — voir import-reglement.dto.ts
  // ══════════════════════════════════════════════════════════════════
  private readonly COLONNES_REGLEMENT = [
    { header: "Prestataire (nom exact ou id)", key: "prestataire" },
    { header: "Période (ex. Août 2025)", key: "periode" },
    { header: "Montant total (FCFA)", key: "montantTotal" },
    { header: "Montant validé (facultatif, défaut = montant total)", key: "montantValide" },
    { header: "Nombre de prises en charge (facultatif)", key: "nbPrisesEnCharge" },
    { header: "Statut (Reçu, En validation, Validé, Payé, Rejeté — défaut Payé)", key: "statut" },
    { header: "Date de réception (JJ/MM/AAAA)", key: "dateReception" },
    { header: "Date de paiement (JJ/MM/AAAA, facultatif)", key: "datePaiement" },
    { header: "Référence virement/chèque (facultatif)", key: "referenceVirement" },
  ];

  genererModeleReglements(): Promise<Buffer> {
    return this.genererClasseur("Reglements", this.COLONNES_REGLEMENT, [{
      prestataire: "CHU Libreville", periode: "Août 2025", montantTotal: 1250000, montantValide: 1250000,
      nbPrisesEnCharge: 12, statut: "Payé", dateReception: "05/08/2025", datePaiement: "20/08/2025", referenceVirement: "VIR-000045",
    }], ["montantTotal", "montantValide", "nbPrisesEnCharge"]);
  }

  async parseReglements(buffer: Buffer): Promise<{ lignes: ImportReglementRowDto[]; rejets: Rejet[] }> {
    const { feuille, indexParCle } = await this.chargerFeuille(buffer, this.COLONNES_REGLEMENT, ["prestataire", "periode", "montantTotal", "dateReception"]);
    const lignes: ImportReglementRowDto[] = [];
    const rejets: Rejet[] = [];
    const STATUTS = ["Reçu", "En validation", "Validé", "Payé", "Rejeté"];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const v = (cle: string) => this.lireValeur(feuille, indexParCle, r, cle);
      const prestataire = v("prestataire");
      if (!prestataire && !v("montantTotal")) continue;
      const periode = v("periode");
      const montantTotal = v("montantTotal");
      const dateReception = v("dateReception");
      if (!prestataire || !periode || !montantTotal || !dateReception) {
        rejets.push({ ligne: r, motif: "Prestataire, période, montant total et date de réception sont obligatoires." });
        continue;
      }
      const statut = v("statut");
      if (statut && !STATUTS.includes(statut)) { rejets.push({ ligne: r, motif: `Statut "${statut}" inconnu — valeurs acceptées : ${STATUTS.join(", ")}.` }); continue; }
      // Prestataire jamais vérifié ici — voir parseFactures ci-dessus :
      // l'aperçu ne doit rien créer ; un prestataire introuvable sera de
      // toute façon créé à la confirmation (voir resoudrePrestataire).
      lignes.push({
        prestataire, periode, montantTotal, montantValide: v("montantValide"), nbPrisesEnCharge: v("nbPrisesEnCharge"),
        statut, dateReception, datePaiement: v("datePaiement"), referenceVirement: v("referenceVirement"),
      });
    }
    return { lignes, rejets };
  }

  async importerReglements(rows: ImportReglementRowDto[]): Promise<{ crees: number; rejets: Rejet[] }> {
    let crees = 0;
    const rejets: Rejet[] = [];
    for (let i = 0; i < rows.length; i++) {
      const ligne = rows[i];
      // Auto-création possible (voir resoudrePrestataire) — voir
      // importerFactures ci-dessus pour le même patron.
      let prestataireRow: Awaited<ReturnType<typeof this.resoudrePrestataire>>;
      try {
        prestataireRow = await this.resoudrePrestataire(ligne.prestataire);
      } catch (err) {
        rejets.push({ ligne: i + 1, motif: err instanceof Error ? err.message : `Impossible de créer le prestataire "${ligne.prestataire}".` });
        continue;
      }
      const montantTotal = Number(ligne.montantTotal);
      if (!Number.isFinite(montantTotal) || montantTotal < 0) { rejets.push({ ligne: i + 1, motif: `Montant total "${ligne.montantTotal}" invalide.` }); continue; }
      const statut = ligne.statut || "Payé";
      // Re-normalisées ici aussi — voir importerFactures ci-dessus.
      const dateReception = normaliserDateImport(ligne.dateReception) ?? ligne.dateReception;
      const datePaiement = normaliserDateImport(ligne.datePaiement) ?? ligne.datePaiement;
      try {
        const id = `BDX-${randomUUID().slice(0, 8).toUpperCase()}`;
        // Même séquence Postgres que ReglementPrestataireService.genererBordereau
        // (reglement_numero_seq) — un règlement importé reste dans la même
        // numérotation continue que ceux créés en direct, jamais un registre
        // parallèle.
        const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('reglement_numero_seq') AS nextval`;
        const numero = nextval.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        await this.prisma.bordereauReglement.create({
          data: {
            id, numero, prestataireId: prestataireRow.id, periode: ligne.periode,
            nbPrisesEnCharge: ligne.nbPrisesEnCharge ? Number(ligne.nbPrisesEnCharge) : 0,
            montantTotal, montantValide: ligne.montantValide ? Number(ligne.montantValide) : montantTotal,
            statut, dateReception, datePaiement: datePaiement || (statut === "Payé" ? dateReception : null),
            referenceVirement: ligne.referenceVirement,
          },
        });
        crees++;
      } catch {
        rejets.push({ ligne: i + 1, motif: "Erreur inattendue lors de la création du règlement." });
      }
    }
    return { crees, rejets };
  }

  // ══════════════════════════════════════════════════════════════════
  // PRISES EN CHARGE — voir import-accord-prealable.dto.ts
  // ══════════════════════════════════════════════════════════════════
  private readonly COLONNES_ACCORD = [
    { header: "Matricule assuré (si connu)", key: "matricule" },
    { header: "Nom de l'assuré/ayant droit (si matricule inconnu)", key: "nom" },
    { header: "Prénom (facultatif — précise le nom en cas d'homonymie)", key: "prenom" },
    { header: "Type (rubrique de garantie)", key: "type" },
    { header: "Description (facultatif)", key: "description" },
    { header: "Date de la demande (JJ/MM/AAAA)", key: "dateDemande" },
    { header: "Prestataire (nom exact ou id)", key: "prestataire" },
    { header: "Montant du devis (FCFA, facultatif)", key: "montantDevis" },
    { header: "Décision (En attente, Accordé, Refusé, Annulé — défaut Accordé)", key: "decision" },
    { header: "Montant autorisé (FCFA — si vide, reprend le montant du devis)", key: "montantAutorise" },
    { header: "Date de décision (JJ/MM/AAAA, si décidé)", key: "dateDecision" },
  ];
  private readonly COLONNES_NUMERIQUES_ACCORD = ["montantDevis", "montantAutorise"];

  // Modèle scopé à UN contrat, pré-rempli avec sa vraie population — même
  // principe que Factures ci-dessus (voir demande utilisateur).
  // Modèle simple — même principe que Factures ci-dessus (voir demande
  // utilisateur : fichier léger, juste rattaché au contrat choisi ; les
  // deux exemples illustrent matricule OU nom, jamais les deux ensemble).
  genererModeleAccordsPrealables(): Promise<Buffer> {
    return this.genererClasseur("PrisesEnCharge", this.COLONNES_ACCORD, [
      {
        matricule: "EXEMPLE-000001", nom: "", prenom: "", type: "Hospitalisation", description: "Chirurgie programmée", dateDemande: "10/01/2025",
        prestataire: "CHU Libreville", montantDevis: 850000, decision: "Accordé", montantAutorise: 850000, dateDecision: "12/01/2025",
      },
      {
        matricule: "", nom: "EXEMPLE", prenom: "Ayant Droit", type: "Optique", description: "Lunettes correctrices", dateDemande: "10/01/2025",
        prestataire: "CHU Libreville", montantDevis: 80000, decision: "Accordé", montantAutorise: 80000, dateDecision: "12/01/2025",
      },
    ], this.COLONNES_NUMERIQUES_ACCORD);
  }

  async parseAccordsPrealables(buffer: Buffer, contratId: string): Promise<{ lignes: ImportAccordPrealableRowDto[]; rejets: Rejet[] }> {
    const { feuille, indexParCle } = await this.chargerFeuille(buffer, this.COLONNES_ACCORD, ["type", "dateDemande", "prestataire"]);
    const lignes: ImportAccordPrealableRowDto[] = [];
    const rejets: Rejet[] = [];
    const DECISIONS = ["En attente", "Accordé", "Refusé", "Annulé"];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const v = (cle: string) => this.lireValeur(feuille, indexParCle, r, cle);
      const matricule = v("matricule");
      const nom = v("nom");
      if (!matricule && !nom && !v("prestataire")) continue;
      const type = v("type");
      const dateDemande = v("dateDemande");
      const prestataire = v("prestataire");
      if (!matricule && !nom) { rejets.push({ ligne: r, motif: "Matricule ou nom de l'assuré obligatoire." }); continue; }
      if (!type || !dateDemande || !prestataire) {
        rejets.push({ ligne: r, motif: "Type, date de la demande et prestataire sont obligatoires." });
        continue;
      }
      const decision = v("decision");
      if (decision && !DECISIONS.includes(decision)) { rejets.push({ ligne: r, motif: `Décision "${decision}" inconnue — valeurs acceptées : ${DECISIONS.join(", ")}.` }); continue; }
      // Défaut Accordé (2026-08) — voir demande utilisateur : "pour les
      // prises en charge récupérées, il faut passer automatiquement en
      // Accordé." Une reprise d'antériorité sans décision précisée
      // représente un dossier déjà traité par l'ancien système — jamais
      // remis "En attente" pour une nouvelle analyse. Un import qui veut
      // vraiment garder un dossier en attente doit l'écrire explicitement.
      const decisionEffective = decision || "Accordé";
      const montantAutorise = v("montantAutorise");
      const montantDevis = v("montantDevis");
      if (decisionEffective === "Accordé" && !montantAutorise && !montantDevis) {
        rejets.push({ ligne: r, motif: "Montant autorisé (ou, à défaut, montant du devis) obligatoire pour une décision Accordé." });
        continue;
      }
      const resAssure = await this.resoudreAssureDuContrat(contratId, { matricule, nom, prenom: v("prenom") });
      if (!resAssure.ok) { rejets.push({ ligne: r, motif: resAssure.erreur }); continue; }
      // Prestataire jamais vérifié ici — voir parseFactures ci-dessus :
      // l'aperçu ne doit rien créer ; un prestataire introuvable sera de
      // toute façon créé à la confirmation (voir resoudrePrestataire).
      lignes.push({
        matricule, nom, prenom: v("prenom"), type, description: v("description"), dateDemande, prestataire,
        montantDevis, decision: decisionEffective, montantAutorise, dateDecision: v("dateDecision"),
      });
    }
    return { lignes, rejets };
  }

  async importerAccordsPrealables(contratId: string, rows: ImportAccordPrealableRowDto[]): Promise<{ crees: number; rejets: Rejet[] }> {
    let crees = 0;
    const rejets: Rejet[] = [];
    for (let i = 0; i < rows.length; i++) {
      const ligne = rows[i];
      const resAssure = await this.resoudreAssureDuContrat(contratId, { matricule: ligne.matricule, nom: ligne.nom, prenom: ligne.prenom });
      if (!resAssure.ok) { rejets.push({ ligne: i + 1, motif: resAssure.erreur }); continue; }
      // Auto-création possible (voir resoudrePrestataire) — voir
      // importerFactures ci-dessus pour le même patron.
      let prestataireRow: Awaited<ReturnType<typeof this.resoudrePrestataire>>;
      try {
        prestataireRow = await this.resoudrePrestataire(ligne.prestataire);
      } catch (err) {
        rejets.push({ ligne: i + 1, motif: err instanceof Error ? err.message : `Impossible de créer le prestataire "${ligne.prestataire}".` });
        continue;
      }
      // Re-normalisées ici aussi — voir importerFactures ci-dessus.
      const dateDemande = normaliserDateImport(ligne.dateDemande) ?? ligne.dateDemande;
      const dateDecision = normaliserDateImport(ligne.dateDecision) ?? ligne.dateDecision;
      try {
        const cree = await this.accordPrealable.create({
          assureId: resAssure.assure.id, type: ligne.type, description: ligne.description || ligne.type,
          dateDemande, prestataire: prestataireRow.nom, prestataireId: prestataireRow.id,
          montantDevis: ligne.montantDevis ? Number(ligne.montantDevis) : undefined, origine: "Agent",
        });
        // Décision déjà connue dans l'ancien système (2026-08) — appliquée
        // directement, SANS repasser par AccordPrealableService.decider()
        // (qui exige ordonnance/devis pour une origine portail — non
        // pertinent ici, donnée déjà tranchée ailleurs) ni par le workflow
        // d'analyse médicale/financière : create() ci-dessus a démarré le
        // dossier "En attente", on le referme immédiatement. Défaut Accordé
        // (2026-08 — voir demande utilisateur : "pour les prises en charge
        // récupérées, il faut passer automatiquement en Accordé") si
        // l'import ne précise rien — seul un "En attente" explicite laisse
        // réellement le dossier ouvert.
        const decisionEffective = ligne.decision || "Accordé";
        if (decisionEffective !== "En attente") {
          const montantAutoriseEffectif = ligne.montantAutorise ? Number(ligne.montantAutorise) : (ligne.montantDevis ? Number(ligne.montantDevis) : undefined);
          await this.prisma.accordPrealable.update({
            where: { id: cree.id },
            data: {
              decision: decisionEffective,
              statutAnalyseMedicale: decisionEffective === "Accordé" ? "Validée" : decisionEffective === "Refusé" ? "Rejetée" : "En cours",
              statutValidationFinanciere: decisionEffective === "Accordé" ? "Validée" : "En cours",
              montantAutorise: montantAutoriseEffectif,
              dateDecision: dateDecision || dateDemande,
              motifDecision: "Reprise d'antériorité — décision déjà tranchée dans l'ancien système.",
            },
          });
        }
        crees++;
      } catch (err) {
        const message = err instanceof Error && "message" in err
          ? (typeof (err as { message: unknown }).message === "string" ? (err as { message: string }).message : "Erreur inattendue.")
          : "Erreur inattendue lors de la création.";
        rejets.push({ ligne: i + 1, motif: message });
      }
    }
    return { crees, rejets };
  }

  // ══════════════════════════════════════════════════════════════════
  // ASSURÉS ET AYANTS DROIT — voir import-assure.dto.ts (2026-08) — voir
  // demande utilisateur : "il faut également prévoir l'import des...
  // assurés et ayants droits. Harmonise les modèles existants." Seul le
  // modèle/aperçu vivent ici (mêmes conventions que Factures/Règlements/
  // Prises en charge ci-dessus) ; la CONFIRMATION appelle directement
  // l'endpoint réel déjà existant (POST /sante/assures/import,
  // SanteService.importPopulation, voir sante.controller.ts) depuis le
  // frontend — jamais dupliquée ici, pour ne jamais diverger des règles
  // métier réelles (rattachement familial, dédoublonnage, âge...).
  // ══════════════════════════════════════════════════════════════════
  private readonly COLONNES_ASSURE = [
    { header: "Matricule (facultatif pour un Assuré Principal — auto-généré si vide)", key: "matricule" },
    { header: "Nom", key: "nom" },
    { header: "Prénom", key: "prenom" },
    { header: "Date de naissance (JJ/MM/AAAA)", key: "dateNaissance" },
    { header: "Sexe (M ou F)", key: "sexe" },
    { header: "Type assuré (AS = Principal, CJ = Conjoint, EF = Enfant)", key: "typeAssure" },
    { header: "Téléphone (facultatif, Assuré Principal uniquement)", key: "telephone" },
    { header: "Statut (Actif ou Inactif — facultatif, laisser vide pour ne pas modifier un statut existant)", key: "statut" },
  ];

  async genererModeleAssures(): Promise<Buffer> {
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet("Assures");
    feuille.columns = this.COLONNES_ASSURE.map((c) => ({ header: c.header, key: c.key, width: 30 }));
    feuille.getRow(1).font = { bold: true };
    // Une famille complète en exemple (2026-08) — voir demande utilisateur :
    // l'ordre des lignes fait foi pour le rattachement familial (chaque AS
    // ouvre une nouvelle famille, les CJ/EF qui suivent immédiatement lui
    // sont rattachés) — l'exemple montre ce rattachement, pas juste une
    // ligne isolée. Matricule et nom délibérément fictifs (2026-08 — voir
    // demande utilisateur : "vérifie le chemin pour chaque type d'import") :
    // le VRAI matricule d'un assuré existant aurait fait passer ce test
    // pour une simple MISE À JOUR silencieuse de sa fiche réelle (voir
    // SanteService.importPopulation, branche "existant" — jamais rejetée,
    // contrairement à un doublon de souscripteur), le pire cas possible
    // pour un exemple laissé tel quel par erreur.
    feuille.addRow({ matricule: "EXEMPLE-000001", nom: "EXEMPLE", prenom: "Assuré Principal", dateNaissance: "12/04/1982", sexe: "M", typeAssure: "AS", telephone: "074123456", statut: "Actif" });
    feuille.addRow({ matricule: "", nom: "EXEMPLE", prenom: "Conjoint", dateNaissance: "03/09/1985", sexe: "F", typeAssure: "CJ", telephone: "", statut: "Actif" });
    feuille.addRow({ matricule: "", nom: "EXEMPLE", prenom: "Enfant", dateNaissance: "20/01/2012", sexe: "M", typeAssure: "EF", telephone: "", statut: "Actif" });
    return classeur.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
  }

  async parseAssures(buffer: Buffer): Promise<{ lignes: ImportAssureRowDto[]; rejets: Rejet[] }> {
    const { feuille, indexParCle } = await this.chargerFeuille(buffer, this.COLONNES_ASSURE, ["nom"]);
    const lignes: ImportAssureRowDto[] = [];
    const rejets: Rejet[] = [];
    const SEXES = ["M", "F"];
    const TYPES = ["AS", "CJ", "EF"];
    // Synonymes tolérés (2026-08 — voir demande utilisateur : "récupérer
    // toutes les données en l'état") — un ancien système écrit parfois le
    // type en toutes lettres plutôt qu'en code ; traduit avant rejet.
    const SYNONYMES_TYPE: Record<string, string> = {
      PRINCIPAL: "AS", ASSUREPRINCIPAL: "AS",
      CONJOINT: "CJ", CONJOINTE: "CJ", EPOUX: "CJ", EPOUSE: "CJ",
      ENFANT: "EF",
    };
    for (let r = 2; r <= feuille.rowCount; r++) {
      const v = (cle: string) => this.lireValeur(feuille, indexParCle, r, cle);
      const nom = v("nom");
      if (!nom) continue; // ligne vide
      const sexe = v("sexe")?.toUpperCase();
      if (sexe && !SEXES.includes(sexe)) { rejets.push({ ligne: r, motif: `Sexe "${sexe}" invalide — M ou F attendu.` }); continue; }
      const typeBrut = v("typeAssure")?.toUpperCase();
      const typeAssure = typeBrut && !TYPES.includes(typeBrut)
        ? SYNONYMES_TYPE[typeBrut.replace(/\s+/g, "")]
        : typeBrut;
      if (typeBrut && !typeAssure) { rejets.push({ ligne: r, motif: `Type assuré "${typeBrut}" invalide — AS, CJ ou EF attendu.` }); continue; }
      lignes.push({ matricule: v("matricule"), nom, prenom: v("prenom"), dateNaissance: v("dateNaissance"), sexe, typeAssure, telephone: v("telephone"), statut: v("statut") });
    }
    return { lignes, rejets };
  }

  // ══════════════════════════════════════════════════════════════════
  // PHOTOS — bulk, appariées par matricule (2026-08) — voir demande
  // utilisateur : "importer même les photos dans un dossier en une fois
  // (mais il faudra juste que la photo soit renommée par les matricules de
  // bénéficiaire de la photo)". Réutilise SanteService.uploadPhoto ligne à
  // ligne (même écriture disque/DB que l'upload unitaire) — jamais un
  // chemin d'écriture parallèle.
  // ══════════════════════════════════════════════════════════════════
  async importerPhotos(files: Express.Multer.File[]): Promise<{ importees: number; rejets: { fichier: string; motif: string }[] }> {
    let importees = 0;
    const rejets: { fichier: string; motif: string }[] = [];
    for (const file of files) {
      const matricule = path.parse(file.originalname).name; // nom de fichier SANS extension = matricule
      const resAssure = await this.resoudreAssureParMatriculeGlobal(matricule);
      if (!resAssure.ok) { rejets.push({ fichier: file.originalname, motif: resAssure.erreur }); continue; }
      try {
        await this.sante.uploadPhoto(resAssure.assure.id, file);
        importees++;
      } catch {
        rejets.push({ fichier: file.originalname, motif: "Écriture du fichier impossible." });
      }
    }
    return { importees, rejets };
  }
}
