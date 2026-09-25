import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { SanteService } from "../sante/sante.service";
import { AccordPrealableService } from "../accord-prealable/accord-prealable.service";
import { DocumentsService } from "../documents/documents.service";
import { MessagerieAgentIaService } from "../messagerie/agent-ia.service";
import { DelegationsFamilleService } from "./delegations-famille.service";
import { CreateAccordPrealableMembreDto } from "./dto/create-accord-prealable-membre.dto";
import { UpdateInformationsMedicalesDto } from "./dto/update-informations-medicales.dto";
import { CreateRemboursementMembreDto } from "./dto/create-remboursement-membre.dto";
import { GrantDelegationDto } from "./dto/grant-delegation.dto";
import { UpdateDelegationModulesDto } from "./dto/update-delegation-modules.dto";
import { resoudreCategorieConsommation, resoudreExercice } from "./portail-membre.util";
import { RUBRIQUES_PLAFONNEES } from "../sante/dto/create-facture-ligne.dto";
import { CarnetSanteService } from "./carnet-sante.service";
import { PushNotificationsService } from "../notifications/push-notifications.service";

type PortailMembreRequest = Request & { user: { userId: string; nom: string; roleId: string; assureSanteId: string | null } };

// Portail assuré (2026-08) — voir demande utilisateur : "écran externe
// dédié à l'assuré principal". Endpoints en lecture/écriture systématiquement
// cloisonnés à l'AssureSante rattaché à l'utilisateur connecté
// (User.assureSanteId, voir schema.prisma) — jamais aux données d'un autre
// assuré/famille. Même patron que PortailClientController (façade fine,
// aucune logique métier dupliquée, délègue aux services internes existants).
@Controller("portail-membre")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assure_principal")
export class PortailMembreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sante: SanteService,
    private readonly accordPrealable: AccordPrealableService,
    private readonly documents: DocumentsService,
    private readonly delegations: DelegationsFamilleService,
    private readonly carnetSante: CarnetSanteService,
    private readonly agentIa: MessagerieAgentIaService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  private assureSanteIdDe(req: PortailMembreRequest): string {
    if (!req.user.assureSanteId) throw new ForbiddenException("Ce compte n'est rattaché à aucun assuré.");
    return req.user.assureSanteId;
  }

  private async idsFamilleDe(assureSanteId: string): Promise<string[]> {
    const membres = await this.prisma.assureSante.findMany({ where: { familleId: assureSanteId } });
    return [assureSanteId, ...membres.map((m) => m.id)];
  }

  // Jeton Expo Push (2026-09) — voir demande utilisateur : "l'application
  // mobile doit pouvoir activer les notifications... afin que l'assuré soit
  // informé des nouvelles entrées même quand il n'est pas dans
  // l'application". Enregistré/écrasé à chaque connexion mobile réussie
  // (voir mobile/src/utils/pushNotifications.ts) — un seul jeton par
  // compte pour l'instant (voir User.pushToken).
  @Post("push-token")
  async enregistrerPushToken(@Body() body: { token?: string }, @Req() req: PortailMembreRequest) {
    const token = (body.token ?? "").trim();
    if (!token) throw new BadRequestException("Jeton manquant.");
    await this.prisma.user.update({ where: { id: req.user.userId }, data: { pushToken: token } });
    return { ok: true };
  }

  // Seul l'assuré principal RACINE (familleId null) peut gérer les accès de
  // sa famille (2026-08) — voir demande utilisateur. Un ayant droit délégué
  // partage le même roleId "assure_principal" côté auth mais ne voit jamais
  // "membreDelegations" dans son menu (jamais accordable, voir
  // DelegationsFamilleService.MODULES_DELEGABLES) ; ce contrôle serveur est
  // la vraie barrière, le menu n'est qu'un confort d'affichage.
  private async verifierEstAssurePrincipal(assureSanteId: string): Promise<void> {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureSanteId } });
    if (!assure || assure.familleId) throw new ForbiddenException("Seul l'assuré principal peut gérer les accès de sa famille.");
  }

  private async mesModules(userId: string): Promise<string[]> {
    const moi = await this.prisma.user.findUnique({ where: { id: userId }, select: { modules: true } });
    return moi?.modules ?? [];
  }

  @Get("delegations")
  async delegationsListe(@Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    await this.verifierEstAssurePrincipal(assureSanteId);
    return this.delegations.lister(assureSanteId);
  }

  @Get("delegations/modules-disponibles")
  async delegationsModulesDisponibles(@Req() req: PortailMembreRequest) {
    await this.verifierEstAssurePrincipal(this.assureSanteIdDe(req));
    return this.delegations.modulesDisponibles(await this.mesModules(req.user.userId));
  }

  @Post("delegations/:id")
  async delegationsAccorder(@Param("id") id: string, @Body() dto: GrantDelegationDto, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    await this.verifierEstAssurePrincipal(assureSanteId);
    return this.delegations.accorder(assureSanteId, await this.mesModules(req.user.userId), id, dto);
  }

  @Patch("delegations/:id/modules")
  async delegationsModifierModules(@Param("id") id: string, @Body() dto: UpdateDelegationModulesDto, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    await this.verifierEstAssurePrincipal(assureSanteId);
    return this.delegations.modifierModules(assureSanteId, await this.mesModules(req.user.userId), id, dto.modules);
  }

  @Delete("delegations/:id")
  async delegationsRevoquer(@Param("id") id: string, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    await this.verifierEstAssurePrincipal(assureSanteId);
    return this.delegations.revoquer(assureSanteId, id);
  }

  @Get("moi")
  async moi(@Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    const assure = await this.prisma.assureSante.findUnique({
      where: { id: assureSanteId },
      include: { contrat: { include: { client: true, compagnie: true } } },
    });
    if (!assure) throw new NotFoundException("Assuré introuvable");
    return assure;
  }

  // Informations médicales d'urgence (2026-09) — voir demande utilisateur :
  // enrichir l'E-carnet Santé avec une fiche d'urgence — aucun nom de
  // produit concurrent ne doit apparaître nulle part sur la plateforme,
  // voir demande utilisateur explicite. "E-carnet Santé" reste le seul nom
  // d'écran ; ceci n'en est qu'une section.
  // Lecture déjà couverte par GET "moi" ci-dessus (l'AssureSante complet
  // inclut ces champs) — seule l'écriture avait besoin d'une route dédiée,
  // restreinte à SON PROPRE dossier (jamais celui d'un tiers).
  @Patch("informations-medicales")
  async modifierInformationsMedicales(@Body() dto: UpdateInformationsMedicalesDto, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    return this.prisma.assureSante.update({ where: { id: assureSanteId }, data: dto });
  }

  // Tableau de bord (2026-08, refonte) — voir demande utilisateur : "la page
  // d'accueil devra être également un tableau de bord qui fait remonter les
  // données statistiques de consommation de toute la famille pour l'assuré
  // principal, et de l'ayant droit dans son compte. L'ayant droit ne doit
  // voir que ce que l'assuré principal lui aurait permis de voir." Le
  // périmètre famille/soi-même n'a besoin d'aucune logique dédiée : idsFamilleDe
  // résout naturellement à [soi-même] pour un ayant droit délégué (qui n'a
  // pas lui-même d'ayants droit), et à [soi-même, + tous les ayants droit]
  // pour l'assuré principal — même mécanisme déjà utilisé par
  // prisesEnCharge() ci-dessus. La rubrique "membreDelegations" (invisible
  // à un ayant droit, jamais accordable) est ce qui empêche par ailleurs un
  // ayant droit de gérer les accès des autres, indépendamment de ce scope.
  @Get("dashboard")
  async dashboard(@Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    const [assure, idsFamille] = await Promise.all([
      this.prisma.assureSante.findUnique({ where: { id: assureSanteId }, include: { contrat: { include: { garanties: true } } } }),
      this.idsFamilleDe(assureSanteId),
    ]);
    if (!assure) throw new NotFoundException("Assuré introuvable");

    const [pecEnAttente, dernierRemboursement, lignes] = await Promise.all([
      this.prisma.accordPrealable.count({ where: { assureId: { in: idsFamille }, decision: "En attente" } }),
      this.prisma.priseEnCharge.findFirst({ where: { assureId: { in: idsFamille }, modePaiement: "Remboursement" }, orderBy: { date: "desc" } }),
      this.sante.findPrisesEnCharge(idsFamille),
    ]);

    let totalConsommation = 0;
    let totalRembourse = 0;
    const parBeneficiaireMap = new Map<string, { assureId: string; nom: string; total: number }>();
    const parRubriqueMap = new Map<string, number>();
    for (const l of lignes) {
      const montant = Number(l.montant);
      totalConsommation += montant;
      if (l.baseRemboursement != null) totalRembourse += Number(l.baseRemboursement);

      const nomBeneficiaire = `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim();
      const entree = parBeneficiaireMap.get(l.assureId) ?? { assureId: l.assureId, nom: nomBeneficiaire, total: 0 };
      entree.total += montant;
      parBeneficiaireMap.set(l.assureId, entree);

      const rubrique = resoudreCategorieConsommation(assure.contrat.garanties, l.type, l.acteMedical);
      parRubriqueMap.set(rubrique, (parRubriqueMap.get(rubrique) ?? 0) + montant);
    }

    return {
      nom: assure.nom, prenom: assure.prenom, statutCarte: assure.statutCarte,
      priseEnChargeEnAttente: pecEnAttente, dernierRemboursement,
      estAssurePrincipal: !assure.familleId,
      totalConsommation, totalRembourse,
      parBeneficiaire: [...parBeneficiaireMap.values()].sort((a, b) => b.total - a.total),
      parRubrique: [...parRubriqueMap.entries()].map(([rubrique, total]) => ({ rubrique, total })).sort((a, b) => b.total - a.total),
    };
  }

  // Carte d'un membre de la famille (2026-08) — voir demande utilisateur :
  // "il faut les cartes de toute la famille". Accessible pour SOI-MÊME ou
  // pour un ayant droit dont familleId === son propre assureSanteId, jamais
  // pour un tiers hors de sa famille.
  @Get("carte/:assureId")
  async carte(@Param("assureId") assureId: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    const assureSanteId = this.assureSanteIdDe(req);
    if (assureId !== assureSanteId) {
      const cible = await this.prisma.assureSante.findUnique({ where: { id: assureId } });
      if (!cible || cible.familleId !== assureSanteId) throw new ForbiddenException(`Carte ${assureId} inaccessible`);
    }
    return this.documents.renderCarteUnique(assureId, res);
  }

  @Get("garanties")
  async garanties(@Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    const assure = await this.prisma.assureSante.findUnique({
      where: { id: assureSanteId },
      include: { contrat: { include: { garanties: true } } },
    });
    if (!assure) throw new NotFoundException("Assuré introuvable");
    return assure.contrat.garanties.map((g) => ({
      ...g,
      tauxApplicable: assure.typeAssure === "AS" ? g.tauxAssure : g.tauxAyantsDroit,
    }));
  }

  @Get("famille")
  async famille(@Req() req: PortailMembreRequest) {
    return this.prisma.assureSante.findMany({ where: { familleId: this.assureSanteIdDe(req) }, orderBy: { dateNaissance: "asc" } });
  }

  // Historique des consommations de TOUTE LA FAMILLE (2026-08) — voir
  // demande utilisateur : "l'historique des consommations doit être rangé
  // par rubrique, par exercice et même par bénéficiaire dans la famille" —
  // l'assuré principal est financièrement responsable du foyer, il voit
  // donc aussi les consommations de ses ayants droit, pas seulement les
  // siennes. `rubrique`/`exercice` résolus côté serveur (même heuristique
  // que ConsommationsTab.tsx interne) pour que le frontend n'ait rien à
  // deviner.
  @Get("prises-en-charge")
  async prisesEnCharge(@Query("modePaiement") modePaiement: string | undefined, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    const [assure, idsFamille] = await Promise.all([
      this.prisma.assureSante.findUnique({ where: { id: assureSanteId }, include: { contrat: { include: { garanties: true, exercices: true } } } }),
      this.idsFamilleDe(assureSanteId),
    ]);
    if (!assure) throw new NotFoundException("Assuré introuvable");
    const lignes = await this.sante.findPrisesEnCharge(idsFamille);
    const filtrees = modePaiement ? lignes.filter((l) => l.modePaiement === modePaiement) : lignes;
    const enrichies = filtrees.map((l) => ({
      ...l,
      rubrique: resoudreCategorieConsommation(assure.contrat.garanties, l.type, l.acteMedical),
      exercice: resoudreExercice(assure.contrat.exercices, l.date),
      acteLibelle: l.acteMedical?.libelle ?? null,
      // acteFamille (2026-08) — voir demande utilisateur : "chaque fiche de
      // consultation génère aussi une feuille de soins et chaque saisie
      // d'un examen... génère une feuille d'examen" : le frontend en a
      // besoin pour savoir laquelle des deux proposer par ligne (voir
      // GROUPES_ACTES, Historique.tsx).
      acteFamille: l.acteMedical?.famille ?? null,
    }));

    // Regroupement par facture + rubrique (2026-08) — voir demande
    // utilisateur : "dans le cas où une facture a plusieurs actes de même
    // famille, il n'est pas nécessaire de l'éclater. On pourra voir la
    // liste des actes dans les détails en cliquant sur 'Voir le détail'."
    // Uniquement pour les lignes rattachées à une VRAIE Facture (tiers
    // payant) — une ligne de Remboursement, sans factureId, reste seule.
    const groupes = new Map<string, typeof enrichies>();
    const ordre: string[] = [];
    for (const l of enrichies) {
      // assureId dans la clé (2026-08) — une facture peut en théorie porter
      // des lignes de PLUSIEURS bénéficiaires de la famille ; ne jamais
      // fusionner celles de deux personnes différentes même si même
      // facture + même rubrique.
      const cle = l.factureId ? `${l.factureId}|${l.assureId}|${l.rubrique}` : `seule|${l.id}`;
      if (!groupes.has(cle)) { groupes.set(cle, []); ordre.push(cle); }
      groupes.get(cle)!.push(l);
    }
    return ordre.map((cle) => {
      const items = groupes.get(cle)!;
      if (items.length === 1) return items[0];
      const premiere = items[0];
      return {
        ...premiere,
        id: cle,
        montant: items.reduce((s, x) => s + Number(x.montant), 0),
        baseRemboursement: items.some((x) => x.baseRemboursement != null) ? items.reduce((s, x) => s + Number(x.baseRemboursement ?? 0), 0) : null,
        resteACharge: items.some((x) => x.resteACharge != null) ? items.reduce((s, x) => s + Number(x.resteACharge ?? 0), 0) : null,
        acteLibelle: null,
        lignes: items,
      };
    });
  }

  // Décompte de remboursement (2026-08) — voir demande utilisateur : "les
  // documents... de remboursement générés depuis l'écran de l'assurance
  // doivent remonter systématiquement côté portail assuré principal". Une
  // ligne tiers payant traitée en interne (FactureSaisie.tsx) rattache une
  // Facture qui regroupe potentiellement d'AUTRES bénéficiaires — on ne
  // délègue donc jamais le factureId brut au frontend : on vérifie ici que
  // la ligne appartient à la famille, puis on demande à DocumentsService de
  // n'imprimer QUE la page de cet assuré (voir renderDecompteFacture,
  // paramètre assureIdFiltre), jamais celle des autres bénéficiaires de la
  // même facture.
  @Get("prises-en-charge/:id/decompte")
  async decompte(@Param("id") id: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    const assureSanteId = this.assureSanteIdDe(req);
    const idsFamille = await this.idsFamilleDe(assureSanteId);
    const pec = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!pec || !idsFamille.includes(pec.assureId)) throw new ForbiddenException(`Prise en charge ${id} inaccessible`);
    if (!pec.factureId) throw new NotFoundException("Aucun décompte disponible pour cette ligne.");
    return this.documents.renderDecompteFacture(pec.factureId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId }, pec.assureId, "Assuré");
  }

  // Feuille de soins / feuille d'examen (2026-08) — voir demande
  // utilisateur : "le but est de dématérialiser cela" : l'assuré peut lui
  // aussi télécharger/imprimer sa propre feuille, même vérification de
  // propriété que le décompte ci-dessus.
  @Get("prises-en-charge/:id/feuille-soins")
  async feuilleSoins(@Param("id") id: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    const idsFamille = await this.idsFamilleDe(this.assureSanteIdDe(req));
    const pec = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!pec || !idsFamille.includes(pec.assureId)) throw new ForbiddenException(`Prise en charge ${id} inaccessible`);
    return this.documents.renderFeuilleSoinsLigne(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("prises-en-charge/:id/feuille-examen")
  async feuilleExamen(@Param("id") id: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    const idsFamille = await this.idsFamilleDe(this.assureSanteIdDe(req));
    const pec = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!pec || !idsFamille.includes(pec.assureId)) throw new ForbiddenException(`Prise en charge ${id} inaccessible`);
    return this.documents.renderFeuilleExamenLigne(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  // Bon d'examen issu du médecin prescripteur (2026-08) — voir demande
  // utilisateur (E-carnet Santé) : "la référence du bon... le statut du
  // bon". Contrairement à feuille-examen ci-dessus (agrégat "même
  // facture"), un bon d'examen prescrit est identifié par sa Prescription,
  // pas par une PriseEnCharge — même méthode de rendu que le portail
  // médecin (renderFeuilleExamenPrescription).
  @Get("carnet-sante/bons/:prescriptionId/feuille-examen")
  async feuilleExamenBon(@Param("prescriptionId") prescriptionId: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    const idsFamille = await this.idsFamilleDe(this.assureSanteIdDe(req));
    const prescription = await this.prisma.prescription.findUnique({ where: { id: prescriptionId }, include: { priseEnCharge: true } });
    if (!prescription || !idsFamille.includes(prescription.priseEnCharge.assureId)) throw new ForbiddenException(`Bon ${prescriptionId} inaccessible`);
    return this.documents.renderFeuilleExamenPrescription(prescriptionId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  // Toute la famille, pas seulement soi-même (2026-09) — voir demande
  // utilisateur : "même les prises en charge (entente préalable) qui n'ont
  // pas été demandées via l'application mobile ou le portail web destiné à
  // l'assuré doivent remonter... si ça concerne l'assuré et ses ayants
  // droit" — même mécanisme que prisesEnCharge() (historique) ci-dessous,
  // idsFamilleDe résout à [soi-même] pour un ayant droit délégué.
  @Get("accords-prealables")
  async accordsPrealables(@Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    const idsFamille = await this.idsFamilleDe(assureSanteId);
    return this.accordPrealable.findAll({ assureIds: idsFamille });
  }

  // Certificat de prise en charge (2026-08) — voir demande utilisateur : "les
  // documents de prise en charge... générés depuis l'écran de l'assurance
  // doivent remonter systématiquement côté portail assuré principal". Même
  // PDF que le bouton "Certificat de prise en charge" côté interne
  // (accord-prealable/index.tsx), sans restriction sur la décision — le
  // gestionnaire l'imprime déjà sans condition, on garde la même règle ici.
  @Get("accords-prealables/:id/certificat")
  async certificat(@Param("id") id: string, @Req() req: PortailMembreRequest, @Res() res: Response) {
    await this.verifierAccordAppartientA(id, await this.idsFamilleDe(this.assureSanteIdDe(req)));
    return this.documents.renderCertificatPriseEnCharge(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Post("accords-prealables")
  async creerAccordPrealable(@Body() dto: CreateAccordPrealableMembreDto, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    // La saisie de l'acte est facultative (2026-08) — voir demande
    // utilisateur : "la saisie de l'acte doit être facultative dans la
    // mesure où la validation doit se faire côté assurance". Quand des
    // lignes sont fournies, AccordPrealableService.create en dérive la
    // description ; sinon on retombe sur le type de demande
    // (Hospitalisation/Chirurgie/EVASAN), plus parlant qu'une chaîne vide
    // dans la liste interne des dossiers et sur le certificat.
    const cree = await this.accordPrealable.create({ ...dto, description: dto.description || dto.type, assureId: assureSanteId, origine: "Portail Assuré" });
    // Déclenchement automatique (2026-08) — voir demande utilisateur : "dès
    // qu'une nouvelle demande Hospitalisation est créée depuis le portail,
    // ouvrir/relancer automatiquement une conversation IA qui demande
    // directement les deux pièces à l'assuré". Best-effort, ne doit jamais
    // faire échouer la création du dossier elle-même.
    if (dto.type === "Hospitalisation") {
      this.agentIa.demarrerDemandeHospitalisation(req.user.userId, { id: cree.id, prestataire: dto.prestataire }).catch(() => undefined);
    } else if (RUBRIQUES_PLAFONNEES.includes(dto.type)) {
      // Même déclenchement automatique, mais pour les garanties plafonnées
      // (2026-08) — voir demande utilisateur : "L'assuré... fait des
      // demande pour les autres types de garanties (Optique, Dentisterie,
      // Kinesithérapie, ...) Et il joints le devis et la prescription
      // (ordonnance)".
      this.agentIa.demarrerDemandeGarantie(req.user.userId, { id: cree.id, type: dto.type, prestataire: dto.prestataire }).catch(() => undefined);
    }
    return cree;
  }

  // Vérification par FAMILLE, pas par égalité stricte (2026-09) — voir
  // demande utilisateur : "la prise en charge faite directement par l'agent
  // de saisie ne s'ouvre pas dans l'application mobile de l'assuré". Un
  // agent interne peut saisir une PEC pour n'importe quel ayant droit de la
  // famille (voir src/features/accord-prealable/index.tsx) ; le compte
  // portail/mobile connecté est celui de l'assuré PRINCIPAL, dont
  // assureSanteId ne correspond jamais à celui d'un enfant/conjoint. La
  // comparaison stricte `accord.assureId !== assureSanteId` rejetait donc à
  // tort ces dossiers (ForbiddenException) alors qu'ils remontaient bien
  // dans la liste (accordsPrealables() ci-dessus, déjà correcte). Même
  // correction que decompte()/feuilleSoins()/feuilleExamen() ci-dessus —
  // idsFamille résolu UNE fois par l'appelant, jamais recalculé ici.
  private async verifierAccordAppartientA(id: string, idsFamille: string[]) {
    const accord = await this.accordPrealable.findOne(id);
    if (!idsFamille.includes(accord.assureId)) throw new ForbiddenException(`Dossier ${id} inaccessible`);
  }

  @Post("accords-prealables/:id/ordonnance")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploaderOrdonnance(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Req() req: PortailMembreRequest) {
    await this.verifierAccordAppartientA(id, await this.idsFamilleDe(this.assureSanteIdDe(req)));
    return this.accordPrealable.uploadDocument(id, "ordonnance", file);
  }

  @Post("accords-prealables/:id/devis")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploaderDevis(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Req() req: PortailMembreRequest) {
    await this.verifierAccordAppartientA(id, await this.idsFamilleDe(this.assureSanteIdDe(req)));
    return this.accordPrealable.uploadDocument(id, "devis", file);
  }

  // Prestataire/type/montant facultatifs (2026-08) — voir demande
  // utilisateur : "en ce qui concerne le remboursement seul les pièces
  // doivent être jointes". Valeurs de repli neutres tant que le
  // gestionnaire n'a pas encore examiné les justificatifs (voir
  // uploaderDocumentRemboursement, appelé juste après par le frontend) —
  // il les corrigera à la prise en charge du dossier (écran interne
  // Remboursements, prises-en-charge/index.tsx).
  @Post("remboursements")
  async creerRemboursement(@Body() dto: CreateRemboursementMembreDto, @Req() req: PortailMembreRequest) {
    const assureSanteId = this.assureSanteIdDe(req);
    // Bénéficiaire réel des frais (2026-09) — voir demande utilisateur : "on
    // puisse clairement indiquer pour qui dans la famille on a engagé les
    // frais". Même règle d'accès que "Ma carte" (carte/:assureId ci-dessus) :
    // soi-même, ou un ayant droit dont familleId === son propre id — jamais
    // un tiers hors famille, quoi que le client envoie.
    let beneficiaireId = assureSanteId;
    if (dto.beneficiaireId && dto.beneficiaireId !== assureSanteId) {
      const cible = await this.prisma.assureSante.findUnique({ where: { id: dto.beneficiaireId } });
      if (!cible || cible.familleId !== assureSanteId) throw new ForbiddenException(`Bénéficiaire ${dto.beneficiaireId} inaccessible`);
      beneficiaireId = dto.beneficiaireId;
    }
    const { beneficiaireId: _ignore, ...reste } = dto;
    return this.sante.createPriseEnCharge({
      ...reste,
      prestataire: dto.prestataire || "À préciser",
      type: dto.type || "Remboursement",
      montant: dto.montant ?? 0,
      assureId: beneficiaireId,
      modePaiement: "Remboursement",
    });
  }

  @Post("remboursements/:id/document")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploaderDocumentRemboursement(
    @Param("id") id: string,
    @Query("type") type: "prescription" | "facture" | "quittance" | "autre",
    @UploadedFile() file: Express.Multer.File,
    @Req() req: PortailMembreRequest,
  ) {
    const assureSanteId = this.assureSanteIdDe(req);
    const pec = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!pec || pec.assureId !== assureSanteId) throw new ForbiddenException(`Remboursement ${id} inaccessible`);
    return this.sante.uploadRemboursementDocument(id, type, file);
  }

  // E-carnet Santé (2026-08) — voir demande utilisateur : "il faut créer
  // dans le compte assuré une rubrique appelée E-carnet Santé... l'assuré
  // pourra lui-même filmer [photographier]... l'application doit
  // fonctionner comme des scan existant dans les téléphones mobiles pour
  // créer systématiquement des documents au format pdf." Peut filer un
  // document pour soi-même OU un ayant droit de sa famille (même règle que
  // le reste du portail membre) — `assureId` du body, replié sur soi-même
  // si absent.
  @Post("carnet-sante")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async ajouterCarnetSante(
    @Body("rubrique") rubrique: string,
    @Body("libelle") libelle: string | undefined,
    @Body("assureId") assureIdCible: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: PortailMembreRequest,
  ) {
    const assureSanteId = this.assureSanteIdDe(req);
    const idsFamille = await this.idsFamilleDe(assureSanteId);
    const cible = assureIdCible || assureSanteId;
    if (!idsFamille.includes(cible)) throw new ForbiddenException(`Assuré ${cible} inaccessible`);
    return this.carnetSante.ajouter(cible, rubrique, file, libelle);
  }

  @Get("carnet-sante")
  async listeCarnetSante(@Query("rubrique") rubrique: string | undefined, @Req() req: PortailMembreRequest) {
    const idsFamille = await this.idsFamilleDe(this.assureSanteIdDe(req));
    return this.carnetSante.liste(idsFamille, rubrique);
  }

  @Delete("carnet-sante/:id")
  async supprimerCarnetSante(@Param("id") id: string, @Req() req: PortailMembreRequest) {
    const idsFamille = await this.idsFamilleDe(this.assureSanteIdDe(req));
    await this.carnetSante.supprimer(id, idsFamille);
    return { ok: true };
  }
}
