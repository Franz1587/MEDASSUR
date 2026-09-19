import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { FacturesService } from "../factures/factures.service";
import { DocumentsService } from "../documents/documents.service";
import { DocumentSignatureService } from "../documents/document-signature.service";
import { AccordPrealableService } from "../accord-prealable/accord-prealable.service";
import { RelevesPrestataireService } from "../releves-prestataire/releves-prestataire.service";
import { AuditLogService } from "../audit/audit-log.service";
import { SanteService } from "../sante/sante.service";
import { RechercherPatientDto } from "./dto/rechercher-patient.dto";
import { CreatePrestationMedicaleDto } from "./dto/create-prestation-medicale.dto";
import { CreateDevisMedicalDto } from "./dto/create-devis-medicale.dto";
import { CreerReleveDto } from "./dto/creer-releve.dto";
import { UpdateFactureLigneDto } from "../sante/dto/update-facture-ligne.dto";
import { AnnulerLigneFactureDto } from "../sante/dto/annuler-ligne-facture.dto";
import { AjouterFactureReleveDto } from "./dto/ajouter-facture-releve.dto";
import { AjouterLignePrestationDto } from "./dto/ajouter-ligne-prestation.dto";
import { ApercuLignePrestationDto } from "./dto/apercu-ligne-prestation.dto";
import { PrescriptionsService, TYPES_TRAITANT_EXAMEN, TYPES_TRAITANT_ORDONNANCE } from "../prescriptions/prescriptions.service";
import { TraiterBonDto } from "../prescriptions/dto/traiter-bon.dto";
import { MessagerieAgentIaService } from "../messagerie/agent-ia.service";

type PortailPrestataireRequest = Request & { user: { userId: string; nom: string; roleId: string; prestataireId: string | null } };

// Portail prestataire (2026-08) — voir demande utilisateur : "portail
// externe dédié au prestataire médical", capture de référence fournie par
// l'utilisateur ("je veux que tu duplique cela"). Endpoints cloisonnés au
// Prestataire rattaché au compte connecté (User.prestataireId, voir
// schema.prisma) — même patron que PortailClientController/PortailMembreController
// (façade fine, délègue à FacturesService/SanteService existants : une
// prestation saisie ici EST une vraie Facture/PriseEnCharge, visible et
// traitable côté interne comme n'importe quelle autre — voir demande
// utilisateur : "l'application doit vraiment être interopérable").
@Controller("portail-prestataire")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("prestataire_sante")
export class PortailPrestataireController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factures: FacturesService,
    private readonly documents: DocumentsService,
    private readonly accordPrealable: AccordPrealableService,
    private readonly releves: RelevesPrestataireService,
    private readonly signatures: DocumentSignatureService,
    private readonly auditLog: AuditLogService,
    private readonly sante: SanteService,
    private readonly prescriptions: PrescriptionsService,
    private readonly agentIa: MessagerieAgentIaService,
  ) {}

  // Statut réel, temps réel (2026-08) — voir demande utilisateur : "le
  // statut d'une facture ou d'un relevé de facture doit remonter en temps
  // réel en fonction du traitement fait côté assurance". Réutilise la même
  // résolution que le scan du QR (DocumentSignatureService), jamais un
  // simple statut figé "Soumise" — attaché directement aux listes/détails
  // ci-dessous, sans qu'aucun scan ne soit nécessaire pour le voir.
  private async statutReelFacture(factureId: string) {
    return this.signatures.resoudreStatutActuel("Facture de prestation", factureId);
  }

  private async statutReelReleve(numero: string) {
    return this.signatures.resoudreStatutActuel("Relevé de facture prestataire", numero);
  }

  private prestataireIdDe(req: PortailPrestataireRequest): string {
    if (!req.user.prestataireId) throw new ForbiddenException("Ce compte n'est rattaché à aucun établissement.");
    return req.user.prestataireId;
  }

  // Prix des médicaments/quote-part JAMAIS visibles côté clinique/cabinet/
  // hôpital (2026-09) — voir demande utilisateur : "le médecin n'est pas
  // censé connaître les prix des médicaments de la pharmacie" — réservé à
  // la SEULE pharmacie qui délivre réellement l'ordonnance.
  private async masquerPrixPharmacieDe(req: PortailPrestataireRequest): Promise<boolean> {
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: this.prestataireIdDe(req) }, select: { type: true } });
    return prestataire?.type !== "Pharmacie";
  }

  @Get("moi")
  async moi(@Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const p = await this.prisma.prestataire.findUnique({ where: { id: prestataireId } });
    if (!p) throw new NotFoundException("Établissement introuvable");
    return p;
  }

  // Médecins de CETTE structure, pour le sélecteur "Consultation pour"
  // côté accueil (2026-09) — voir demande utilisateur : "au niveau de
  // l'accueil, le médecin doit avoir été lié à la prestation consultation
  // qui doit se faire." Spécialité incluse pour que l'accueil distingue
  // clairement généraliste (specialite vide) et spécialiste — voir
  // Prestations.tsx.
  @Get("medecins")
  async medecins(@Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const liens = await this.prisma.medecinPrestataire.findMany({
      where: { prestataireId, medecin: { actif: true } },
      include: { medecin: { select: { id: true, nom: true, prenom: true, titre: true, specialite: true } } },
    });
    return liens
      .map((l) => l.medecin)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }

  @Get("dashboard")
  async dashboard(@Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const [prestataire, factures] = await Promise.all([
      this.prisma.prestataire.findUnique({ where: { id: prestataireId } }),
      this.prisma.facture.findMany({ where: { prestataireId }, include: { lignes: true } }),
    ]);
    if (!prestataire) throw new NotFoundException("Établissement introuvable");
    const enSaisie = factures.filter((f) => f.statut === "En saisie").length;
    const soumises = factures.filter((f) => f.statut === "Soumise").length;
    const montantTotal = factures.reduce((s, f) => s + f.lignes.reduce((s2, l) => s2 + Number(l.montant), 0), 0);
    return { nom: prestataire.nom, statutConvention: prestataire.statutConvention, totalPrestations: factures.length, enSaisie, soumises, montantTotal };
  }

  // Identification d'un assuré (2026-08) — voir demande utilisateur, capture
  // de référence "Identifier Un Assuré". Une seule application (MedAssur)
  // gère l'ensemble des assurés ici (contrairement à la maquette de
  // référence, multi-assureurs) — pas d'étape "choisir un organisme".
  // Renvoie TOUTE la famille du match (assuré principal + ayants droit),
  // pour laisser le prestataire choisir le bon bénéficiaire (voir capture
  // "Sélectionnez le patient concerné").
  // Téléphone : correspondance par suffixe de chiffres (2026-08) — voir
  // demande utilisateur : "il faut que le numéro de téléphone soit
  // renseigné sans l'indicatif. Et qu'il soit écrit avec ou sans les
  // espaces, le système doit pouvoir faire une correspondance". Les
  // numéros stockés portent l'indicatif (+241 06 12 34 56) ; un prestataire
  // qui tape "06123456" ou "06 12 34 56" doit quand même matcher. Matricule
  // et n° adhérent restent en comparaison exacte (identifiants stables, pas
  // de format ambigu).
  //
  // Statut réel (2026-08) — voir demande utilisateur : "le statut réel de
  // l'assuré ou de ses ayants droit doit remonter en temps réel, même s'il
  // a déjà été servi un jour par le prestataire". La recherche ne filtre
  // plus sur `statut: "Actif"` : un assuré radié doit toujours être trouvé
  // (pour que le prestataire soit explicitement prévenu qu'il n'est plus
  // couvert, voir patient() ci-dessous), pas silencieusement invisible.
  @Get("patients/recherche")
  async rechercherPatients(@Query() dto: RechercherPatientDto) {
    let trouve: Awaited<ReturnType<typeof this.prisma.assureSante.findFirst>> = null;
    if (dto.type === "telephone") {
      const cible = dto.valeur.replace(/\D/g, "");
      const candidats = await this.prisma.assureSante.findMany({ where: { telephone: { not: null } } });
      trouve = candidats.find((c) => {
        const n = c.telephone!.replace(/\D/g, "");
        return n === cible || n.endsWith(cible) || cible.endsWith(n);
      }) ?? null;
    } else {
      trouve = await this.prisma.assureSante.findFirst({ where: { [dto.type]: dto.valeur } });
    }
    if (!trouve) return [];
    const racineId = trouve.familleId ?? trouve.id;
    const [racine, membres] = await Promise.all([
      trouve.familleId ? this.prisma.assureSante.findUnique({ where: { id: racineId } }) : Promise.resolve(trouve),
      this.prisma.assureSante.findMany({ where: { familleId: racineId } }),
    ]);
    return [racine, ...membres].filter((p): p is NonNullable<typeof p> => p != null);
  }

  // "Mes patients" (2026-08) — voir demande utilisateur : "ajouter des
  // filtres dans les écrans patient pour qu'on puisse rechercher un patient
  // déjà existant... ayant déjà été servi au moins une fois par le
  // prestataire". Distinct des assurés du Facture.contratId (le prestataire
  // peut avoir facturé plusieurs bénéficiaires d'une même famille) — un
  // "patient" ici = un AssureSante distinct ayant au moins une ligne
  // (PriseEnCharge) rattachée à une Facture de CE prestataire, statut
  // toujours résolu en direct (jamais mis en cache depuis la première
  // visite).
  @Get("patients")
  async mesPatients(@Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const lignes = await this.prisma.priseEnCharge.findMany({
      where: { prestataireId },
      distinct: ["assureId"],
      select: { assure: true },
      orderBy: { date: "desc" },
    });
    return lignes.map((l) => l.assure);
  }

  // garantiesVisibles (2026-08) — voir demande utilisateur : "on doit
  // pouvoir définir les garanties qui doivent s'afficher en fonction du
  // type de prestataire". Tableau vide sur le Prestataire = aucune
  // restriction (comportement historique) ; sinon la "Liste des règles de
  // prise en charge" ne montre que les catégories autorisées pour CET
  // établissement (voir Prestataire.garantiesVisibles, configuré côté
  // interne — écran Prestataires).
  @Get("patients/:id")
  async patient(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    const [assure, prestataire] = await Promise.all([
      this.prisma.assureSante.findUnique({
        where: { id },
        include: { contrat: { include: { garanties: true, client: true, compagnie: true } } },
      }),
      this.prisma.prestataire.findUnique({ where: { id: this.prestataireIdDe(req) } }),
    ]);
    if (!assure) throw new NotFoundException(`Assuré ${id} introuvable`);
    // Blocage patient désactivé (2026-08) — voir demande utilisateur :
    // "lorsqu'on veut identifier un assuré, s'il est déjà désactivé, on
    // doit avoir un message d'erreur disant 'Désolé, prestation impossible
    // pour ce patient car il n'est plus couvert'". Contrôle défensif ici
    // (le front bloque déjà plus tôt depuis la liste de famille, voir
    // IdentificationAssure.tsx) — vaut aussi pour tout appel direct par id.
    if (assure.statut !== "Actif") throw new ForbiddenException("Désolé, prestation impossible pour ce patient car il n'est plus couvert.");
    const garantiesAutorisees = prestataire?.garantiesVisibles ?? [];
    const estAyantDroit = assure.typeAssure !== "AS";

    // Résumé Ambulatoire/Hospitalisation/Chambre, par secteur (2026-08) —
    // voir demande utilisateur : "j'ai demandé de faire apparaître QUE 3
    // rubriques Ambulatoire, Hospitalisation et Chambre. Le taux de la
    // chambre est aussi de 100% puisqu'elle fait partie de la rubrique
    // hospitalisation" — remplace ENTIÈREMENT le tableau de garanties
    // détaillé (jamais un ajout au-dessus de la liste existante).
    // Garantie.tauxAssure ne varie pas par secteur — le VRAI taux appliqué
    // au calcul d'une PriseEnCharge vient des 8 champs secteur du Contrat
    // (voir SanteService.tauxParSecteur, même logique que le calcul réel).
    const tauxAmbulatoire = this.sante.tauxParSecteur(false, prestataire?.secteur, estAyantDroit, assure.contrat);
    const tauxHospitalisation = this.sante.tauxParSecteur(true, prestataire?.secteur, estAyantDroit, assure.contrat);
    const chambre = assure.contrat.garanties.find((g) => g.categorie === "Hospitalisation" && /h[ée]bergement|chambre/i.test(g.libelle));

    const autorise = (categorie: string) => garantiesAutorisees.length === 0 || garantiesAutorisees.includes(categorie);
    const garanties: { id: string; categorie: string; libelle: string; tauxApplicable: number | null; plafondMontant: null; plafondTexte: string | null; plafondPeriode: null }[] = [];
    if (tauxAmbulatoire !== null && autorise("Consultation/Divers")) {
      garanties.push({ id: "resume-ambulatoire", categorie: "Consultation/Divers", libelle: "Ambulatoire", tauxApplicable: tauxAmbulatoire, plafondMontant: null, plafondTexte: null, plafondPeriode: null });
    }
    if (tauxHospitalisation !== null && autorise("Hospitalisation")) {
      garanties.push({ id: "resume-hospitalisation", categorie: "Hospitalisation", libelle: "Hospitalisation", tauxApplicable: tauxHospitalisation, plafondMontant: null, plafondTexte: null, plafondPeriode: null });
      // Chambre = même taux que Hospitalisation, elle en fait partie (voir
      // demande utilisateur) — seul le plafond lui est spécifique. Le
      // libellé source ("50 000 F CFA BTAM") est un renvoi au tarif
      // interne ; voir demande utilisateur : "il ne faut pas écrire...
      // BTAM mais plutôt .../JOUR" — l'unité réellement parlante pour un
      // plafond de chambre est journalière, pas la référence tarifaire.
      const plafondChambre = chambre?.plafond?.replace(/\s*BTAM\s*$/i, "/JOUR") ?? null;
      if (chambre) garanties.push({ id: "resume-chambre", categorie: "Hospitalisation", libelle: "Chambre", tauxApplicable: tauxHospitalisation, plafondMontant: null, plafondTexte: plafondChambre, plafondPeriode: null });
    }

    return {
      ...assure,
      contrat: { ...assure.contrat, garanties },
    };
  }

  @Get("prestations")
  async prestations(@Req() req: PortailPrestataireRequest) {
    const factures = await this.factures.findAll({ prestataireId: this.prestataireIdDe(req) });
    return Promise.all(factures.map(async (f) => ({ ...f, statutReel: await this.statutReelFacture(f.id) })));
  }

  @Get("prestations/:id")
  async prestation(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return { ...facture, statutReel: await this.statutReelFacture(id) };
  }

  // Décompte, exemplaire Prestataire (2026-08) — voir demande utilisateur :
  // "le modèle de facture de la prestation chez le prestataire... doit être
  // exemplaire décompte pour le prestataire... en harmonie avec ceux
  // saisis depuis l'écran de l'assurance... la seule différence c'est
  // qu'on doit avoir la mention édité par...". Même document que
  // DocumentsService.renderDecompteFacture (interne/portail assuré),
  // tous les bénéficiaires de la facture (c'est SA propre déclaration),
  // un seul exemplaire "Prestataire" — la mention "Édité par" est calculée
  // depuis la Facture elle-même (gestionnaireId null = saisie portail),
  // pas depuis le visualiseur actuel.
  @Get("prestations/:id/facture")
  async factureImprimable(@Param("id") id: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.documents.renderDecompteFacture(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId }, undefined, "Prestataire");
  }

  // Aperçu de calcul, en direct pendant la saisie (2026-08) — voir demande
  // utilisateur : "le prestataire doit pouvoir saisir son tarif (en frais
  // réels) et l'application doit générer cela comme dans la saisie de
  // facture côté assurance" — même calcul que FacturesController.
  // apercuLigne (taux/part assurance), mais utilisable AVANT même que la
  // Facture existe (identification du patient sans saisie encore créée).
  @Post("prestations/apercu")
  async apercuLignePrestation(@Body() dto: ApercuLignePrestationDto, @Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const assure = await this.prisma.assureSante.findUnique({ where: { id: dto.assureId } });
    if (!assure) throw new NotFoundException(`Assuré ${dto.assureId} introuvable`);
    return this.sante.calculerPartAssuranceLigne(dto.assureId, assure.contratId, dto.typePrestation, dto.montant, prestataireId, undefined, dto.acteMedicalId, dto.quantite ?? 1);
  }

  // Nouvelle prestation (2026-08) — voir demande utilisateur, capture de
  // référence "Création des données de la consultation" : crée une VRAIE
  // Facture + ses lignes (SanteService.creerLigneFacture, même calcul de
  // quote-part que la saisie interne, même notification à l'assuré déjà
  // câblée — voir sante.service.ts).
  @Post("prestations")
  async creerPrestation(@Body() dto: CreatePrestationMedicaleDto, @Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const assure = await this.prisma.assureSante.findUnique({ where: { id: dto.assureId } });
    if (!assure) throw new NotFoundException(`Assuré ${dto.assureId} introuvable`);

    const facture = await this.factures.create({
      prestataireId, contratId: assure.contratId, dateReception: dto.date,
      referenceFacture: await this.factures.genererReferencePortail(prestataireId),
    });
    for (const ligne of dto.lignes) {
      // exigerAffection: false (2026-09) — voir demande utilisateur : "il ne
      // faut pas que l'agent de l'accueil ait la possibilité de renseigner
      // les codes d'affections, cela strictement réservé au médecin
      // traitant" — l'écran ne l'envoie plus du tout (voir Prestations.tsx),
      // ce champ ne peut donc plus jamais être obligatoire depuis ce portail
      // (repéré en testant réellement le flux de bout en bout : la création
      // échouait systématiquement sans ce correctif).
      await this.factures.ajouterLigne(facture.id, { ...ligne, assureId: dto.assureId, typePrestation: dto.typePrestation, datePrestation: dto.date }, { exigerAffection: false });
    }
    return this.factures.findOne(facture.id);
  }

  // Ajout d'une ligne à une facture déjà saisie (2026-08) — voir demande
  // utilisateur : "il faut un vrai formulaire de saisie de facture" — le
  // bénéficiaire est déduit des lignes déjà présentes sur la facture
  // (aucun ré-identification à faire, c'est toujours le même patient).
  @Post("prestations/:id/lignes")
  async ajouterLignePrestation(@Param("id") id: string, @Body() dto: AjouterLignePrestationDto, @Req() req: PortailPrestataireRequest) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    const assureId = facture.lignes[0]?.assureId;
    if (!assureId) throw new NotFoundException("Impossible de déterminer le bénéficiaire de cette facture.");
    // exigerAffection: false — voir même commentaire que creerPrestation ci-dessus.
    await this.factures.ajouterLigne(id, { ...dto, assureId }, { exigerAffection: false });
    return this.factures.findOne(id);
  }

  // Annulation d'une facture entière (2026-08) — voir demande utilisateur :
  // "rendre possible la modification d'une facture ou prestation déjà
  // saisie, doit même pour l'annuler. Une facture annulée ne doit pas
  // remonter dans le relevé de facture. Si elle était déjà liée à un
  // bordereau on doit pouvoir actualiser un bordereau" — même service que
  // la saisie interne (FacturesService.annuler) : détache automatiquement
  // chaque ligne de son bordereau (recalcul du montant total) et bloque si
  // une ligne est déjà réglée (bordereau "Payé"). Une facture "Annulée"
  // est déjà exclue des lots proposés/relevés (voir RelevesPrestataireService
  // .apercu/.creer, filtre statut != "Annulée").
  @Patch("prestations/:id/annuler")
  async annulerPrestation(@Param("id") id: string, @Body() dto: AnnulerLigneFactureDto, @Req() req: PortailPrestataireRequest) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.factures.annuler(id, dto.motif);
  }

  // Modification d'une ligne (2026-08) — voir demande utilisateur : "dans
  // la ligne de facture, que ce soit depuis prestation ou depuis gestion
  // financière, on doit toujours pouvoir modifier une facture et la mettre
  // à jour". Même service que la saisie interne (FacturesService.
  // modifierLigne) — l'historique (qui/quand) est capturé automatiquement
  // par AuditInterceptor (voir historiqueLigne ci-dessous), aucun code
  // spécifique à écrire ici pour la traçabilité.
  @Patch("prestations/:id/lignes/:ligneId")
  async modifierLignePrestation(
    @Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: UpdateFactureLigneDto, @Req() req: PortailPrestataireRequest,
  ) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.factures.modifierLigne(id, ligneId, dto);
  }

  // Annulation d'une ligne (2026-08) — voir demande utilisateur : "on doit
  // pouvoir annuler une prestation faite par erreur" — jamais une
  // suppression, la ligne reste visible avec son motif (voir
  // SanteService.annulerLigneFacture).
  @Patch("prestations/:id/lignes/:ligneId/annuler")
  async annulerLignePrestation(
    @Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: AnnulerLigneFactureDto, @Req() req: PortailPrestataireRequest,
  ) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.factures.annulerLigne(id, ligneId, dto.motif);
  }

  // Feuille de soins / feuille d'examen (2026-08) — voir demande
  // utilisateur : "chaque fiche de consultation génère aussi une feuille
  // de soins et chaque saisie d'un examen, actes de spécialité, analyse
  // médicale génère une feuille d'examen. Le but est de dématérialiser
  // cela" : le prestataire (qui aurait normalement rempli le papier à la
  // main) télécharge/imprime directement le formulaire pré-rempli depuis
  // la ligne qu'il vient de saisir.
  @Get("prestations/:id/lignes/:ligneId/feuille-soins")
  async feuilleSoinsLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.documents.renderFeuilleSoinsLigne(ligneId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: await this.masquerPrixPharmacieDe(req) });
  }

  @Get("prestations/:id/lignes/:ligneId/feuille-examen")
  async feuilleExamenLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.documents.renderFeuilleExamenLigne(ligneId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: await this.masquerPrixPharmacieDe(req) });
  }

  // Historique des modifications (2026-08) — voir demande utilisateur :
  // "l'application doit garder l'historique des factures modifiées et le
  // nom de l'utilisateur ayant fait la modification". Journal transversal
  // déjà tenu par AuditInterceptor pour toute mutation de l'API (interne
  // ET portail confondus, tous deux indexés par l'id de la facture comme
  // premier paramètre de route) — pas de filtre par entite ici pour ne
  // rater aucune modification faite côté interne sur cette même facture.
  @Get("prestations/:id/historique")
  async historiquePrestation(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    return this.auditLog.findAll({ entiteId: id });
  }

  // Télétransmission (2026-08) — voir demande utilisateur, capture de
  // référence "Télétransmettre le dossier" : marque la déclaration comme
  // soumise à l'assurance — bascule visible immédiatement côté interne
  // (écran Factures) comme côté portail assuré (Historique), aucune
  // synchronisation supplémentaire nécessaire (même base de données).
  @Post("prestations/:id/teletransmettre")
  async teletransmettre(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    const facture = await this.factures.findOne(id);
    if (facture.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Prestation ${id} inaccessible`);
    if (facture.statut === "Annulée") throw new ForbiddenException("Cette prestation est annulée.");
    return this.factures.update(id, { statut: "Soumise" });
  }

  // Devis / demande de prise en charge (2026-08) — voir demande
  // utilisateur : "la partie 'Devis' est une rubrique permettant au
  // prestataire de faire une demande de prise en charge de tout type (selon
  // son profil)... je parle bien de l'entente préalable". Même service que
  // la saisie interne et le portail assuré (AccordPrealableService) — un
  // devis déposé ici apparaît immédiatement dans la file de décision
  // interne, avec la même notification déjà câblée (origine "Portail
  // Prestataire", déjà prévue par le modèle — voir schema.prisma
  // AccordPrealable.origine).
  @Get("devis")
  async devis(@Req() req: PortailPrestataireRequest) {
    return this.accordPrealable.findAll({ prestataireId: this.prestataireIdDe(req) });
  }

  @Post("devis")
  async creerDevis(@Body() dto: CreateDevisMedicalDto, @Req() req: PortailPrestataireRequest) {
    const prestataireId = this.prestataireIdDe(req);
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire) throw new NotFoundException("Établissement introuvable");
    const cree = await this.accordPrealable.create(
      { assureId: dto.assureId, type: dto.type, description: "", dateDemande: dto.dateDemande, prestataire: prestataire.nom, prestataireId, lignes: dto.lignes, origine: "Portail Prestataire" },
      req.user.userId,
    );
    // Déclenchement automatique (2026-08) — voir demande utilisateur : "les
    // prise en charge de type hospitalisation [sont] beaucoup plus demandées
    // par les prestataires médicaux" — même déclenchement que côté portail
    // assuré (PortailMembreController), mais ici c'est le compte du
    // prestataire qui reçoit la conversation IA puisque c'est lui qui a
    // déposé la demande.
    if (dto.type === "Hospitalisation") {
      this.agentIa.demarrerDemandeHospitalisation(req.user.userId, { id: cree.id, prestataire: prestataire.nom }).catch(() => undefined);
    }
    return cree;
  }

  private async verifierDevisAppartientA(id: string, prestataireId: string) {
    const accord = await this.accordPrealable.findOne(id);
    if (accord.prestataireId !== prestataireId) throw new ForbiddenException(`Devis ${id} inaccessible`);
  }

  @Post("devis/:id/ordonnance")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploaderOrdonnanceDevis(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Req() req: PortailPrestataireRequest) {
    await this.verifierDevisAppartientA(id, this.prestataireIdDe(req));
    return this.accordPrealable.uploadDocument(id, "ordonnance", file);
  }

  @Post("devis/:id/devis")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploaderPieceDevis(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Req() req: PortailPrestataireRequest) {
    await this.verifierDevisAppartientA(id, this.prestataireIdDe(req));
    return this.accordPrealable.uploadDocument(id, "devis", file);
  }

  @Get("devis/:id/certificat")
  async certificatDevis(@Param("id") id: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    await this.verifierDevisAppartientA(id, this.prestataireIdDe(req));
    return this.documents.renderCertificatPriseEnCharge(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  // Relevé de facture (2026-08) — voir demande utilisateur : "dans l'onglet
  // gestion financière on aura une rubrique relevé de facture... l'application
  // regroupe systématiquement les factures saisies par souscripteur et crée
  // les lots automatiquement, attendant simplement que le prestataire appuie
  // sur le bouton créer". "apercu" = lots proposés (recalculés à la volée,
  // rien n'est persisté avant "Créer" — voir RelevesPrestataireService).
  @Get("releves/apercu")
  async apercuReleves(@Req() req: PortailPrestataireRequest) {
    return this.releves.apercu(this.prestataireIdDe(req));
  }

  @Get("releves")
  async listeReleves(@Req() req: PortailPrestataireRequest) {
    const liste = await this.releves.findAll(this.prestataireIdDe(req));
    return Promise.all(liste.map(async (r) => ({ ...r, statutReel: await this.statutReelReleve(r.numero) })));
  }

  @Post("releves")
  async creerReleve(@Body() dto: CreerReleveDto, @Req() req: PortailPrestataireRequest) {
    return this.releves.creer(this.prestataireIdDe(req), dto.clientId, dto.periode);
  }

  @Get("releves/:id")
  async releve(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    const r = await this.releves.findOne(id);
    if (r.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Relevé ${id} inaccessible`);
    return { ...r, statutReel: await this.statutReelReleve(r.numero) };
  }

  @Get("releves/:id/factures-eligibles")
  async facturesEligiblesReleve(@Param("id") id: string, @Req() req: PortailPrestataireRequest) {
    return this.releves.facturesEligiblesPourAjout(this.prestataireIdDe(req), id);
  }

  // Ajout / retrait d'une facture (2026-08) — voir demande utilisateur :
  // "on doit pouvoir ajouter ou retirer une facture d'un relevé". Voir
  // RelevesPrestataireService.ajouterFacture/retirerFacture pour les
  // garde-fous (même établissement, même souscripteur, même période).
  @Post("releves/:id/factures")
  async ajouterFactureReleve(@Param("id") id: string, @Body() dto: AjouterFactureReleveDto, @Req() req: PortailPrestataireRequest) {
    return this.releves.ajouterFacture(this.prestataireIdDe(req), id, dto.factureId);
  }

  @Delete("releves/:id/factures/:factureId")
  async retirerFactureReleve(@Param("id") id: string, @Param("factureId") factureId: string, @Req() req: PortailPrestataireRequest) {
    return this.releves.retirerFacture(this.prestataireIdDe(req), id, factureId);
  }

  @Get("releves/:id/document")
  async documentReleve(
    @Param("id") id: string, @Req() req: PortailPrestataireRequest, @Res() res: Response,
    @Query("format") format?: string,
  ) {
    const r = await this.releves.findOne(id);
    if (r.prestataireId !== this.prestataireIdDe(req)) throw new ForbiddenException(`Relevé ${id} inaccessible`);
    return this.documents.renderRelevePrestataire(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId }, format === "xlsx" ? "xlsx" : "pdf");
  }

  // Recherche + traitement d'un bon (2026-08) — voir demande utilisateur :
  // "soit la clinique d'origine, soit une autre... pourra voir les bons
  // d'examens... les pharmacies et les dépôts pharmaceutiques pourront
  // voir toutes les ordonnances disponibles". `assureId` optionnel (2026-08)
  // — voir demande utilisateur : "on doit directement pouvoir renseigner la
  // référence d'un bon depuis cette page", sans identifier le patient au
  // préalable.
  @Get("bons")
  async rechercherBon(
    @Query("type") type: "Examen" | "Ordonnance", @Query("numero") numero: string, @Query("assureId") assureId: string | undefined,
    @Req() req: PortailPrestataireRequest,
  ) {
    return this.prescriptions.rechercherBon(this.prestataireIdDe(req), { type, numero, assureId });
  }

  // Bons en attente d'un patient identifié (2026-08) — voir demande
  // utilisateur : "ou rechercher un assuré et en le sélectionnant, on doit
  // voir le bon qui est en attente de traitement" — `assureId` obligatoire
  // (2026-08, correction) : "il faut que le prestataire recherche le
  // patient... pour que [le bon en attente] s'affiche" — jamais listé sans
  // recherche préalable (voir bonsTraitesPar pour le zoom "historique" par
  // défaut de l'écran).
  @Get("bons/en-attente")
  async bonsEnAttente(
    @Query("type") type: "Examen" | "Ordonnance", @Query("assureId") assureId: string,
    @Req() req: PortailPrestataireRequest,
  ) {
    if (!assureId) throw new BadRequestException("Paramètre 'assureId' requis.");
    return this.prescriptions.bonsEnAttente(this.prestataireIdDe(req), { type, assureId });
  }

  // Historique des bons déjà traités par CE prestataire (2026-08) — voir
  // demande utilisateur : "ne doivent apparaître ici que les bons qui ont
  // déjà été traités par la pharmacie" — affiché par défaut à l'ouverture
  // de l'écran "Traiter un bon", sans recherche préalable.
  @Get("bons/historique")
  async bonsTraitesPar(@Query("type") type: "Examen" | "Ordonnance", @Req() req: PortailPrestataireRequest) {
    return this.prescriptions.bonsTraitesPar(this.prestataireIdDe(req), { type });
  }

  // Feuille de Soins/Examen depuis l'écran de traitement d'un bon (2026-08)
  // — voir demande utilisateur : "chaque pharmacie doit toujours pouvoir
  // accéder à la feuille de soins avec ses mises à jour, au moment de
  // traiter l'ordonnance." Autorisation = même règle que rechercherBon/
  // traiter (type d'établissement habilité), PAS la propriété d'une Facture
  // déjà créée (le prestataire n'en a peut-être encore créé aucune).
  @Get("bons/:prescriptionId/feuille-soins")
  async feuilleSoinsBon(@Param("prescriptionId") prescriptionId: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    const prestataire = await this.prisma.prestataire.findUniqueOrThrow({ where: { id: this.prestataireIdDe(req) } });
    if (!TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type ?? "")) throw new ForbiddenException("Ce type d'établissement ne peut pas traiter d'ordonnance.");
    const prescription = await this.prisma.prescription.findUnique({ where: { id: prescriptionId }, select: { priseEnChargeId: true } });
    if (!prescription) throw new NotFoundException(`Bon ${prescriptionId} introuvable`);
    // Prix visibles ici : cette route est déjà réservée aux établissements
    // de type Pharmacie/Dépôt pharmaceutique (garde ci-dessus) — ce sont
    // eux qui délivrent réellement l'ordonnance et doivent en connaître le
    // prix pour la facturer.
    // `prestataire.id` en dernier argument (2026-09) — voir demande
    // utilisateur : "uniquement ce que le prestataire a réellement traité,
    // et non la totalité comme si c'est lui qui avait tout traité" — ce
    // document est CELUI DE ce prestataire précis (pendant qu'il traite le
    // bon), jamais la vue complète que voient le médecin ou l'assuré.
    // `secteur` transmis (2026-09) — voir demande utilisateur : "il faut
    // que l'application actualise les taux en fonction du type de
    // structure... même si à la base il avait été créé avec le taux de la
    // structure publique" — voir DocumentsService.genererFormulaire,
    // `secteurEffectif`.
    return this.documents.renderFeuilleSoinsLigne(prescription.priseEnChargeId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: !TYPES_TRAITANT_ORDONNANCE.includes(prestataire.type ?? "") }, { id: prestataire.id, nom: prestataire.nom, secteur: prestataire.secteur });
  }

  @Get("bons/:prescriptionId/feuille-examen")
  async feuilleExamenBon(@Param("prescriptionId") prescriptionId: string, @Req() req: PortailPrestataireRequest, @Res() res: Response) {
    const prestataire = await this.prisma.prestataire.findUniqueOrThrow({ where: { id: this.prestataireIdDe(req) } });
    if (!TYPES_TRAITANT_EXAMEN.includes(prestataire.type ?? "")) throw new ForbiddenException("Ce type d'établissement ne peut pas traiter de bon d'examen.");
    // Même principe que feuilleSoinsBon ci-dessus — uniquement les examens
    // que CE prestataire a lui-même traités.
    return this.documents.renderFeuilleExamenPrescription(prescriptionId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: true }, { id: prestataire.id, nom: prestataire.nom, secteur: prestataire.secteur });
  }

  @Post("bons/traiter")
  async traiterBon(@Body() dto: TraiterBonDto, @Req() req: PortailPrestataireRequest) {
    return this.prescriptions.traiter(this.prestataireIdDe(req), dto);
  }
}
