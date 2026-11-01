import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { idsFamilleDe } from "../portail-membre/famille.util";
import { SuiviSanteService } from "./suivi-sante.service";
import { AjouterMesureDto, CreerRendezVousDto, RepondreRendezVousDto } from "./suivi-sante.dto";

type Utilisateur = { userId: string; nom: string; roleId: string; assureSanteId: string | null; medecinId: string | null; prestataireId: string | null };
type RequeteSuivi = Request & { user: Utilisateur };

const nombre = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

// Portail assuré : rendez-vous, professionnels à proximité, accès au
// dossier médical et contrôles de santé, pour soi et sa famille.
@Controller("portail-membre/suivi")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("assure_principal")
export class SuiviSanteMembreController {
  constructor(private readonly prisma: PrismaService, private readonly suivi: SuiviSanteService) {}

  private famille(req: RequeteSuivi) {
    if (!req.user.assureSanteId) throw new ForbiddenException("Ce compte n'est rattaché à aucun assuré.");
    return idsFamilleDe(this.prisma, req.user.assureSanteId);
  }

  @Get("rendez-vous")
  async rendezVous(@Req() req: RequeteSuivi) {
    return this.suivi.rendezVousAssure(await this.famille(req));
  }

  @Post("rendez-vous")
  async creerRendezVous(@Body() dto: CreerRendezVousDto, @Req() req: RequeteSuivi) {
    return this.suivi.creerRendezVous(dto, await this.famille(req), req.user.userId);
  }

  @Patch("rendez-vous/:id/annuler")
  async annuler(@Param("id") id: string, @Req() req: RequeteSuivi) {
    return this.suivi.annulerRendezVous(id, await this.famille(req));
  }

  @Get("professionnels")
  professionnels(@Query("lat") lat?: string, @Query("lng") lng?: string, @Query("q") q?: string, @Query("specialite") specialite?: string, @Query("prestataireId") prestataireId?: string) {
    return this.suivi.professionnels({ lat: nombre(lat), lng: nombre(lng), q: q?.trim() || undefined, specialite: specialite?.trim() || undefined, prestataireId: prestataireId || undefined });
  }

  @Get("acces")
  async acces(@Req() req: RequeteSuivi) {
    return this.suivi.accesAssure(await this.famille(req));
  }

  @Post("acces/ouvrir")
  async ouvrir(@Body() body: { assureId: string; medecinId: string }, @Req() req: RequeteSuivi) {
    return this.suivi.changerAcces(body.assureId, body.medecinId, true, await this.famille(req));
  }

  @Post("acces/fermer")
  async fermer(@Body() body: { assureId: string; medecinId: string }, @Req() req: RequeteSuivi) {
    return this.suivi.changerAcces(body.assureId, body.medecinId, false, await this.famille(req));
  }

  @Get("mesures")
  async mesures(@Req() req: RequeteSuivi) {
    return this.suivi.mesures(await this.famille(req));
  }

  @Post("mesures")
  async ajouterMesure(@Body() dto: AjouterMesureDto, @Req() req: RequeteSuivi) {
    return this.suivi.ajouterMesure(dto, await this.famille(req));
  }

  @Delete("mesures/:id")
  async supprimerMesure(@Param("id") id: string, @Req() req: RequeteSuivi) {
    return this.suivi.supprimerMesure(id, await this.famille(req));
  }
}

// Portail médecin : ses rendez-vous et les dossiers que ses patients lui ont ouverts.
@Controller("portail-medecin/suivi")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("medecin_prescripteur")
export class SuiviSanteMedecinController {
  constructor(private readonly prisma: PrismaService, private readonly suivi: SuiviSanteService) {}

  private medecinId(req: RequeteSuivi) {
    if (!req.user.medecinId) throw new ForbiddenException("Ce compte n'est rattaché à aucun médecin.");
    return req.user.medecinId;
  }

  @Get("rendez-vous")
  rendezVous(@Req() req: RequeteSuivi) {
    return this.suivi.rendezVousMedecin(this.medecinId(req));
  }

  // Application mobile du médecin : jeton Expo pour les alertes push
  // (nouveau rendez-vous, accès à un dossier ouvert ou fermé).
  @Post("push-token")
  async pushToken(@Body("token") token: string, @Req() req: RequeteSuivi) {
    if (typeof token !== "string" || !token.startsWith("ExponentPushToken")) return { ok: false };
    await this.prisma.user.update({ where: { id: req.user.userId }, data: { pushToken: token } });
    return { ok: true };
  }

  @Patch("rendez-vous/:id")
  async repondre(@Param("id") id: string, @Body() dto: RepondreRendezVousDto, @Req() req: RequeteSuivi) {
    const medecin = await this.prisma.medecin.findUnique({ where: { id: this.medecinId(req) }, select: { nom: true, prenom: true, titre: true } });
    const auteur = medecin ? `${medecin.titre === "Professeur" ? "Pr" : "Dr"} ${`${medecin.prenom ?? ""} ${medecin.nom}`.trim()}` : "Votre médecin";
    return this.suivi.repondreRendezVous(id, { medecinId: this.medecinId(req) }, dto, auteur);
  }

  @Get("patients")
  patients(@Req() req: RequeteSuivi) {
    return this.suivi.patientsPartages(this.medecinId(req));
  }

  @Get("patients/:assureId")
  dossier(@Param("assureId") assureId: string, @Req() req: RequeteSuivi) {
    return this.suivi.dossierPatient(this.medecinId(req), assureId);
  }

  @Get("patients/:assureId/documents/:documentId")
  async document(@Param("assureId") assureId: string, @Param("documentId") documentId: string, @Req() req: RequeteSuivi, @Res() res: Response) {
    const pdf = await this.suivi.documentPatient(this.medecinId(req), assureId, documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Document-${documentId}.pdf"`);
    res.end(pdf);
  }

  @Post("patients/:assureId/mesures")
  ajouterMesure(@Param("assureId") assureId: string, @Body() dto: AjouterMesureDto, @Req() req: RequeteSuivi) {
    return this.suivi.ajouterMesure({ ...dto, assureId }, [assureId], this.medecinId(req));
  }
}

// Portail prestataire : rendez-vous pris dans l'établissement.
@Controller("portail-prestataire/suivi")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("prestataire_sante")
export class SuiviSantePrestataireController {
  constructor(private readonly prisma: PrismaService, private readonly suivi: SuiviSanteService) {}

  private prestataireId(req: RequeteSuivi) {
    if (!req.user.prestataireId) throw new ForbiddenException("Ce compte n'est rattaché à aucun établissement.");
    return req.user.prestataireId;
  }

  @Get("rendez-vous")
  rendezVous(@Req() req: RequeteSuivi) {
    return this.suivi.rendezVousPrestataire(this.prestataireId(req));
  }

  @Patch("rendez-vous/:id")
  async repondre(@Param("id") id: string, @Body() dto: RepondreRendezVousDto, @Req() req: RequeteSuivi) {
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: this.prestataireId(req) }, select: { nom: true } });
    return this.suivi.repondreRendezVous(id, { prestataireId: this.prestataireId(req) }, dto, prestataire?.nom ?? "L'établissement");
  }
}
