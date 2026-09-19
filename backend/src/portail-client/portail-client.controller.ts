import { Controller, ForbiddenException, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ContratsService } from "../contrats/contrats.service";
import { SanteService } from "../sante/sante.service";
import { StatistiquesService } from "../statistiques/statistiques.service";
import { DocumentsService } from "../documents/documents.service";
import { AvenantsService } from "../avenants/avenants.service";
import { FactureProductionService } from "../facture-production/facture-production.service";
import { RUBRIQUES_STATISTIQUES, type RubriqueId } from "../statistiques/statistiques.types";

type PortailRequest = Request & { user: { userId: string; roleId: string; clientId: string | null } };

// Rubriques du rapport Statistiques réservées à l'usage interne (courtier) —
// jamais exposées au portail client (2026-08, voir demande utilisateur :
// "toutes les rubriques jusqu'au S/P doivent apparaître côté client, sauf
// l'analyse") : seule l'analyse narrative (conclusions stratégiques
// internes) reste retirée, le S/P (sans/avec chargement) est bien montré au
// souscripteur. Voir StatistiquesService.calculer pour la forme complète du
// payload.
const RUBRIQUES_INTERNES_UNIQUEMENT = ["analyse"];

// Portail client (2026-08) — voir demande utilisateur : "un écran qui leur
// permettra de suivre la gestion de leur contrat maladie". Endpoints en
// lecture seule, systématiquement cloisonnés au Client rattaché à
// l'utilisateur connecté (User.clientId, voir schema.prisma) — jamais aux
// données d'un autre souscripteur.
@Controller("portail-client")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("client_entreprise", "client_particulier")
export class PortailClientController {
  constructor(
    private readonly contrats: ContratsService,
    private readonly sante: SanteService,
    private readonly statistiques: StatistiquesService,
    private readonly documents: DocumentsService,
    private readonly avenants: AvenantsService,
    private readonly facturesProduction: FactureProductionService,
  ) {}

  private clientIdDe(req: PortailRequest): string {
    if (!req.user.clientId) throw new ForbiddenException("Ce compte n'est rattaché à aucun souscripteur.");
    return req.user.clientId;
  }

  @Get("dashboard")
  async dashboard(@Req() req: PortailRequest) {
    const clientId = this.clientIdDe(req);
    const [contratsClient, assures] = await Promise.all([
      this.contrats.findAllForClient(clientId),
      this.sante.findAssuresForClient(clientId),
    ]);
    return { nombreContrats: contratsClient.length, nombreParticipants: assures.length };
  }

  // Compteur de prises en charge par rubrique (2026-08) — voir demande
  // utilisateur : "un compteur de prise en charges par rubrique... par an,
  // par mois". Agrégé sur tous les contrats du client (le tableau de bord
  // n'a pas de sélecteur de contrat).
  @Get("dashboard/prises-en-charge")
  async priseEnChargeParRubriqueDuClient(@Req() req: PortailRequest) {
    const clientId = this.clientIdDe(req);
    const contratsClient = await this.contrats.findAllForClient(clientId);
    return this.statistiques.comptagesPriseEnChargeParRubrique(contratsClient.map((c) => c.id));
  }

  @Get("contrats")
  contratsDuClient(@Req() req: PortailRequest) {
    return this.contrats.findAllForClient(this.clientIdDe(req));
  }

  @Get("contrats/:id")
  contratDuClient(@Param("id") id: string, @Req() req: PortailRequest) {
    return this.contrats.findOneForClient(id, this.clientIdDe(req));
  }

  @Get("participants")
  participantsDuClient(@Query("contratId") contratId: string | undefined, @Req() req: PortailRequest) {
    return this.sante.findAssuresForClient(this.clientIdDe(req), contratId);
  }

  // Liste des bénéficiaires imprimable/téléchargeable (2026-08) — voir
  // demande utilisateur : "la société doit pouvoir générer, télécharger et
  // imprimer la liste de ses bénéficiaires (liste totale, liste par type
  // de statut)". Réutilise DocumentsService.renderPopulationExport (même
  // rendu que "Liste des Assurés" côté interne), scopé au contrat du
  // client — jamais l'export interne brut, non cloisonné.
  @Get("contrats/:id/participants/document")
  async documentParticipantsDuContrat(
    @Param("id") id: string,
    @Query("statut") statut: string | undefined,
    @Query("format") format: string | undefined,
    @Req() req: PortailRequest,
    @Res() res: Response,
  ) {
    await this.contrats.findOneForClient(id, this.clientIdDe(req));
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    return this.documents.renderPopulationExport(id, fmt, res, { statut });
  }

  @Get("statistiques/:contratId")
  async statistiquesDuClient(
    @Param("contratId") contratId: string,
    @Query("du") du: string | undefined,
    @Query("au") au: string | undefined,
    @Req() req: PortailRequest,
  ) {
    await this.contrats.findOneForClient(contratId, this.clientIdDe(req));
    const payload = await this.statistiques.calculer(contratId, du, au);
    const payloadClient = { ...payload } as Record<string, unknown>;
    for (const rubrique of RUBRIQUES_INTERNES_UNIQUEMENT) delete payloadClient[rubrique];
    return payloadClient;
  }

  // Téléchargement PDF (2026-08) — voir demande utilisateur : "le client
  // doit pouvoir télécharger le fichier statistique en PDF le même que
  // l'assurance génère mais sans l'analyse". Réutilise
  // DocumentsService.renderStatistiques (même rendu que le module interne)
  // avec la liste complète des rubriques MOINS "analyse" — jamais l'export
  // interne brut (DocumentsController "/documents/statistiques/:id" n'a
  // aucune vérification de propriété, donc jamais exposé tel quel au portail).
  @Get("statistiques/:contratId/pdf")
  async statistiquesPdfDuClient(
    @Param("contratId") contratId: string,
    @Query("du") du: string | undefined,
    @Query("au") au: string | undefined,
    @Req() req: PortailRequest,
    @Res() res: Response,
  ) {
    await this.contrats.findOneForClient(contratId, this.clientIdDe(req));
    const rubriquesSansAnalyse = RUBRIQUES_STATISTIQUES.filter((r) => r !== "analyse") as RubriqueId[];
    return this.documents.renderStatistiques(contratId, du, au, "pdf", res, undefined, rubriquesSansAnalyse);
  }

  // Page dédiée "Détail du contrat" (2026-08) — voir demande utilisateur :
  // "une page dédiée permettant d'avoir la liste des mouvements faits dans
  // le contrat, l'affaire nouvelle, les avenants... un onglet pour les
  // factures de production émises... voir les données contractuelles par
  // exercice". Chaque route vérifie d'abord la propriété du contrat
  // (findOneForClient) avant de déléguer — jamais un accès direct aux
  // endpoints internes non cloisonnés (/avenants, /facture-production,
  // /documents/... n'ont aucune vérification de propriété, voir commentaire
  // plus haut sur statistiquesPdfDuClient).
  @Get("contrats/:id/avenants")
  async avenantsDuContrat(@Param("id") id: string, @Req() req: PortailRequest) {
    await this.contrats.findOneForClient(id, this.clientIdDe(req));
    return this.avenants.findByContrat(id);
  }

  @Get("contrats/:id/factures-production")
  async facturesProductionDuContrat(@Param("id") id: string, @Req() req: PortailRequest) {
    const clientId = this.clientIdDe(req);
    await this.contrats.findOneForClient(id, clientId);
    return this.facturesProduction.findAll({ clientId, contratId: id });
  }

  @Get("contrats/:id/exercices")
  async exercicesDuContrat(@Param("id") id: string, @Req() req: PortailRequest) {
    await this.contrats.findOneForClient(id, this.clientIdDe(req));
    return this.contrats.historiqueCompagnie(id);
  }

  // Documents de la mise en place du contrat (ligne "Affaire Nouvelle"
  // synthétique de l'onglet Mouvements — pas un Avenant en base, voir
  // HistoriqueMouvementsTab.tsx côté interne pour le même principe).
  @Get("contrats/:id/document")
  async documentContrat(
    @Param("id") id: string,
    @Query("type") type: "quittance" | "tableau-garanties" = "quittance",
    @Query("format") format: string | undefined,
    @Req() req: PortailRequest,
    @Res() res: Response,
  ) {
    await this.contrats.findOneForClient(id, this.clientIdDe(req));
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    // exemplaireClientSeul=true — voir demande utilisateur : "il ne faut
    // que l'application ne génère que l'exemplaire du client et non les
    // exemplaires comme du côté de l'assurance" (étendu au tableau de
    // garanties).
    if (type === "tableau-garanties") return this.documents.renderTableauGaranties(id, fmt, res, true);
    return this.documents.renderQuittance(id, fmt, res, true);
  }

  // Téléchargement de document rattaché à un avenant du contrat (Quittance
  // avenant / Avenant lui-même) — propriété vérifiée via avenant.contrat.clientId
  // (l'INCLUDE d'AvenantsService.findOne charge déjà le contrat).
  @Get("avenants/:avenantId/document")
  async documentAvenant(
    @Param("avenantId") avenantId: string,
    @Query("type") type: "avenant" | "quittance" = "avenant",
    @Query("format") format: string | undefined,
    @Req() req: PortailRequest,
    @Res() res: Response,
  ) {
    const clientId = this.clientIdDe(req);
    const avenant = await this.avenants.findOne(avenantId);
    if (avenant.contrat.clientId !== clientId) throw new ForbiddenException(`Avenant ${avenantId} inaccessible`);
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    // exemplaireClientSeul=true — voir demande utilisateur : "pour les
    // quittances et les avenants... que l'exemplaire du client".
    if (type === "quittance") return this.documents.renderQuittanceAvenant(avenantId, fmt, res, true);
    return this.documents.renderAvenant(avenantId, fmt, res, true);
  }

  // Téléchargement d'une facture de production — FactureProduction porte
  // clientId directement (pas besoin de remonter par le contrat).
  @Get("factures-production/:id/document")
  async documentFactureProduction(@Param("id") id: string, @Req() req: PortailRequest, @Res() res: Response) {
    const clientId = this.clientIdDe(req);
    const facture = await this.facturesProduction.findOne(id);
    if (facture.clientId !== clientId) throw new ForbiddenException(`Facture ${id} inaccessible`);
    return this.documents.renderFactureProduction(id, res);
  }
}
