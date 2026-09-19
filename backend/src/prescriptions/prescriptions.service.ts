import Anthropic from "@anthropic-ai/sdk";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FacturesService } from "../factures/factures.service";
import { DocumentsService } from "../documents/documents.service";
import { MessagingService } from "../messaging/messaging.service";
import { GROUPES_ACTES, groupeDeFamille } from "../actes-medicaux/groupes-actes.util";
import { calculerAgeAns } from "../mouvements/age-limite.util";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { TraiterBonDto } from "./dto/traiter-bon.dto";

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
    const assure = creee.priseEnCharge.assure;
    const telephone = assure.telephone
      ?? (assure.familleId ? (await this.prisma.assureSante.findUnique({ where: { id: assure.familleId }, select: { telephone: true } }))?.telephone : null);
    const references: string[] = [];
    if (creee.priseEnCharge.numeroFeuilleSoins) references.push(`Ordonnance N° ${creee.priseEnCharge.numeroFeuilleSoins}`);
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

    if (params.type === "Ordonnance") {
      if (!TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type)) {
        throw new ForbiddenException("Ce type d'établissement ne peut pas traiter d'ordonnance.");
      }
      const ligne = await this.prisma.priseEnCharge.findUnique({
        where: { numeroFeuilleSoins: params.numero },
        include: {
          assure: true,
          prescriptionOrigine: {
            include: { lignes: { where: { type: "Medicament" }, include: { acteMedical: true } }, medecin: true },
          },
        },
      });
      if (!ligne || !ligne.prescriptionOrigine) throw new NotFoundException("Aucune ordonnance ne correspond à ce numéro.");
      if (params.assureId && ligne.assureId !== params.assureId) throw new ForbiddenException("Ce bon ne correspond pas à ce patient.");
      // Pas de filtrage de profil pour les ordonnances (2026-08) — voir
      // demande utilisateur : "les pharmacies et les dépôts pharmaceutiques
      // pourront voir toutes les ordonnances disponibles".
      return {
        prescriptionId: ligne.prescriptionOrigine.id, numero: params.numero, date: ligne.date,
        medecin: ligne.prescriptionOrigine.medecin, lignes: ligne.prescriptionOrigine.lignes,
        statut: statutBonDe(ligne.prescriptionOrigine.lignes),
        assure: { id: ligne.assure.id, nom: ligne.assure.nom, prenom: ligne.assure.prenom, matricule: ligne.assure.matricule },
      };
    }

    if (!TYPES_TRAITANT_EXAMEN.includes(prestataire.type)) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter de bon d'examen.");
    }
    const prescription = await this.prisma.prescription.findUnique({
      where: { numeroBonExamen: params.numero },
      include: {
        lignes: { where: { type: "Examen" }, include: { acteMedical: true } },
        medecin: true, priseEnCharge: { include: { assure: true } },
      },
    });
    if (!prescription) throw new NotFoundException("Aucun bon d'examen ne correspond à ce numéro.");
    if (params.assureId && prescription.priseEnCharge.assureId !== params.assureId) throw new ForbiddenException("Ce bon ne correspond pas à ce patient.");
    // Visibilité selon le profil (2026-08) — voir demande utilisateur : "il
    // pourra voir les bons d'examens avec des examens dont ils ont accès
    // selon leur profil" (Prestataire.categoriesActesVisibles, vide = tout,
    // même convention qu'ailleurs dans l'application).
    const lignesVisibles = prestataire.categoriesActesVisibles.length === 0
      ? prescription.lignes
      : prescription.lignes.filter((l) => prestataire.categoriesActesVisibles.includes(groupeDeFamille(l.acteMedical?.famille) ?? ""));
    const { assure } = prescription.priseEnCharge;
    return {
      prescriptionId: prescription.id, numero: params.numero, date: prescription.priseEnCharge.date,
      medecin: prescription.medecin, lignes: lignesVisibles, statut: statutBonDe(lignesVisibles),
      assure: { id: assure.id, nom: assure.nom, prenom: assure.prenom, matricule: assure.matricule },
    };
  }

  // Bons en attente d'un patient (2026-08) — voir demande utilisateur :
  // "rechercher un assuré et en le sélectionnant, on doit voir le bon qui
  // est en attente de traitement." Toujours filtré sur un patient déjà
  // identifié — jamais listé sans recherche (voir demande utilisateur,
  // correction : "il faut que le prestataire recherche le patient et là le
  // bon en attente peut s'afficher" — le zoom "historique" par défaut de
  // l'écran montre les bons déjà TRAITÉS par CE prestataire, voir
  // bonsTraitesPar ci-dessous, pas la file de tous les bons en attente de
  // tout le monde). Renvoie TOUTES les lignes du type demandé (voir
  // rechercherBon) — le frontend affiche "déjà servi" pour celles déjà
  // entièrement traitées par un autre prestataire.
  async bonsEnAttente(prestataireId: string, params: { type: "Examen" | "Ordonnance"; assureId: string }) {
    const prestataire = await this.prisma.prestataire.findUniqueOrThrow({ where: { id: prestataireId } });

    if (params.type === "Ordonnance") {
      if (!TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type)) {
        throw new ForbiddenException("Ce type d'établissement ne peut pas traiter d'ordonnance.");
      }
      const prescriptions = await this.prisma.prescription.findMany({
        where: {
          priseEnCharge: { assureId: params.assureId },
          lignes: { some: { type: "Medicament", statut: { not: "Traite" } } },
        },
        include: {
          medecin: true, priseEnCharge: { include: { assure: true } },
          lignes: { where: { type: "Medicament" }, include: { acteMedical: true } },
        },
        orderBy: { createdAt: "desc" }, take: 100,
      });
      return prescriptions.map((p) => ({
        prescriptionId: p.id, numero: p.priseEnCharge.numeroFeuilleSoins ?? "—", date: p.priseEnCharge.date,
        medecin: p.medecin, lignes: p.lignes, statut: statutBonDe(p.lignes),
        assure: { id: p.priseEnCharge.assure.id, nom: p.priseEnCharge.assure.nom, prenom: p.priseEnCharge.assure.prenom, matricule: p.priseEnCharge.assure.matricule },
      }));
    }

    if (!TYPES_TRAITANT_EXAMEN.includes(prestataire.type)) {
      throw new ForbiddenException("Ce type d'établissement ne peut pas traiter de bon d'examen.");
    }
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        priseEnCharge: { assureId: params.assureId },
        numeroBonExamen: { not: null }, lignes: { some: { type: "Examen", statut: { not: "Traite" } } },
      },
      include: {
        medecin: true, priseEnCharge: { include: { assure: true } },
        lignes: { where: { type: "Examen" }, include: { acteMedical: true } },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return prescriptions
      .map((p) => {
        const lignesVisibles = prestataire.categoriesActesVisibles.length === 0
          ? p.lignes
          : p.lignes.filter((l) => prestataire.categoriesActesVisibles.includes(groupeDeFamille(l.acteMedical?.famille) ?? ""));
        return {
          prescriptionId: p.id, numero: p.numeroBonExamen ?? "—", date: p.priseEnCharge.date, medecin: p.medecin,
          lignes: lignesVisibles, statut: statutBonDe(lignesVisibles),
          assure: { id: p.priseEnCharge.assure.id, nom: p.priseEnCharge.assure.nom, prenom: p.priseEnCharge.assure.prenom, matricule: p.priseEnCharge.assure.matricule },
        };
      })
      // Le filtrage profil peut vider un bon entièrement (examens visibles
      // par d'autres spécialités uniquement) — on ne le liste pas alors.
      .filter((b) => b.lignes.length > 0);
  }

  // Historique des bons déjà traités PAR CE prestataire (2026-08) — voir
  // demande utilisateur (correction) : "ne doivent apparaître ici que les
  // bons qui ont déjà été traités par la pharmacie... ça ne doit [pas]
  // directement apparaître comme ça chez tous les prestataires" — remplace
  // l'ancien affichage par défaut (tous les bons en attente, tous patients
  // confondus). Un bon apparaît dès que ce prestataire a contribué à au
  // moins une ligne (même partiellement) — statut affiché = statut GLOBAL
  // du bon (peut rester "Partiellement traité" si un autre prestataire doit
  // encore compléter le reste).
  async bonsTraitesPar(prestataireId: string, params: { type: "Examen" | "Ordonnance" }) {
    const typeLigne = params.type === "Ordonnance" ? "Medicament" : "Examen";
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        lignes: { some: { type: typeLigne, traitements: { some: { prestataireId } } } },
        ...(params.type === "Examen" ? { numeroBonExamen: { not: null } } : {}),
      },
      include: {
        medecin: true, priseEnCharge: { include: { assure: true } },
        lignes: { where: { type: typeLigne }, include: { acteMedical: true } },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    return prescriptions.map((p) => ({
      prescriptionId: p.id,
      numero: (params.type === "Ordonnance" ? p.priseEnCharge.numeroFeuilleSoins : p.numeroBonExamen) ?? "—",
      date: p.priseEnCharge.date, medecin: p.medecin, lignes: p.lignes, statut: statutBonDe(p.lignes),
      assure: { id: p.priseEnCharge.assure.id, nom: p.priseEnCharge.assure.nom, prenom: p.priseEnCharge.assure.prenom, matricule: p.priseEnCharge.assure.matricule },
    }));
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
