import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { DocumentsService } from "./documents.service";
import { GenererCartesDto } from "./dto/generer-cartes.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RubriqueId } from "../statistiques/statistiques.types";

type StaffRequest = Request & { user: { userId: string; nom: string; roleId: string } };

// Usage INTERNE (non cloisonné) — voir demande utilisateur : jamais exposé
// tel quel au portail client (voir PortailClientController, qui vérifie la
// propriété du contrat avant de déléguer aux mêmes méthodes). `exemplaireClientSeul`
// reste toujours false ici — les 4 exemplaires internes, comme d'origine.
@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("quittance/:contratId")
  quittance(@Param("contratId") contratId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderQuittance(contratId, format ?? "pdf", res);
  }

  @Get("quittance-avenant/:avenantId")
  quittanceAvenant(@Param("avenantId") avenantId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderQuittanceAvenant(avenantId, format ?? "pdf", res);
  }

  @Get("tableau-garanties/:contratId")
  tableauGaranties(@Param("contratId") contratId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderTableauGaranties(contratId, format ?? "pdf", res);
  }

  @Get("avenant/:avenantId")
  avenant(@Param("avenantId") avenantId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderAvenant(avenantId, format ?? "pdf", res);
  }

  @Get("carte/:assureId")
  carteUnique(@Param("assureId") assureId: string, @Res() res: Response) {
    return this.documentsService.renderCarteUnique(assureId, res);
  }

  @Post("cartes")
  cartesEnMasse(@Body() dto: GenererCartesDto, @Res() res: Response) {
    return this.documentsService.renderCartesEnMasse(dto, res);
  }

  // Rapport Statistiques — voir demande utilisateur : "l'application doit
  // permettre de sélectionner les rubriques que l'on veut voir apparaître
  // sur le fichier à télécharger". En POST (pas GET) : l'analyse narrative
  // peut être éditée à l'écran avant téléchargement (voir features/
  // statistiques/index.tsx, `analyseEdite`) — un objet complet, trop
  // volumineux/structuré pour une query string.
  @Post("statistiques/:contratId")
  statistiques(
    @Param("contratId") contratId: string,
    @Body() body: { du?: string; au?: string; format?: string; rubriques?: RubriqueId[]; analyse?: import("../statistiques/statistiques.types").AnalyseNarrative },
    @Res() res: Response,
  ) {
    return this.documentsService.renderStatistiques(contratId, body.du, body.au, body.format === "docx" ? "docx" : "pdf", res, body.analyse, body.rubriques);
  }

  @Get("feuille-soins/:priseEnChargeId")
  feuilleSoins(@Param("priseEnChargeId") id: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderFeuilleSoinsLigne(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("feuille-examen/:priseEnChargeId")
  feuilleExamen(@Param("priseEnChargeId") id: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderFeuilleExamenLigne(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("certificat-prise-en-charge/:accordId")
  certificat(@Param("accordId") id: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderCertificatPriseEnCharge(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("decompte/:factureId")
  decompte(
    @Param("factureId") factureId: string, @Query("assureId") assureId: string | undefined, @Req() req: StaffRequest, @Res() res: Response,
  ) {
    return this.documentsService.renderDecompteFacture(factureId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId }, assureId);
  }

  @Get("releve-prestataire/:releveId")
  relevePrestataire(@Param("releveId") id: string, @Query("format") format: string | undefined, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderRelevePrestataire(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId }, format === "xlsx" ? "xlsx" : "pdf");
  }

  @Get("facture-production/:id")
  factureProduction(@Param("id") id: string, @Res() res: Response) {
    return this.documentsService.renderFactureProduction(id, res);
  }

  @Get("population/:contratId")
  population(
    @Param("contratId") contratId: string, @Query("format") format: string | undefined, @Query("statut") statut: string | undefined, @Res() res: Response,
  ) {
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    return this.documentsService.renderPopulationExport(contratId, fmt, res, { statut });
  }

  @Get("bordereau-sinistres")
  bordereauSinistres(
    @Query("du") du: string | undefined, @Query("au") au: string | undefined, @Query("compagnieId") compagnieId: string | undefined,
    @Query("typeReglement") typeReglement: string | undefined, @Query("format") format: string | undefined, @Res() res: Response,
  ) {
    return this.documentsService.renderBordereauSinistres(du, au, compagnieId, typeReglement === "comptable" ? "comptable" : "maladie", format === "xlsx" ? "xlsx" : "pdf", res);
  }

  @Get("bordereau-production")
  bordereauProduction(
    @Query("du") du: string | undefined, @Query("au") au: string | undefined, @Query("compagnieId") compagnieId: string | undefined,
    @Query("format") format: string | undefined, @Res() res: Response,
  ) {
    return this.documentsService.renderBordereauProduction(du, au, compagnieId, format === "xlsx" ? "xlsx" : "pdf", res);
  }

  @Get("bordereau-encaissement")
  bordereauEncaissement(
    @Query("du") du: string | undefined, @Query("au") au: string | undefined, @Query("compagnieId") compagnieId: string | undefined,
    @Query("format") format: string | undefined, @Res() res: Response,
  ) {
    return this.documentsService.renderBordereauEncaissement(du, au, compagnieId, format === "xlsx" ? "xlsx" : "pdf", res);
  }

  @Post("cotation-offre")
  cotationOffre(@Body() body: { cotationIds: string[] }, @Res() res: Response) {
    return this.documentsService.renderCotationOffre(body.cotationIds, res);
  }

  @Get("reseau-soins")
  reseauSoins(@Res() res: Response) {
    return this.documentsService.renderReseauSoins(res);
  }

  @Get("fiche-prestataire/:id")
  fichePrestataire(@Param("id") id: string, @Res() res: Response) {
    return this.documentsService.renderFichePrestataire(id, res);
  }

  @Get("courrier/:id")
  courrier(@Param("id") id: string, @Res() res: Response) {
    return this.documentsService.renderCourrier(id, res);
  }

  @Get("tableau-prospection")
  tableauProspection(@Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderTableauProspection(format === "xlsx" ? "xlsx" : "pdf", res);
  }

  @Get("etat-tps")
  etatTps(
    @Query("prestataireId") prestataireId: string | undefined, @Query("annee") annee: string | undefined,
    @Query("du") du: string | undefined, @Query("au") au: string | undefined, @Res() res: Response,
  ) {
    return this.documentsService.renderEtatTps({ prestataireId, annee, du, au }, res);
  }

  @Get("liste-prestataires-tps")
  listePrestatairesTps(@Res() res: Response) {
    return this.documentsService.renderListePrestatairesTps(res);
  }

  @Get("lettre-cheque/:id")
  lettreCheque(@Param("id") id: string, @Res() res: Response) {
    return this.documentsService.renderLettreCheque(id, res);
  }

  @Get("reglement/:id")
  reglement(@Param("id") id: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderReglement(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("historique-reglements")
  historiqueReglements(
    @Query("prestataireId") prestataireId: string | undefined, @Query("du") du: string | undefined, @Query("au") au: string | undefined,
    @Query("numeroReglement") numeroReglement: string | undefined, @Query("referenceDecompte") referenceDecompte: string | undefined,
    @Query("assure") assure: string | undefined, @Query("referenceReglementComptable") referenceReglementComptable: string | undefined,
    @Query("format") format: string | undefined, @Res() res: Response,
  ) {
    return this.documentsService.renderHistoriqueReglements({ prestataireId, du, au, numeroReglement, referenceDecompte, assure, referenceReglementComptable }, format === "xlsx" ? "xlsx" : "pdf", res);
  }

  @Get("avis-echeance/:clientId")
  avisEcheance(@Param("clientId") clientId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    return this.documentsService.renderAvisEcheance(clientId, format === "docx" ? "docx" : "pdf", res);
  }

  @Get("accords-prealables/:contratId")
  accordsPrealablesExport(@Param("contratId") contratId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    return this.documentsService.renderAccordPrealableExport(contratId, fmt, res);
  }

  @Get("consommations/:contratId")
  consommationsExport(@Param("contratId") contratId: string, @Query("format") format: string | undefined, @Res() res: Response) {
    const fmt = format === "xlsx" || format === "docx" ? format : "pdf";
    return this.documentsService.renderConsommationsExport(contratId, fmt, res);
  }

  @Get("quittance-tranche/:trancheId")
  quittanceTranche(@Param("trancheId") trancheId: string, @Res() res: Response) {
    return this.documentsService.renderQuittanceTranche(trancheId, res);
  }

  @Get("assures/:assureId/feuille-soins")
  feuilleSoinsDeAssure(@Param("assureId") assureId: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderFeuilleSoinsDeAssure(assureId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }

  @Get("assures/:assureId/feuille-examen")
  feuilleExamenDeAssure(@Param("assureId") assureId: string, @Req() req: StaffRequest, @Res() res: Response) {
    return this.documentsService.renderFeuilleExamenDeAssure(assureId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId });
  }
}
