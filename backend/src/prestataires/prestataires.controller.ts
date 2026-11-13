import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PrestatairesService } from "./prestataires.service";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";
import { FusionPrestatairesDto } from "./dto/fusion-prestataires.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AllowExternal } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_PRESTATAIRES } from "../auth/access-roles";

@Controller("prestataires")
@UseGuards(JwtAuthGuard)
export class PrestatairesController {
  constructor(
    private readonly prestatairesService: PrestatairesService,
    private readonly prisma: PrismaService,
  ) {}

  // Réseau de soins (2026-08) — déclarées AVANT ":id", sinon NestJS route
  // "reseau" vers findOne(":id") (même piège que facture-production, voir
  // son controller). Ouvert à tout utilisateur authentifié (interne ET
  // portail client) — données non sensibles, réseau partagé.
  @AllowExternal()
  @Get("reseau")
  findAllReseau(@Query("type") type?: string, @Query("ville") ville?: string, @Query("q") q?: string) {
    return this.prestatairesService.findAllReseau({ type, ville, q });
  }

  @AllowExternal()
  @Get("reseau/medecins")
  findMedecinsReseau() {
    return this.prestatairesService.findMedecinsReseau();
  }

  @AllowExternal()
  @Get("reseau/:id")
  findOneReseau(@Param("id") id: string) {
    return this.prestatairesService.findOneReseau(id);
  }

  @Get()
  findAll() {
    return this.prestatairesService.findAll();
  }

  // Déclarée AVANT ":id" (même piège de routage que "reseau" ci-dessus).
  // Voir PrestatairesService.creerComptesPortailManquants.
  @Roles(...ROLES_PRESTATAIRES)
  @Post("comptes-portail-manquants")
  creerComptesPortailManquants() {
    return this.prestatairesService.creerComptesPortailManquants();
  }

  // Doublons probables et fusion groupée — déclarées AVANT ":id".
  @Roles(...ROLES_PRESTATAIRES)
  @Get("doublons")
  doublons() {
    return this.prestatairesService.doublons();
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post("fusion")
  fusion(@Body() body: FusionPrestatairesDto) {
    if (!body?.conserverId || !Array.isArray(body.absorberIds)) throw new BadRequestException("conserverId et absorberIds requis.");
    return this.prestatairesService.fusionnerPlusieurs(body.conserverId, body.absorberIds, { nom: body.nom, ville: body.ville });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.prestatairesService.findOne(id);
  }

  @Get(":id/statistiques")
  statistiques(@Param("id") id: string) {
    return this.prestatairesService.statistiques(id);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post()
  create(@Body() dto: CreatePrestataireDto) {
    return this.prestatairesService.create(dto);
  }

  // Géolocalisation en masse (2026-08) — déclarée AVANT ":id" (même piège de
  // routage que "reseau" ci-dessus). Voir PrestatairesService.geolocaliserLot.
  @Roles(...ROLES_PRESTATAIRES)
  @Patch("geolocaliser-lot")
  geolocaliserLot(@Body("taille") taille?: number) {
    return this.prestatairesService.geolocaliserLot(taille && taille > 0 ? Math.min(taille, 30) : 15);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePrestataireDto) {
    return this.prestatairesService.update(id, dto);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Patch(":id/suspendre")
  suspendre(@Param("id") id: string, @Body("motif") motif: string) {
    return this.prestatairesService.suspendre(id, motif);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Patch(":id/rehabiliter")
  rehabiliter(@Param("id") id: string) {
    return this.prestatairesService.rehabiliter(id);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Patch(":id/geolocaliser")
  geolocaliser(@Param("id") id: string) {
    return this.prestatairesService.geolocaliser(id);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Patch(":id/position-gps")
  enregistrerPositionGps(@Param("id") id: string, @Body("latitude") lat: number, @Body("longitude") lng: number) {
    if (lat == null || lng == null) throw new BadRequestException("latitude et longitude requis");
    return this.prestatairesService.enregistrerPositionGps(id, Number(lat), Number(lng));
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post(":id/fusionner")
  fusionner(@Param("id") id: string, @Body("doublonId") doublonId: string) {
    if (!doublonId) throw new NotFoundException("doublonId requis");
    return this.prestatairesService.fusionner(id, doublonId);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prestatairesService.remove(id);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Get(":id/comptes-portail")
  comptesPortail(@Param("id") id: string) {
    return this.prestatairesService.comptesPortail(id);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post(":id/comptes-portail/:poste")
  creerComptePortail(@Param("id") id: string, @Param("poste") poste: string) {
    return this.prestatairesService.creerComptePortail(id, poste);
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post(":id/comptes-portail/:poste/reinitialiser")
  reinitialiserMotDePassePortail(@Param("id") id: string, @Param("poste") poste: string) {
    return this.prestatairesService.reinitialiserMotDePassePortail(id, poste);
  }

  // Multi-clients portail (2026-10) — sociétés MEDASSUR+ que ce prestataire
  // peut servir en plus de sa propre société (voir PortailSocieteAcces).
  @Roles(...ROLES_PRESTATAIRES)
  @Get(":id/acces-societes")
  async accesSocietes(@Param("id") id: string) {
    const acces = await this.prisma.portailSocieteAcces.findMany({
      where: { prestataireId: id },
      include: { societe: { select: { id: true, nom: true, type: true } } },
      orderBy: { createdAt: "asc" },
    });
    return acces.map((a: typeof acces[number]) => ({ id: a.id, societeId: a.societe.id, nom: a.societe.nom, type: a.societe.type }));
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Post(":id/acces-societes")
  async ajouterAccesSociete(@Param("id") id: string, @Body("societeId") societeId: string) {
    if (!societeId) throw new NotFoundException("societeId requis");
    return this.prisma.portailSocieteAcces.upsert({
      where: { prestataireId_societeId: { prestataireId: id, societeId } },
      create: { prestataireId: id, societeId },
      update: {},
    });
  }

  @Roles(...ROLES_PRESTATAIRES)
  @Delete(":id/acces-societes/:societeId")
  async retirerAccesSociete(@Param("id") id: string, @Param("societeId") societeId: string) {
    await this.prisma.portailSocieteAcces.deleteMany({ where: { prestataireId: id, societeId } });
    return { ok: true };
  }
}
