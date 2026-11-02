import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FacturesService } from "../factures/factures.service";
import { DocumentsService } from "../documents/documents.service";
import { MessagingService } from "../messaging/messaging.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { GROUPES_ACTES, groupeDeFamille } from "../actes-medicaux/groupes-actes.util";
import { calculerAgeAns } from "../mouvements/age-limite.util";
import { resoudreOuCreerPrescripteur } from "../lib/prescripteur.util";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { TraiterBonDto } from "./dto/traiter-bon.dto";
import { ValiderBonNumeriseDto } from "./dto/bon-numerise.dto";

// Types de structure habilités à traiter un bon (2026-08) — voir demande
// utilisateur : "soit la clinique d'origine, soit une autre clinique ou
// l'hôpital, le cabinet, le laboratoire pourra voir les bons d'examens...
// les pharmacies et les dépôts pharmaceutiques pourront voir toutes les
// ordonnances disponibles".
export const TYPES_TRAITANT_EXAMEN = ["Hôpital", "Clinique", "Cabinet", "Laboratoire"];
export const TYPES_TRAITANT_ORDONNANCE = ["Pharmacie", "Dépôt pharmaceutique"];

function typePrestationDe(famille: string | null | undefined): string {
  const groupe = groupeDeFamille(famille);
  return GROUPES_ACTES.find((g) => g.cle === groupe)?.typePrestationDefaut ?? "Ambulatoire";
}

// Non traité / Partiellement traité / Traité (2026-08) — voir demande
// utilisateur : "le statut du bon (Non traité, Partiellement traité,
// Traité)... les mêmes informations doivent apparaître prestataire" — même
// calcul que le E-carnet Santé (voir carnet-sante.service.ts, statutBon).
export type StatutBon = "NonTraite" | "PartiellementTraite" | "Traite";
function statutBonDe(lignes: { statut: string }[]): StatutBon {
  if (lignes.every((l) => l.statut === "EnAttente")) return "NonTraite";
  if (lignes.every((l) => l.statut === "Traite")) return "Traite";
  return "PartiellementTraite";
}

// Médecin prescripteur — e-ordonnance / bon d'examen (2026-08) — voir
// demande utilisateur : consultation en ligne, dossier clinique, e-
// ordonnance (médicaments + posologie) et bon d'examen, trouvables et
// traitables ensuite par n'importe quel prestataire habilité. Traitement
// ATOMIQUE ligne par ligne : "lorsqu'une ligne... a déjà été traitée par
// un prestataire... ce dernier ne verra que ce qui n'a pas été traité".
interface LectureBonPapier {
  lisible: boolean; typeDocument: string;
  prescripteur: string; titrePrescripteur: string; codePraticien: string;
  structure: string; codeEtablissement: string;
  date: string; patient: string; codeAffection: string; remarques: string;
  lignes: { type: "Medicament" | "Examen"; libelle: string; quantite: number; posologie: string }[];
  // Zone du cachet/signature du médecin (fractions 0-1 de l'image).
  cachetVisible: boolean;
  cachetX: number; cachetY: number; cachetW: number; cachetH: number;
}

const CONSIGNES_BON_PAPIER = `Tu es ARIANA, assistante d'un gestionnaire d'assurance santé au Gabon.
On te donne la photo (en PDF) d'une ORDONNANCE ou d'un BON D'EXAMEN papier, souvent manuscrit.
Relève fidèlement :
- typeDocument : "Ordonnance" (médicaments), "Examen" (analyses, imagerie…), "Mixte" (les deux) ou "Autre" (ce n'est pas une prescription) ;
- prescripteur : nom complet du médecin prescripteur tel qu'écrit (cachet ou signature, SANS le titre Dr/Pr), "" si illisible ;
- titrePrescripteur : titre professionnel du prescripteur visible sur le cachet ("Dr", "Pr", "Docteur", "Professeur"…), "" si absent ;
- codePraticien : numéro à l'ordre des médecins / code praticien tel qu'il figure sur le tampon ou le formulaire (case "Code praticien" ou "N° Ordre"), "" si absent ;
- structure : établissement (cachet, en-tête, nom de la clinique ou du cabinet), "" si absent ;
- codeEtablissement : code officiel de l'établissement tel que lisible sur le tampon ou la case "Code établissement" du formulaire, "" si absent ;
- date : date de la prescription au format JJ/MM/AAAA, "" si absente ;
- patient : nom du patient tel qu'écrit, "" si absent ;
- codeAffection : cherche d'abord la case ou le champ intitulé "Code affection", "Code maladie", "N° affection" ou "Code ALD" sur le formulaire imprimé et lis la valeur écrite dedans ; c'est souvent un code CIM-10 (ex. "N18", "A09", "J06.9", "Z34") ou un code CNAMGS à 3-6 caractères — retourne exactement ce qui est écrit, "" si la case est vide ou absente ;
- lignes : une ligne par médicament (type "Medicament" : nom commercial ou DCI avec dosage et forme, quantité = nombre de boîtes ou d'unités prescrites, posologie telle qu'écrite) ou par examen (type "Examen" : libellé de l'examen tel qu'un laboratoire le comprend, quantité 1, posologie "").
- cachetVisible : true si un tampon ou cachet du médecin est visible sur le document, même partiellement lisible, flou ou penché — mettre true dès qu'un tampon est présent ; false uniquement si aucun tampon n'est visible du tout.
- cachetX, cachetY, cachetW, cachetH : zone rectangulaire englobant le cachet ET la signature du médecin (les deux ensemble s'ils sont proches), exprimée en fractions de la largeur et hauteur totale de l'image (0.0 à 1.0, origine en haut à gauche). Agrandir légèrement la zone pour ne rien couper. Mettre à 0 si cachetVisible = false.
N'invente jamais un médicament ou un examen illisible : signale-le dans remarques. lisible = false si le document est trop flou pour être exploité.
Réponds uniquement avec le JSON demandé.`;

const SCHEMA_BON_PAPIER = {
  type: "object", additionalProperties: false,
  required: ["lisible", "typeDocument", "prescripteur", "titrePrescripteur", "codePraticien", "structure", "codeEtablissement", "date", "patient", "codeAffection", "lignes", "remarques", "cachetVisible", "cachetX", "cachetY", "cachetW", "cachetH"],
  properties: {
    lisible: { type: "boolean" },
    typeDocument: { type: "string", enum: ["Ordonnance", "Examen", "Mixte", "Autre"] },
    prescripteur: { type: "string" }, titrePrescripteur: { type: "string" }, codePraticien: { type: "string" },
    structure: { type: "string" }, codeEtablissement: { type: "string" },
    date: { type: "string" }, patient: { type: "string" }, codeAffection: { type: "string" },
    remarques: { type: "string" },
    cachetVisible: { type: "boolean" },
    cachetX: { type: "number" }, cachetY: { type: "number" }, cachetW: { type: "number" }, cachetH: { type: "number" },
    lignes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["type", "libelle", "quantite", "posologie"],
        properties: { type: { type: "string", enum: ["Medicament", "Examen"] }, libelle: { type: "string" }, quantite: { type: "integer" }, posologie: { type: "string" } },
      },
    },
  },
};

// Acte du catalogue le plus proche d'un libellé lu (mots communs, accents et
// casse ignorés) ; null sous le seuil : mieux vaut une ligne libre qu'un
// mauvais acte (et donc un mauvais prix) proposé au prestataire.
// Mots de forme ou de conditionnement : communs \u00e0 des produits diff\u00e9rents,
// ils ne prouvent jamais qu'il s'agit du m\u00eame acte.
const MOTS_NEUTRES = new Set(["comprime", "comprimes", "gelule", "gelules", "boite", "boites", "sirop", "flacon", "ampoule", "ampoules", "injectable", "solution", "suspension", "creme", "pommade", "sachet", "sachets", "buvable", "forme", "examen", "dosage", "taux", "les", "des", "pour", "avec"]);
const motsDe = (s: string) => new Set(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !MOTS_NEUTRES.has(m)));
export function meilleurActe<T extends { libelle: string }>(libelle: string, catalogue: T[]): T | null {
  const lu = motsDe(libelle);
  if (!lu.size) return null;
  let meilleur: T | null = null, score = 0;
  for (const acte of catalogue) {
    const mots = motsDe(acte.libelle);
    if (!mots.size) continue;
    const communs = [...lu].filter((m) => mots.has(m)).length;
    const note = communs / Math.max(lu.size, mots.size);
    if (note > score) { score = note; meilleur = acte; }
  }
  return score >= 0.5 ? meilleur : null;
}

type AssureBon = { id: string; nom: string; prenom: string | null; matricule: string };
type SourceBon = {
  numeroBonExamen: string | null; numeroOrdonnance: string | null; dateOrdonnance: string | null; createdAt: Date;
  origine: string; prescripteurNom: string | null; structureNom: string | null;
  medecin: unknown; assure?: AssureBon | null;
  priseEnCharge?: { numeroFeuilleSoins: string | null; date: string; assure: AssureBon } | null;
};

// Numéro, date, patient et prescripteur d'un bon (2026-11) : consultation
// d'origine, ou ordonnance / bon papier numérisé par l'assuré (sans
// consultation ni médecin du réseau, voir Prescription.origine).
export function vueBon(p: SourceBon, type: "Examen" | "Ordonnance") {
  const assure = (p.priseEnCharge?.assure ?? p.assure)!;
  const numerise = p.origine === "Numérisée";
  return {
    numero: (type === "Ordonnance" ? p.priseEnCharge?.numeroFeuilleSoins ?? p.numeroOrdonnance : p.numeroBonExamen) ?? "—",
    date: p.priseEnCharge?.date ?? p.dateOrdonnance ?? p.createdAt.toLocaleDateString("fr-FR"),
    // Bon numérisé : prescripteur tel que lu sur l'original (médecin hors réseau possible).
    medecin: p.medecin ?? (numerise ? { id: null, nom: p.prescripteurNom ?? "Prescripteur (bon numérisé)", prenom: null, titre: null, specialite: p.structureNom } : null),
    origine: p.origine,
    assure: { id: assure.id, nom: assure.nom, prenom: assure.prenom, matricule: assure.matricule },
  };
}

// Toutes les prescriptions d'un patient : consultation OU numérisation.
const DU_PATIENT = (assureId: string) => ({ OR: [{ priseEnCharge: { assureId } }, { assureId }] });

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);
  private client: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private documents: DocumentsService,
    private factures: FacturesService,
    private messaging: MessagingService,
  ) {}

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  // Suggestion de posologie par IA (2026-08) — voir demande utilisateur :
  // "l'application grâce à l'IA doit connaître la logique de posologie d'un
  // produit en fonction de l'âge et du sexe du patient... si le médecin veut
  // faire un ajustement il pourra retoucher, mais au moins il gagnera en
  // temps". Simple pré-remplissage, jamais bloquant : renvoie `null` (au
  // lieu de planter) si la clé API est absente, si le médicament/patient
  // est introuvable, ou en cas d'erreur de l'API.
  async suggererPosologie(libelleMedicament: string, assureId: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureId } });
    if (!assure) return null;
    const age = calculerAgeAns(assure.dateNaissance, new Date());

    const patient = [
      age !== null ? `${age} ans` : "âge inconnu",
      assure.sexe === "M" ? "sexe masculin" : assure.sexe === "F" ? "sexe féminin" : "sexe inconnu",
    ].join(", ");

    try {
      const reponse = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        // "thinking" désactivé (2026-08) — sans ça, le budget de tokens
        // était parfois entièrement consommé par le raisonnement interne,
        // laissant une réponse texte vide (bug constaté en test : posologie
        // pédiatrique renvoyant systématiquement `null`).
        thinking: { type: "disabled" },
        // Format ABRÉGÉ obligatoire (2026-08) — voir demande utilisateur
        // (annotation sur la Feuille de Soins) : "il n'est pas nécessaire
        // d'écrire des long texte comme ça... il faut utiliser les formats
        // courts pour le format de la prise, la fréquence de la prise et la
        // durée du traitement. Exemple : 1 cp matin et soir / 3 jrs" — la
        // zone Posologie de la feuille de soins déborde sinon.
        system:
          "Tu assistes un médecin gabonais dans la rédaction d'une ordonnance. " +
          "Pour le médicament donné, propose UNE SEULE ligne de posologie ABRÉGÉE, standard et couramment " +
          "prescrite, adaptée à l'âge et au sexe du patient. Format court obligatoire, sans phrase : " +
          "\"<forme+dose abrégée> <fréquence abrégée> / <durée abrégée>\", en utilisant des abréviations " +
          "courantes (cp, gél, ml, sol, matin/midi/soir, j ou h, jrs). Exemples : \"1 cp matin et soir / 5 " +
          "jrs\", \"1 sachet 3x/j / 7 jrs\". Pour un enfant, comme le poids exact n'est pas connu, donne la " +
          "dose pédiatrique de référence en mg/kg toujours au format abrégé (ex : \"15 mg/kg/prise toutes les " +
          "6h, max 60 mg/kg/j\") plutôt que de refuser. Jamais de phrase complète, jamais de guillemets, " +
          "jamais d'explication ni d'avertissement : uniquement la posologie abrégée. Si le médicament est " +
          "vraiment inconnu ou ambigu, réponds exactement ?",
        messages: [{ role: "user", content: `Médicament : ${libelleMedicament}\nPatient : ${patient}` }],
      });
      const bloc = reponse.content.find((b) => b.type === "text");
      const texte = bloc && bloc.type === "text" ? bloc.text.trim() : "";
      if (!texte || texte === "?") return null;
      return texte;
    } catch (err) {
      this.logger.warn(`Suggestion de posologie indisponible pour "${libelleMedicament}" : ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // File d'attente du médecin (2026-08, resserrée 2026-09) — voir demande
  // utilisateur : "il doit voir la liste des assurés qu'il doit recevoir"
  // puis, en durcissement explicite : "si un médecin n'a pas été
  // sélectionné pour recevoir le patient en consultation, il ne doit pas
  // le voir dans sa file... il faut être ferme et strict dessus." Filtrait
  // auparavant par STRUCTURE seule (`prestataireId` via MedecinPrestataire)
  // — n'importe quel médecin intervenant dans la structure voyait TOUTES
  // les consultations de cette structure, y compris celles assignées à un
  // confrère. Filtre désormais sur `medecinId` (assigné par l'accueil au
  // moment de la saisie, voir PriseEnCharge.medecinId) — un médecin ne
  // voit plus QUE les consultations explicitement liées à lui-même.
  async fileAttente(medecinId: string) {
    return this.prisma.priseEnCharge.findMany({
      where: { medecinId, statut: { not: "Annulé" }, prescriptionOrigine: null },
      include: { acteMedical: true, assure: true, prestataireRef: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }

  async creer(medecinId: string, dto: CreatePrescriptionDto) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: dto.priseEnChargeId } });
    if (!ligne) throw new NotFoundException(`Consultation ${dto.priseEnChargeId} introuvable`);
    if (!ligne.prestataireId) throw new BadRequestException("Cette consultation n'est rattachée à aucune structure.");

    const lien = await this.prisma.medecinPrestataire.findUnique({
      where: { medecinId_prestataireId: { medecinId, prestataireId: ligne.prestataireId } },
    });
    if (!lien) throw new ForbiddenException("Vous n'intervenez pas dans la structure de cette consultation.");

    const existante = await this.prisma.prescription.findUnique({ where: { priseEnChargeId: dto.priseEnChargeId } });
    if (existante) throw new BadRequestException("Cette consultation a déjà une prescription — modifiez-la plutôt que d'en recréer une.");

    if (dto.codeAffection) {
      const code = await this.prisma.codeAffection.findUnique({ where: { code: dto.codeAffection } });
      if (!code) throw new BadRequestException(`Code affection "${dto.codeAffection}" inconnu.`);
    }

    // Numéro de Feuille de Soins généré/récupéré dès qu'il y a au moins un
    // médicament — voir demande utilisateur (correction) : "lorsque le
    // médecin fera sa prescription, la feuille de soins va se compléter".
    if (dto.lignes.some((l) => l.type === "Medicament")) {
      await this.documents.numeroFeuilleSoinsDe(dto.priseEnChargeId);
    }
    const numeroBonExamen = dto.lignes.some((l) => l.type === "Examen")
      ? await this.documents.prochainNumeroFormulaire("feuille-examen")
      : undefined;

    const creee = await this.prisma.prescription.create({
      data: {
        priseEnChargeId: dto.priseEnChargeId,
        medecinId,
        motifsConsultation: dto.motifsConsultation,
        codeAffection: dto.codeAffection,
        numeroBonExamen,
        lignes: {
          create: dto.lignes.map((l) => ({
            type: l.type, acteMedicalId: l.acteMedicalId, libelle: l.libelle,
            quantite: l.quantite ?? 1, posologie: l.posologie,
          })),
        },
      },
      // Même forme que mesPrescriptions() (2026-08) — le frontend mappe la
      // réponse de création exactement comme celle de la liste (assure,
      // prestataireRef, acteMedical) ; un include partiel ici faisait
      // planter mapPrescription() côté client ("Cannot read properties of
      // undefined (reading 'id')" sur p.priseEnCharge.assure).
      include: {
        lignes: true, medecin: true,
        priseEnCharge: { include: { assure: true, prestataireRef: true, acteMedical: true } },
      },
    });

    // SMS de la référence (2026-09) — voir demande utilisateur : "même la
    // e-ordonnance... et le e-bon d'examen doivent être envoyés par sms (la
    // référence)... afin que lorsque l'assuré arrive chez le prestataire
    // qui doit servir le bon, il communique simplement la référence du bon
    // et cela renseigné dans le système." Références = les mêmes numéros
    // que ceux affichés/recherchés côté portail prestataire (voir
    // PrescriptionsService.rechercherBon plus bas — recherche justement PAR
    // ce numéro). Toujours au téléphone de l'assuré réel (racine de
    // famille si l'assuré est un CJ/EF, jamais un compte portail requis).
    const assure = creee.priseEnCharge!.assure;
    const telephone = assure.telephone
      ?? (assure.familleId ? (await this.prisma.assureSante.findUnique({ where: { id: assure.familleId }, select: { telephone: true } }))?.telephone : null);
    const references: string[] = [];
    if (creee.priseEnCharge!.numeroFeuilleSoins) references.push(`Ordonnance N° ${creee.priseEnCharge!.numeroFeuilleSoins}`);
    if (creee.numeroBonExamen) references.push(`Bon d'examen N° ${creee.numeroBonExamen}`);
    if (references.length > 0) {
      await this.messaging.envoyer(telephone, `${references.join(" / ")} — présentez cette référence au prestataire de votre choix pour la faire traiter.`);
    }

    return creee;
  }

  // Historique du médecin (2026-08) — voir demande utilisateur : "le
  // dossier médical de chaque patient qu'il aurait reçu... un onglet
  // Historique des prestations". Une seule requête alimente les 3 écrans
  // (Dashboard/Dossiers Patients/Historique) côté frontend — inclut
  // désormais la structure et l'acte de la consultation d'origine.
  mesPrescriptions(medecinId: string) {
    return this.prisma.prescription.findMany({
      where: { medecinId },
      include: {
        lignes: true, medecin: true,
        priseEnCharge: { include: { assure: true, prestataireRef: true, acteMedical: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Recherche d'un bon (2026-08) — voir demande utilisateur : "en rentrant
  // les coordonnées de l'assuré, renseigner le numéro du bon et la liste
  // des examens/médicaments non traités sur le bon apparaîtra". Ne renvoie
  // JAMAIS un bon dont le patient ne correspond pas à `assureId` (pas de
  // fuite d'un bon vers un mauvais patient). Renvoie TOUTES les lignes
  // (pas seulement celles encore en attente) — voir demande utilisateur :
  // "la deuxième pharmacie doit pouvoir [voir le] produit servi par la
  // précédente... pourra voir la mention déjà servi" — chaque ligne porte
  // son propre statut/quantiteTraitee, au frontend de désactiver la
  // sélection des lignes déjà entièrement traitées.
  async rechercherBon(prestataireId: string, params: { type: "Examen" | "Ordonnance"; numero: string; assureId?: string }) {
    const prestataire = await this.prisma.prestataire.findUniqueOrThrow({ where: { id: prestataireId } });
    const typeLigne = params.type === "Ordonnance" ? "Medicament" : "Examen";
    if (params.type === "Ordonnance" && !TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type ?? "")) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter d'ordonnance.");
    }
    if (params.type === "Examen" && !TYPES_TRAITANT_EXAMEN.includes(prestataire.type ?? "")) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter de bon d'examen.");
    }
    const include = {
      assure: true, medecin: true, priseEnCharge: { include: { assure: true } },
      lignes: { where: { type: typeLigne }, include: { acteMedical: true } },
    } as const;
    // Ordonnance : numéro de feuille de soins de la consultation, ou numéro
    // propre d'une ordonnance numérisée par l'assuré. Bon d'examen : même
    // numérotation FE quelle que soit l'origine.
    const prescription = params.type === "Ordonnance"
      ? (await this.prisma.priseEnCharge.findUnique({ where: { numeroFeuilleSoins: params.numero }, select: { prescriptionOrigine: { include } } }))?.prescriptionOrigine
        ?? await this.prisma.prescription.findUnique({ where: { numeroOrdonnance: params.numero }, include })
      : await this.prisma.prescription.findUnique({ where: { numeroBonExamen: params.numero }, include });
    if (!prescription) throw new NotFoundException(params.type === "Ordonnance" ? "Aucune ordonnance ne correspond à ce numéro." : "Aucun bon d'examen ne correspond à ce numéro.");
    const vue = vueBon(prescription, params.type);
    if (params.assureId && vue.assure.id !== params.assureId) throw new ForbiddenException("Ce bon ne correspond pas à ce patient.");
    // Pas de filtrage de profil pour les ordonnances (2026-08) — voir
    // demande utilisateur : "les pharmacies et les dépôts pharmaceutiques
    // pourront voir toutes les ordonnances disponibles". Bons d'examen :
    // visibilité selon le profil (Prestataire.categoriesActesVisibles, vide
    // = tout, même convention qu'ailleurs dans l'application).
    const lignes = params.type === "Ordonnance" ? prescription.lignes : this.lignesVisibles(prestataire, prescription.lignes);
    return { prescriptionId: prescription.id, ...vue, lignes, statut: statutBonDe(lignes) };
  }

  private lignesVisibles<T extends { acteMedical: { famille: string } | null }>(prestataire: { categoriesActesVisibles: string[] }, lignes: T[]): T[] {
    return prestataire.categoriesActesVisibles.length === 0
      ? lignes
      // Ligne d'un bon numérisé sans acte du catalogue : toujours visible
      // (le laboratoire juge lui-même à partir de l'original).
      : lignes.filter((l) => !l.acteMedical || prestataire.categoriesActesVisibles.includes(groupeDeFamille(l.acteMedical.famille) ?? ""));
  }

  // Bons en attente d'un patient (2026-08) — voir demande utilisateur :
  // "rechercher un assuré et en le sélectionnant, on doit voir le bon qui
  // est en attente de traitement." Toujours filtré sur un patient déjà
  // identifié — jamais listé sans recherche. Renvoie TOUTES les lignes du
  // type demandé (voir rechercherBon) — le frontend affiche "déjà servi"
  // pour celles déjà entièrement traitées par un autre prestataire. Inclut
  // les bons numérisés par l'assuré (2026-11).
  async bonsEnAttente(prestataireId: string, params: { type: "Examen" | "Ordonnance"; assureId: string }) {
    const prestataire = await this.prisma.prestataire.findUniqueOrThrow({ where: { id: prestataireId } });
    const typeLigne = params.type === "Ordonnance" ? "Medicament" : "Examen";
    if (params.type === "Ordonnance" && !TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type ?? "")) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter d'ordonnance.");
    }
    if (params.type === "Examen" && !TYPES_TRAITANT_EXAMEN.includes(prestataire.type ?? "")) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter de bon d'examen.");
    }
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        ...DU_PATIENT(params.assureId),
        ...(params.type === "Examen" ? { numeroBonExamen: { not: null } } : {}),
        lignes: { some: { type: typeLigne, statut: { not: "Traite" } } },
      },
      include: {
        assure: true, medecin: true, priseEnCharge: { include: { assure: true } },
        lignes: { where: { type: typeLigne }, include: { acteMedical: true } },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return prescriptions
      .map((p) => {
        const lignes = params.type === "Ordonnance" ? p.lignes : this.lignesVisibles(prestataire, p.lignes);
        return { prescriptionId: p.id, ...vueBon(p, params.type), lignes, statut: statutBonDe(lignes) };
      })
      // Le filtrage profil peut vider un bon entièrement (examens visibles
      // par d'autres spécialités uniquement) — on ne le liste pas alors.
      .filter((b) => b.lignes.length > 0);
  }

  // Historique des bons déjà traités PAR CE prestataire (2026-08) — un bon
  // apparaît dès que ce prestataire a contribué à au moins une ligne (même
  // partiellement) — statut affiché = statut GLOBAL du bon.
  async bonsTraitesPar(prestataireId: string, params: { type: "Examen" | "Ordonnance" }) {
    const typeLigne = params.type === "Ordonnance" ? "Medicament" : "Examen";
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        lignes: { some: { type: typeLigne, traitements: { some: { prestataireId } } } },
        ...(params.type === "Examen" ? { numeroBonExamen: { not: null } } : {}),
      },
      include: {
        assure: true, medecin: true, priseEnCharge: { include: { assure: true } },
        lignes: { where: { type: typeLigne }, include: { acteMedical: true } },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return prescriptions.map((p) => ({ prescriptionId: p.id, ...vueBon(p, params.type), lignes: p.lignes, statut: statutBonDe(p.lignes) }));
  }

  // Lecture d'une ordonnance / d'un bon d'examen PAPIER par ARIANA
  // (2026-11) — voir demande utilisateur : "dans e-carnet transformer un bon
  // d'examen (feuille d'examen) ou une ordonnance (feuille de soins) en bon
  // d'examen ou ordonnance électronique". Proposition seulement : l'assuré
  // relit et corrige chaque ligne avant de valider (creerNumerise).
  async lireBonPapier(buffer: Buffer, mediaType: "image/jpeg" | "application/pdf" = "application/pdf") {
    const client = this.getClient();
    if (!client) throw new ServiceUnavailableException("ARIANA n'est pas configurée sur ce serveur.");
    let reponse;
    const contenu = mediaType === "image/jpeg"
      ? { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: buffer.toString("base64") } }
      : { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: buffer.toString("base64") } };
    try {
      reponse = await client.beta.messages.stream({
        model: "claude-opus-5-5",
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA_BON_PAPIER } },
        system: CONSIGNES_BON_PAPIER,
        messages: [{ role: "user", content: [
          contenu,
          { type: "text", text: "Lis ce document médical et renvoie le JSON demandé." },
        ] }],
      }).finalMessage();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Lecture d'un bon papier impossible : ${message}`);
      if (/credit balance/i.test(message)) throw new ServiceUnavailableException("Crédit ARIANA épuisé : la lecture automatique est indisponible, saisissez les lignes à la main.");
      throw new ServiceUnavailableException("ARIANA n'a pas pu lire ce document. Réessayez ou saisissez les lignes à la main.");
    }
    if (reponse.stop_reason === "refusal") throw new ServiceUnavailableException("ARIANA n'a pas pu traiter ce document. Saisissez les lignes à la main.");
    const lu = JSON.parse(reponse.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as LectureBonPapier;
    // Rapprochement avec le catalogue des actes (prix proposé au prestataire
    // qui délivrera le bon) ; sans correspondance sûre, la ligne reste libre.
    const catalogue = await this.prisma.acteMedical.findMany({ select: { id: true, libelle: true } });
    const lignes = lu.lignes.filter((l) => l.libelle.trim()).map((l) => {
      const acte = meilleurActe(l.libelle, catalogue);
      return { ...l, quantite: l.quantite > 0 ? l.quantite : 1, acteMedicalId: acte?.id ?? null, acteLibelle: acte?.libelle ?? null };
    });
    return { ...lu, lignes };
  }

  // Bon numérisé validé par l'assuré : même objet qu'une prescription de
  // consultation (lignes délivrables, traitement partiel, statuts), sans
  // consultation ni médecin du réseau ; mêmes numérotations FS / FE et même
  // envoi des références par SMS que creer().
  async creerNumerise(carnetDocumentId: string, dto: ValiderBonNumeriseDto) {
    const deja = await this.prisma.prescription.findFirst({ where: { carnetDocumentId }, select: { numeroOrdonnance: true, numeroBonExamen: true } });
    if (deja) throw new BadRequestException(`Ce document a déjà été converti (${[deja.numeroOrdonnance, deja.numeroBonExamen].filter(Boolean).join(" / ")}).`);
    const lignes = dto.lignes.filter((l) => l.libelle.trim());
    if (!lignes.length) throw new BadRequestException("Ajoutez au moins une ligne (médicament ou examen).");
    const numeroOrdonnance = lignes.some((l) => l.type === "Medicament") ? await this.documents.prochainNumeroFormulaire("feuille-soins") : undefined;
    const numeroBonExamen = lignes.some((l) => l.type === "Examen") ? await this.documents.prochainNumeroFormulaire("feuille-examen") : undefined;
    // Résolution automatique du prescripteur lue par ARIANA (2026-11) — trouve
    // ou crée le Medecin + Prestataire et maintient leur lien ; best-effort
    // (jamais bloquant si codePraticien absent ou illisible).
    const prescripteur = await resoudreOuCreerPrescripteur(this.prisma, {
      prescripteurNom: dto.prescripteurNom ?? "",
      titrePrescripteur: dto.titrePrescripteur,
      codePraticien: dto.codePraticien ?? "",
      structureNom: dto.structureNom ?? "",
      codeEtablissement: dto.codeEtablissement ?? "",
    }).catch(() => ({ medecinId: null, prestataireId: null }));

    const creee = await this.prisma.prescription.create({
      data: {
        origine: "Numérisée", assureId: dto.assureId, carnetDocumentId, motifsConsultation: [],
        prescripteurNom: dto.prescripteurNom?.trim() || null, structureNom: dto.structureNom?.trim() || null,
        ...({ codeEtablissement: dto.codeEtablissement?.trim() || null } as any),
        dateOrdonnance: dto.dateOrdonnance?.trim() || null, codeAffection: dto.codeAffection?.trim() || null,
        medecinId: prescripteur.medecinId,
        numeroOrdonnance, numeroBonExamen,
        lignes: { create: lignes.map((l) => ({ type: l.type, acteMedicalId: l.acteMedicalId || null, libelle: l.libelle.trim(), quantite: l.quantite ?? 1, posologie: l.posologie?.trim() || null })) },
      },
      include: { lignes: true, assure: true },
    });

    // Extraction du cachet/signature du médecin depuis la photo originale —
    // best-effort, jamais bloquant : si le JPEG source est absent ou si le
    // crop échoue, le bon électronique est généré sans cachet.
    this.logger.log(`[cachet] dto.cachetVisible=${dto.cachetVisible} w=${dto.cachetW} h=${dto.cachetH} x=${dto.cachetX} y=${dto.cachetY}`);
    if (dto.cachetVisible && dto.cachetW && dto.cachetH && dto.cachetW > 0 && dto.cachetH > 0) {
      try {
        const doc = await this.prisma.carnetSanteDocument.findUnique({ where: { id: carnetDocumentId }, select: { fichier: true } });
        if (doc) {
          const jpegPath = path.join(UPLOADS_ROOT, "carnet-sante", doc.fichier.replace(/\.pdf$/, ".jpg"));
          const jpegBuf = await fs.promises.readFile(jpegPath).catch(() => null);
          this.logger.log(`[cachet] jpegPath=${jpegPath} jpegBuf=${jpegBuf ? jpegBuf.length + "B" : "null"}`);
          if (jpegBuf) {
            const meta = await sharp(jpegBuf).metadata();
            const w = meta.width ?? 1600, h = meta.height ?? 1200;
            const left = Math.max(0, Math.round((dto.cachetX ?? 0) * w));
            const top = Math.max(0, Math.round((dto.cachetY ?? 0) * h));
            const width = Math.min(Math.round(dto.cachetW * w), w - left);
            const height = Math.min(Math.round(dto.cachetH * h), h - top);
            this.logger.log(`[cachet] image ${w}x${h} → crop left=${left} top=${top} width=${width} height=${height}`);
            if (width > 10 && height > 10) {
              // Effet "scan numérique" : normalise → seuil binaire pour supprimer
              // le fond papier sans dégradé (les tons moyens du papier photo
              // passent sinon). Après normalise(), l'encre est ≈ 0-100 lum,
              // le fond papier ≈ 160-255 lum. Seuil à 128 sépare nettement
              // les deux ; tampons colorés (sat > 0.3) conservés au-delà.
              const { data: raw, info: meta2 } = await sharp(jpegBuf)
                .extract({ left, top, width, height })
                .normalise()
                .sharpen({ sigma: 2 })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              const rgba = Buffer.from(raw);
              for (let i = 0; i < rgba.length; i += 4) {
                const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
                const maxC = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
                const minC = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
                const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
                // Encre = sombre OU coloré (tampon bleu/violet) ; fond = transparent
                rgba[i + 3] = (lum < 128 || (sat > 0.3 && lum < 180)) ? 255 : 0;
              }
              const crop = await sharp(rgba, { raw: { width: meta2.width, height: meta2.height, channels: 4 } }).png().toBuffer();
              const cachetPath = path.join(UPLOADS_ROOT, "carnet-sante", doc.fichier.replace(/\.pdf$/, "-cachet.png"));
              await fs.promises.writeFile(cachetPath, crop);
              this.logger.log(`[cachet] sauvegardé → ${cachetPath}`);
            } else {
              this.logger.warn(`[cachet] dimensions trop petites (${width}x${height}), crop ignoré`);
            }
          }
        } else {
          this.logger.warn(`[cachet] carnetDocument ${carnetDocumentId} introuvable`);
        }
      } catch (err) {
        this.logger.warn(`Extraction cachet bon ${carnetDocumentId} échouée (non bloquant) : ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      this.logger.log(`[cachet] ARIANA sans bbox — repli heuristique (moitié droite, tiers supérieur)`);
      // shortcut: région fixe ; couvre la zone praticien des bons gabonais standard.
      try {
        const doc2 = await this.prisma.carnetSanteDocument.findUnique({ where: { id: carnetDocumentId }, select: { fichier: true } });
        if (doc2) {
          const jpegPath2 = path.join(UPLOADS_ROOT, "carnet-sante", doc2.fichier.replace(/\.pdf$/, ".jpg"));
          const jpegBuf2 = await fs.promises.readFile(jpegPath2).catch(() => null);
          if (jpegBuf2) {
            const meta3 = await sharp(jpegBuf2).metadata();
            const iw = meta3.width ?? 1600, ih = meta3.height ?? 1200;
            // Zone : moitié droite (x 50-100 %), du 15 % au 65 % en hauteur
            const hLeft = Math.round(iw * 0.50), hTop = Math.round(ih * 0.15);
            const hWidth = iw - hLeft, hHeight = Math.round(ih * 0.50);
            const { data: raw3, info: meta4 } = await sharp(jpegBuf2)
              .extract({ left: hLeft, top: hTop, width: hWidth, height: hHeight })
              .normalise().sharpen({ sigma: 2 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const rgba3 = Buffer.from(raw3);
            for (let i = 0; i < rgba3.length; i += 4) {
              const lum = 0.299 * rgba3[i] + 0.587 * rgba3[i + 1] + 0.114 * rgba3[i + 2];
              const maxC = Math.max(rgba3[i], rgba3[i + 1], rgba3[i + 2]);
              const sat = maxC === 0 ? 0 : (maxC - Math.min(rgba3[i], rgba3[i + 1], rgba3[i + 2])) / maxC;
              rgba3[i + 3] = (lum < 128 || (sat > 0.3 && lum < 180)) ? 255 : 0;
            }
            const cropH = await sharp(rgba3, { raw: { width: meta4.width, height: meta4.height, channels: 4 } }).png().toBuffer();
            const cachetPathH = path.join(UPLOADS_ROOT, "carnet-sante", doc2.fichier.replace(/\.pdf$/, "-cachet.png"));
            await fs.promises.writeFile(cachetPathH, cropH);
            this.logger.log(`[cachet] heuristique sauvegardé → ${cachetPathH}`);
          }
        }
      } catch { /* jamais bloquant */ }
    }
    const assure = creee.assure!;
    const telephone = assure.telephone
      ?? (assure.familleId ? (await this.prisma.assureSante.findUnique({ where: { id: assure.familleId }, select: { telephone: true } }))?.telephone : null);
    const references = [numeroOrdonnance && `Ordonnance N° ${numeroOrdonnance}`, numeroBonExamen && `Bon d'examen N° ${numeroBonExamen}`].filter(Boolean);
    await this.messaging.envoyer(telephone, `${references.join(" / ")} — présentez cette référence au prestataire de votre choix pour la faire traiter.`);
    return creee;
  }

  async supprimerNumerise(prescriptionId: string, assureIds: string[]) {
    const p = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { lignes: { select: { statut: true } } },
    });
    if (!p || p.origine !== "Numérisée" || !p.assureId || !assureIds.includes(p.assureId))
      throw new NotFoundException("Bon électronique introuvable.");
    if (p.lignes.some((l) => l.statut === "Traite"))
      throw new ConflictException("Ce bon a déjà été traité par un prestataire — il ne peut plus être supprimé ni régénéré.");
    await this.prisma.prescription.delete({ where: { id: prescriptionId } });
  }

  // Traitement d'un bon (2026-08) — crée une VRAIE Facture/PriseEnCharge par
  // ligne retenue (même moteur que "Nouvelle prestation", voir
  // PortailPrestataireController.creerPrestation). Montant/quantité
  // pré-remplis côté écran depuis le catalogue mais toujours modifiables
  // par le prestataire traitant (voir demande utilisateur : "la pharmacie
  // peut changer le prix manuellement ou la quantité").
  //
  // Traitement PARTIEL multi-prestataire (2026-08) — voir demande
  // utilisateur : "si la première pharmacie avait servi une quantité
  // insuffisante en fonction de la disponibilité de son stock par rapport
  // au nombre prescrit, alors la deuxième pharmacie pourra servir le
  // reste... l'assurance rembourse ce qu'elle a servi comme médicament...
  // chaque [prestataire] sera remboursé selon la vente réellement
  // réalisée." Chaque appel ne peut jamais traiter plus que le RESTE
  // disponible (quantite - quantiteTraitee) — la quote-part de CETTE
  // contribution est calculée sur SON propre montant/sa propre quantité
  // (voir FacturesService.ajouterLigne → SanteService.calculerPartAssuranceLigne),
  // jamais sur le total prescrit : un prestataire n'est jamais remboursé
  // au-delà de ce qu'il a réellement délivré.
  async traiter(prestataireId: string, dto: TraiterBonDto) {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: dto.assureId } });
    if (!assure) throw new NotFoundException(`Assuré ${dto.assureId} introuvable`);

    const facture = await this.factures.create({
      prestataireId, contratId: assure.contratId, dateReception: dto.date,
      referenceFacture: await this.factures.genererReferencePortail(prestataireId),
    });

    for (const item of dto.lignes) {
      const pl = await this.prisma.prescriptionLigne.findUnique({
        where: { id: item.ligneId },
        include: { acteMedical: true, prescription: { select: { codeAffection: true } } },
      });
      if (!pl) throw new NotFoundException(`Ligne prescrite ${item.ligneId} introuvable`);
      const reste = pl.quantite - pl.quantiteTraitee;
      // Refus d'un double traitement au-delà du reste disponible (2026-08)
      // — voir demande utilisateur : "elle ne pourra pas réclamer au-delà
      // de ce qu'elle aurait fait comme traitement" — garde-fou explicite
      // en plus du filtrage côté recherche (concurrence entre 2 pharmacies).
      if (reste <= 0) throw new BadRequestException(`La ligne "${pl.libelle}" a déjà été entièrement traitée.`);
      const quantiteATraiter = item.quantite ?? reste;
      if (quantiteATraiter <= 0) throw new BadRequestException(`Quantité invalide pour "${pl.libelle}".`);
      if (quantiteATraiter > reste) throw new BadRequestException(`Il ne reste que ${reste} unité(s) à traiter pour "${pl.libelle}".`);

      // `ignorerDoublonMemeJour` (2026-08) — voir demande utilisateur : "la
      // deuxième pharmacie pourra servir le reste" — plusieurs prestataires
      // facturent légitimement le MÊME acte le MÊME jour pour CE patient ;
      // le garde-fou anti-abus ici est déjà `quantiteATraiter <= reste`
      // ci-dessus, jamais le contrôle générique "un seul acte par jour".
      // `exigerAffection: false` + `codeAffection` hérité de la Prescription
      // d'origine (2026-08) — voir demande utilisateur : le prestataire qui
      // traite un bon délivre une prescription déjà posée par le médecin,
      // il ne ressaisit jamais lui-même le code affection. `natureMaladie`
      // par défaut "AffectionCourante" (le prestataire traitant n'est pas
      // en position de qualifier la gravité).
      const ligneFacturee = await this.factures.ajouterLigne(facture.id, {
        assureId: dto.assureId, typePrestation: typePrestationDe(pl.acteMedical?.famille), datePrestation: dto.date,
        acteMedicalId: pl.acteMedicalId ?? undefined, montant: item.montant, quantite: quantiteATraiter,
        codeAffection: pl.prescription.codeAffection ?? undefined, natureMaladie: "AffectionCourante",
      }, { ignorerDoublonMemeJour: true, exigerAffection: false });

      const quantiteTraiteeApres = pl.quantiteTraitee + quantiteATraiter;
      await this.prisma.prescriptionLigne.update({
        where: { id: pl.id },
        data: {
          quantiteTraitee: quantiteTraiteeApres,
          statut: quantiteTraiteeApres >= pl.quantite ? "Traite" : "PartiellementTraite",
          traitements: { create: { prestataireId, priseEnChargeId: ligneFacturee.id, quantite: quantiteATraiter } },
        },
      });
    }
    return this.factures.findOne(facture.id);
  }
}
