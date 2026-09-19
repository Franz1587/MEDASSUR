import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentsService } from "../documents/documents.service";
import { PrescriptionsService } from "../prescriptions/prescriptions.service";
import { CreatePrescriptionDto } from "../prescriptions/dto/create-prescription.dto";

type PortailMedecinRequest = Request & { user: { userId: string; nom: string; roleId: string; medecinId: string | null } };

// Portail médecin (2026-08) — voir demande utilisateur : "le médecin doit
// avoir ses accès différents de ceux de la clinique ou l'hôpital. Car il a
// des écrans que les autres n'ont pas et c'est sensible. Il n'a pas besoin
// d'identifier un assuré, il doit en se connectant voir la liste des
// assurés qu'il doit recevoir (une file d'attente)." Compte distinct
// (User.medecinId), jamais rattaché à un Prestataire — même patron que
// PortailPrestataireController/PortailMembreController (façade fine,
// délègue à PrescriptionsService), mais un rôle et un cloisonnement
// totalement séparés.
@Controller("portail-medecin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("medecin_prescripteur")
export class PortailMedecinController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly prescriptions: PrescriptionsService,
  ) {}

  private medecinIdDe(req: PortailMedecinRequest): string {
    if (!req.user.medecinId) throw new ForbiddenException("Ce compte n'est rattaché à aucun médecin.");
    return req.user.medecinId;
  }

  // Vérifie que la prescription appartient bien au médecin authentifié
  // avant de générer un document (2026-08) — jamais de fuite d'un document
  // vers un médecin qui n'a pas prescrit cette consultation.
  private async prescriptionAutorisee(id: string, medecinId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id }, select: { id: true, medecinId: true, priseEnChargeId: true },
    });
    if (!prescription) throw new NotFoundException(`Prescription ${id} introuvable`);
    if (prescription.medecinId !== medecinId) throw new ForbiddenException("Cette prescription n'est pas la vôtre.");
    return prescription;
  }

  @Get("moi")
  async moi(@Req() req: PortailMedecinRequest) {
    const medecin = await this.prisma.medecin.findUnique({
      where: { id: this.medecinIdDe(req) },
      include: { structures: { include: { prestataire: true } } },
    });
    if (!medecin) throw new NotFoundException("Médecin introuvable");
    return medecin;
  }

  @Get("file-attente")
  async fileAttente(@Req() req: PortailMedecinRequest) {
    return this.prescriptions.fileAttente(this.medecinIdDe(req));
  }

  @Get("prescriptions")
  async mesPrescriptions(@Req() req: PortailMedecinRequest) {
    return this.prescriptions.mesPrescriptions(this.medecinIdDe(req));
  }

  @Post("prescriptions")
  async creerPrescription(@Body() dto: CreatePrescriptionDto, @Req() req: PortailMedecinRequest) {
    return this.prescriptions.creer(this.medecinIdDe(req), dto);
  }

  // Feuille de Soins / Feuille d'Examen (2026-08) — voir demande
  // utilisateur : "le médecin doit pouvoir lui aussi de son côté générer la
  // feuille de soins et examens." Réutilise les mêmes méthodes de rendu que
  // le portail prestataire (même document, même numérotation) — la Feuille
  // de Soins se génère depuis la PriseEnCharge d'origine de la consultation.
  @Get("prescriptions/:id/feuille-soins")
  async feuilleSoinsPrescription(@Param("id") id: string, @Req() req: PortailMedecinRequest, @Res() res: Response) {
    const prescription = await this.prescriptionAutorisee(id, this.medecinIdDe(req));
    // Prix des médicaments/quote-part JAMAIS visibles côté médecin
    // prescripteur (2026-09) — voir demande utilisateur : "le médecin n'est
    // pas censé connaître les prix des médicaments de la pharmacie".
    return this.documents.renderFeuilleSoinsLigne(prescription.priseEnChargeId, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: true });
  }

  @Get("prescriptions/:id/feuille-examen")
  async feuilleExamenPrescription(@Param("id") id: string, @Req() req: PortailMedecinRequest, @Res() res: Response) {
    await this.prescriptionAutorisee(id, this.medecinIdDe(req));
    return this.documents.renderFeuilleExamenPrescription(id, res, { id: req.user.userId, nom: req.user.nom, roleId: req.user.roleId, masquerPrixPharmacie: true });
  }

  // Suggestion de posologie par IA (2026-08) — voir demande utilisateur :
  // "l'application... doit connaître la logique de posologie d'un produit en
  // fonction de l'âge et du sexe du patient". Simple pré-remplissage,
  // toujours retouchable — jamais d'erreur bloquante, `null` si indisponible.
  @Get("posologie-suggestion")
  async posologieSuggestion(@Query("libelle") libelle: string, @Query("assureId") assureId: string) {
    if (!libelle || !assureId) throw new BadRequestException("Paramètres 'libelle' et 'assureId' requis.");
    const posologie = await this.prescriptions.suggererPosologie(libelle, assureId);
    return { posologie };
  }
}
