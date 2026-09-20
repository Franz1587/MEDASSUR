import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SanteService } from "../sante/sante.service";
import { AccordPrealableLigneDto, CreateAccordPrealableDto } from "./dto/create-accord-prealable.dto";
import { DecisionAccordPrealableDto } from "./dto/decision-accord-prealable.dto";
import { UpdateAccordPrealableDto } from "./dto/update-accord-prealable.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { MessagingService } from "../messaging/messaging.service";
import { PushNotificationsService } from "../notifications/push-notifications.service";

const UPLOADS_DOCS_DIR = path.join(UPLOADS_ROOT, "accords-prealables");
const ORIGINES_PORTAIL = ["Portail Prestataire", "Portail Assuré"];

function aujourdhuiFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Rôles internes ayant accès au module Prise en charge (voir src/auth/
// roles.ts côté frontend, allowedModules "accordPrealable") — reçoivent une
// notification dès qu'une demande arrive d'un portail externe, pour que rien
// ne passe inaperçu (voir demande utilisateur : "notification en temps réel
// ... ça doit venir des portails externes").
const ROLES_NOTIFIES_PORTAIL = ["administrateur", "directeur_technique", "gestionnaire_sinistres", "gestionnaire_sante"];

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

@Injectable()
export class AccordPrealableService {
  constructor(
    private prisma: PrismaService, private notifications: NotificationsService, private sante: SanteService,
    private storage: StorageService, private messaging: MessagingService, private pushNotifications: PushNotificationsService,
  ) {}

  // `contratId` (optionnel) permet à l'état "Prises en Charge" d'un contrat
  // (onglet PrisesEnChargeTab) de ne récupérer que ses propres dossiers —
  // même lacune corrigée cette session pour PriseEnCharge.findPrisesEnCharge.
  // `facture`/`montantFacture` sont dérivés du rapprochement avec les lignes
  // de Facture qui référencent cet accord (AccordPrealable.prisesEnCharge)
  // — pas de nouvelle colonne, juste une lecture de la relation existante,
  // pour permettre au gestionnaire de savoir en un coup d'œil quelles
  // prises en charge accordées ont déjà été facturées.
  //
  // Filtres de recherche (2026-08) — même principe que l'écran Règlement
  // (historique) : prestataire, type, décision, origine, intervalle de date
  // de demande, référence libre (n° dossier ou nom d'assuré). Voir demande
  // utilisateur : "des filtres de recherche... comme dans l'écran de
  // facture ou de règlement".
  async findAll(filtres?: {
    contratId?: string; assureId?: string; assureIds?: string[]; prestataireId?: string; type?: string; decision?: string; origine?: string;
    du?: string; au?: string; reference?: string;
  }) {
    const accords = await this.prisma.accordPrealable.findMany({
      where: {
        contratId: filtres?.contratId,
        // assureIds (2026-09) — voir demande utilisateur : "même les prises
        // en charge qui n'ont pas été demandées via l'application mobile ou
        // le portail assuré doivent remonter... si ça concerne l'assuré et
        // ses ayants droit". PortailMembreController.accordsPrealables ne
        // filtrait jusqu'ici que sur l'id EXACT de l'utilisateur connecté —
        // une entente préalable saisie par un gestionnaire pour un ayant
        // droit (jamais lui-même) restait invisible côté portail assuré.
        // Même principe que prisesEnCharge()/idsFamilleDe : assureIds
        // (famille entière) prioritaire sur assureId (id unique) quand fourni.
        assureId: filtres?.assureIds ? { in: filtres.assureIds } : filtres?.assureId,
        prestataireId: filtres?.prestataireId,
        type: filtres?.type,
        decision: filtres?.decision,
        origine: filtres?.origine,
      },
      include: { assure: true, prisesEnCharge: true, lignes: { include: { acteMedical: true } } },
      orderBy: { dateDemande: "desc" },
    });
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    const referenceNorm = filtres?.reference?.trim().toLowerCase();
    const filtres_ = accords.filter((a) => {
      if (du || au) {
        const d = parseDateFr(a.dateDemande);
        if (!d) return false;
        if (du && d < du) return false;
        if (au && d > au) return false;
      }
      if (referenceNorm) {
        const nomAssure = `${a.assure.nom} ${a.assure.prenom ?? ""}`.toLowerCase();
        const cible = `${a.id} ${nomAssure} ${a.prestataire} ${a.description}`.toLowerCase();
        if (!cible.includes(referenceNorm)) return false;
      }
      return true;
    });
    return Promise.all(filtres_.map(async (a) => ({
      ...a,
      facture: a.prisesEnCharge.length > 0,
      montantFacture: a.prisesEnCharge.reduce((s, p) => s + Number(p.montant), 0),
      montantAutoriseSuggere: await this.calculerMontantSuggere(a),
    })));
  }

  async findOne(id: string) {
    const accord = await this.prisma.accordPrealable.findUnique({ where: { id }, include: { assure: true, lignes: { include: { acteMedical: true } } } });
    if (!accord) throw new NotFoundException(`Accord préalable ${id} introuvable`);
    return { ...accord, montantAutoriseSuggere: await this.calculerMontantSuggere(accord) };
  }

  // Montant que l'assurance devrait rembourser si le dossier est accordé
  // (voir demande utilisateur — "un taux de couverture à 100% ne veut pas
  // dire tout remboursé, mais remboursé jusqu'au plafond de l'acte", et
  // "le taux doit être fonction de l'acte et de sa rubrique") : délègue à
  // SanteService.calculerPartAssuranceLigne, LE MÊME moteur que la saisie
  // de Facture — taux ambulatoire/hospitalisation du contrat selon le
  // secteur (Public/Privé) du prestataire ET la rubrique de garantie de
  // CHAQUE acte (pas un taux générique par dossier), plafonné au tarif de
  // référence de l'acte, avec repli sur le taux ayant droit du contrat s'il
  // est activé pour cet assuré (voir schema.prisma Contrat, "vraiment en
  // option"). Sert à préremplir/proposer le "Montant autorisé" au
  // gestionnaire au moment de trancher le dossier, au lieu de partir du
  // montantDevis brut — même principe pour le Certificat de Prise en
  // Charge (DocumentsService.renderCertificatPriseEnCharge).
  private async calculerMontantSuggere(a: {
    assureId: string; contratId: string; description: string; montantDevis: unknown; prestataireId: string | null; dateDemande: string;
    lignes: { montantDevis: unknown; plafondReference: unknown; acteMedicalId: string | null; acteMedical: { categorieGarantie: string | null } | null }[];
  }): Promise<number | null> {
    if (a.lignes.length > 0) {
      let total = 0;
      for (const l of a.lignes) {
        // Rubrique de garantie de CET acte (ambulatoire/hospitalisation ou
        // rubrique plafonnée type Optique/Soins & Prothèses dentaires) —
        // repli sur "Hospitalisation" pour une ligne sans acte du catalogue
        // (saisie libre), la Prise en Charge couvrant par nature des soins
        // lourds.
        const typePrestation = l.acteMedical?.categorieGarantie ?? "Hospitalisation";
        // Plafonnement déjà fait via l.plafondReference, PAS via
        // acteMedicalId — un acte KC (bloc chirurgical) génère 3 lignes
        // (KC/KA/K Loc) qui partagent le même acteMedicalId mais ont des
        // plafonds différents (calculés par lettre-clé) ; un replafonnement
        // via un unique acte.prixDefaut appliquerait à tort le plafond du
        // chirurgien aux lignes anesthésiste/bloc (voir même correction sur
        // DocumentsService.renderCertificatPriseEnCharge).
        const montantPourCalc = Math.min(Number(l.montantDevis), Number(l.plafondReference));
        const part = await this.sante.calculerPartAssuranceLigne(a.assureId, a.contratId, typePrestation, montantPourCalc, a.prestataireId, undefined, undefined, 1, a.dateDemande);
        if (!("baseRemboursement" in part)) return null;
        total += Number(part.baseRemboursement);
      }
      return total;
    }
    // Dossier sans lignes (ancien modèle, ou description libre) : on tente
    // de rapprocher la description d'un acte du catalogue pour retrouver
    // son tarif de référence et sa rubrique de garantie, plutôt que de
    // renoncer à toute suggestion (voir demande utilisateur : "les quote
    // part ne sont pas calculées").
    if (a.montantDevis == null) return null;
    const acte = await this.prisma.acteMedical.findFirst({ where: { libelle: { equals: a.description.trim(), mode: "insensitive" } } });
    const part = await this.sante.calculerPartAssuranceLigne(a.assureId, a.contratId, acte?.categorieGarantie ?? "Hospitalisation", Number(a.montantDevis), a.prestataireId, undefined, acte?.id ?? null, 1, a.dateDemande);
    return "baseRemboursement" in part ? Number(part.baseRemboursement) : null;
  }

  // Résumé texte des lignes (2026-08) — alimente AccordPrealable.description
  // pour les vues qui n'affichent pas encore le détail ligne par ligne
  // (tableau de la liste, certificat imprimé le cas échéant).
  private resumerLignes(lignes: AccordPrealableLigneDto[]): string {
    return lignes.length === 1 ? lignes[0].description : lignes.map((l) => l.description).join(" + ");
  }

  // Correction d'une demande déjà saisie (2026-08) — erreur de saisie ou
  // prolongation de la validité du certificat (voir demande utilisateur —
  // "on doit même être capable de modifier le bénéficiaire en cas
  // d'erreur"). Volontairement permissif sur le statut : une demande déjà
  // décidée reste corrigible sur ses champs déclaratifs, seule la décision
  // elle-même passe par decider(). Si l'assuré change, contratId doit être
  // recalculé — sinon le dossier resterait rattaché au contrat de l'ANCIEN
  // assuré (même règle qu'à la création, voir create() ci-dessus).
  async update(id: string, dto: UpdateAccordPrealableDto) {
    await this.findOne(id);
    const { lignes, ...header } = dto;
    let contratId: string | undefined;
    if (dto.assureId) {
      const assure = await this.prisma.assureSante.findUniqueOrThrow({ where: { id: dto.assureId } });
      contratId = assure.contratId;
    }
    // Lignes d'actes (2026-08) — quand fournies, remplacent intégralement
    // les précédentes (suppression puis recréation, plus simple qu'un diff)
    // et redérivent montantDevis/description (voir create() ci-dessous et
    // demande utilisateur : "la saisie se fait aussi par ligne").
    const montantDevis = lignes && lignes.length > 0 ? lignes.reduce((s, l) => s + l.montantDevis, 0) : header.montantDevis;
    const description = lignes && lignes.length > 0 ? this.resumerLignes(lignes) : header.description;
    return this.prisma.$transaction(async (tx) => {
      if (lignes) {
        await tx.accordPrealableLigne.deleteMany({ where: { accordPrealableId: id } });
      }
      return tx.accordPrealable.update({
        where: { id },
        data: {
          ...header, description, montantDevis, contratId,
          lignes: lignes && lignes.length > 0 ? { create: lignes.map((l) => ({ ...l })) } : undefined,
        },
        include: { assure: true, lignes: true },
      });
    });
  }

  // demandeurId (2026-08) — capturé depuis l'utilisateur connecté qui
  // établit la demande (voir AccordPrealableController.create), imprimé
  // sur le Certificat de Prise en Charge comme "Demandeur" (voir demande
  // utilisateur : le nom de la personne, pas juste le canal `origine`).
  async create(dto: CreateAccordPrealableDto, demandeurId?: string) {
    const { lignes, ...header } = dto;
    // Dénormalisé à la création (voir schema.prisma) — reste rattaché au
    // contrat réellement en vigueur au moment de la demande, indépendamment
    // d'une bascule ultérieure de l'assuré vers un autre contrat.
    const assure = await this.prisma.assureSante.findUniqueOrThrow({ where: { id: dto.assureId } });

    // Contrôleur de demande/saisie (2026-08) — voir demande utilisateur :
    // "si une demande a été faite en ligne et qu'elle demeure en mode 'en
    // cours', si l'assuré se rend physiquement à l'assurance... l'application
    // pour la même garantie, même assuré, [doit] bloquer et signaler qu'il y
    // a déjà une demande en cours." Recoupement sur assureId + type
    // (= la garantie/rubrique instruite) SEUL — pas le prestataire : le
    // même besoin de soin resté "En attente" reste un doublon même si
    // l'assuré cite un autre établissement au guichet. Une fois la première
    // décidée (Accordé/Refusé/Annulé), une nouvelle demande identique
    // redevient possible — ce n'est alors plus un doublon mais un nouvel
    // épisode de soin. ConflictException (409) avec le dossier existant en
    // corps de réponse — jamais un simple message texte — pour que
    // l'appelant (voir AccordPrealableController) puisse proposer un vrai
    // choix (continuer la saisie sur ce dossier / l'annuler pour en ouvrir
    // un nouveau) plutôt qu'un blocage sec.
    const doublon = await this.prisma.accordPrealable.findFirst({
      where: { assureId: dto.assureId, type: dto.type, decision: "En attente" },
      orderBy: { dateDemande: "desc" },
    });
    if (doublon) {
      throw new ConflictException({
        code: "DOUBLON_EN_COURS",
        message: `Une demande de prise en charge (${doublon.id}) est déjà en cours pour cet assuré sur cette garantie.`,
        dossier: {
          id: doublon.id, type: doublon.type, description: doublon.description, prestataire: doublon.prestataire,
          dateDemande: doublon.dateDemande, statutAnalyseMedicale: doublon.statutAnalyseMedicale,
          statutValidationFinanciere: doublon.statutValidationFinanciere, origine: doublon.origine,
        },
      });
    }

    // Lignes d'actes (2026-08) — une prise en charge peut couvrir plusieurs
    // actes liés, comme une facture (typiquement KC/KA/K Loc pour un bloc
    // chirurgical) : quand fournies, montantDevis/description du dossier
    // deviennent dérivés (somme / résumé), jamais saisis directement (voir
    // demande utilisateur : "la saisie se fait aussi par ligne").
    const montantDevis = lignes && lignes.length > 0 ? lignes.reduce((s, l) => s + l.montantDevis, 0) : dto.montantDevis;
    const description = lignes && lignes.length > 0 ? this.resumerLignes(lignes) : dto.description;

    const cree = await this.prisma.accordPrealable.create({
      data: {
        // "PEC" = diminutif de "Prise en Charge" (voir demande utilisateur
        // — l'écran lui-même est renommé de "Accord préalable" à "Prise en
        // charge", la référence doit suivre).
        id: `PEC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        ...header,
        description,
        montantDevis,
        contratId: assure.contratId,
        demandeurId,
        statutAnalyseMedicale: "En cours",
        statutValidationFinanciere: "En cours",
        decision: "En attente",
        lignes: lignes && lignes.length > 0 ? { create: lignes.map((l) => ({ ...l })) } : undefined,
      },
      // include obligatoire — le frontend (mapAccordPrealable) lit
      // assure.nom sur la réponse de création, pas seulement sur findOne/
      // findAll/update (bug corrigé : "Cannot read properties of undefined
      // (reading 'nom')" à l'enregistrement d'une nouvelle demande).
      include: { assure: true, lignes: true },
    });

    // Notifie les gestionnaires dès qu'une demande arrive d'un portail
    // externe — pour qu'aucun dossier ne soit négligé (voir demande
    // utilisateur). Best-effort : une panne de notification ne doit jamais
    // faire échouer la création du dossier lui-même.
    if (ORIGINES_PORTAIL.includes(dto.origine ?? "")) {
      const destinataires = await this.prisma.user.findMany({ where: { roleId: { in: ROLES_NOTIFIES_PORTAIL } }, select: { id: true } });
      const nomAssure = `${assure.nom} ${assure.prenom ?? ""}`.trim();
      await Promise.all(
        destinataires.map((u) =>
          this.notifications.create("Gestionnaire", u.id, `Nouvelle demande de prise en charge (${cree.id}) via ${dto.origine} — ${nomAssure}`).catch(() => undefined),
        ),
      );
      return cree;
    }

    // Validation directe pour la saisie interne (2026-09) — voir demande
    // utilisateur : "la saisie de la prise en charge au niveau de l'agent de
    // saisie de la société de courtage, la compagnie ou la mutuelle se fait
    // systématiquement ... la saisie peut directement se faire par l'agent
    // de saisie et remonter directement être directement validé et le
    // fichier directement généré, même si c'est l'agent IA qui la traite."
    // Une demande déposée par un portail externe (prestataire/assuré) reste
    // soumise au circuit d'analyse médicale/validation financière (pièces
    // obligatoires, voir decider() ci-dessous) ; une saisie agent (origine
    // par défaut "Agent") est accordée immédiatement, sans étape manuelle —
    // le certificat devient alors téléchargeable tout de suite. Le
    // gestionnaire garde la main pour corriger/refuser ensuite via
    // update()/decider() si la saisie s'avère erronée — ce n'est pas
    // irréversible.
    const montantAutorise = (await this.findOne(cree.id)).montantAutoriseSuggere ?? montantDevis ?? 0;
    await this.decider(cree.id, {
      statutAnalyseMedicale: "Validée",
      statutValidationFinanciere: "Validée",
      decision: "Accordé",
      montantAutorise,
      dateDecision: aujourdhuiFr(),
    });
    return this.findOne(cree.id);
  }

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production". Même principe que
  // MessagerieService.prendre : premier arrivé, premier servi — un dossier
  // déjà pris par un AUTRE agent ne peut pas être réclamé par-dessus lui.
  async prendre(id: string, userId: string) {
    const accord = await this.prisma.accordPrealable.findUnique({ where: { id } });
    if (!accord) throw new NotFoundException(`Dossier ${id} introuvable`);
    if (accord.assigneAId && accord.assigneAId !== userId) {
      throw new ConflictException("Déjà pris en charge par un autre agent.");
    }
    return this.prisma.accordPrealable.update({ where: { id }, data: { assigneAId: userId } });
  }

  /** Fait avancer le workflow: analyse médicale -> validation financière -> décision. */
  async decider(id: string, dto: DecisionAccordPrealableDto) {
    const accord = await this.findOne(id);
    // Une demande déposée depuis un portail externe (prestataire/assuré)
    // doit obligatoirement joindre l'ordonnance ET le devis avant de
    // pouvoir franchir l'analyse médicale — en saisie Agent ces pièces
    // restent facultatives (voir demande utilisateur, create() ci-dessus
    // les accepte donc sans les exiger à l'enregistrement).
    if (dto.statutAnalyseMedicale === "Validée" && ORIGINES_PORTAIL.includes(accord.origine) && (!accord.ordonnanceFichier || !accord.devisFichier)) {
      throw new BadRequestException("Ordonnance et devis obligatoires pour valider une demande déposée via un portail externe.");
    }
    const mis = await this.prisma.accordPrealable.update({ where: { id }, data: dto });

    // Notifie l'assuré à la décision finale (2026-08, SMS/WhatsApp ajouté
    // 2026-09 — voir demande utilisateur : "connecter l'application avec un
    // vrai serveur de sms afin que les informations soient envoyées en réel
    // sur les numéros des assurés"). L'in-app reste réservé aux comptes
    // portail existants (silencieux sinon) ; le SMS/WhatsApp, lui, atteint
    // TOUT assuré ayant un téléphone en base, compte portail ou non — la
    // majorité des cas réels, voir AssureSante.telephone (porté par la
    // racine de famille, jamais un CJ/EF individuellement).
    if (dto.decision === "Accordé" || dto.decision === "Refusé") {
      const libelle = dto.decision === "Accordé" ? "accordée" : "refusée";
      const compte = await this.prisma.user.findUnique({ where: { assureSanteId: accord.assureId } });
      if (compte) {
        await this.notifications.create("Assuré", compte.id, `Votre demande de prise en charge (${id}) a été ${libelle}.`).catch(() => undefined);
        // Notification système mobile (2026-09) — voir demande utilisateur :
        // "informé des nouvelles entrées même quand il n'est pas dans
        // l'application". Décision prise par un gestionnaire humain — le cas
        // "décidé par Ariana" est déjà couvert par l'annonce en conversation
        // (voir agent-ia.service.ts repondre()).
        this.pushNotifications.envoyerAUtilisateur(compte.id, "MedAssur", `Votre demande de prise en charge a été ${libelle}.`, { accordId: id }).catch(() => undefined);
      }
      const telephone = accord.assure.telephone
        ?? (accord.assure.familleId
          ? (await this.prisma.assureSante.findUnique({ where: { id: accord.assure.familleId }, select: { telephone: true } }))?.telephone
          : null);
      await this.messaging.envoyer(telephone, `Votre demande de prise en charge a été ${libelle}. Réf. ${id}.`);
    }
    return mis;
  }

  // Annulation pour nouvelle saisie (2026-08) — voir demande utilisateur :
  // "doit proposer de continuer la saisie sur cette demande ou l'annuler
  // pour faire une nouvelle saisie." Utilisée par le gestionnaire quand il
  // choisit délibérément d'abandonner le dossier "En attente" détecté
  // comme doublon (voir create() ci-dessus) plutôt que de continuer dessus
  // — jamais une décision médicale (Accordé/Refusé), juste un dossier
  // superflu écarté pour laisser la place à une nouvelle saisie propre.
  async annuler(id: string, motif?: string) {
    const accord = await this.findOne(id);
    if (accord.decision !== "En attente") {
      throw new BadRequestException(`Ce dossier a déjà une décision (${accord.decision}) — impossible de l'annuler.`);
    }
    return this.prisma.accordPrealable.update({
      where: { id },
      data: {
        decision: "Annulé",
        motifDecision: motif?.trim() || "Demande annulée par le gestionnaire pour permettre une nouvelle saisie.",
        dateDecision: aujourdhuiFr(),
      },
    });
  }

  // Pièces jointes (2026-08) — même principe que AssureSante.photo :
  // fichier écrit sur disque, seul le nom est stocké en base. `type`
  // distingue les deux zones du formulaire (ordonnance/devis), chacune
  // avec son propre champ de colonne.
  async uploadDocument(id: string, type: "ordonnance" | "devis", file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || "";
    const filename = `${id}-${type}-${randomUUID().slice(0, 6)}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("accords-prealables", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_DOCS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_DOCS_DIR, filename), file.buffer);
    }
    return this.prisma.accordPrealable.update({
      where: { id },
      data: type === "ordonnance" ? { ordonnanceFichier: filename } : { devisFichier: filename },
    });
  }
}
