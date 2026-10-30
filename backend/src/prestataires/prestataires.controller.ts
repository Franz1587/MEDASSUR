import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PrestatairesService } from "./prestataires.service";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

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
  @Get("reseau")
  findAllReseau(@Query("type") type?: string, @Query("ville") ville?: string, @Query("q") q?: string) {
    return this.prestatairesService.findAllReseau({ type, ville, q });
  }

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
  @Post("comptes-portail-manquants")
  creerComptesPortailManquants() {
    return this.prestatairesService.creerComptesPortailManquants();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.prestatairesService.findOne(id);
  }

  @Get(":id/statistiques")
  statistiques(@Param("id") id: string) {
    return this.prestatairesService.statistiques(id);
  }

  @Post()
  create(@Body() dto: CreatePrestataireDto) {
    return this.prestatairesService.create(dto);
  }

  // Géolocalisation en masse (2026-08) — déclarée AVANT ":id" (même piège de
  // routage que "reseau" ci-dessus). Voir PrestatairesService.geolocaliserLot.
  @Patch("geolocaliser-lot")
  geolocaliserLot(@Body("taille") taille?: number) {
    return this.prestatairesService.geolocaliserLot(taille && taille > 0 ? Math.min(taille, 30) : 15);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePrestataireDto) {
    return this.prestatairesService.update(id, dto);
  }

  @Patch(":id/suspendre")
  suspendre(@Param("id") id: string, @Body("motif") motif: string) {
    return this.prestatairesService.suspendre(id, motif);
  }

  @Patch(":id/rehabiliter")
  rehabiliter(@Param("id") id: string) {
    return this.prestatairesService.rehabiliter(id);
  }

  @Patch(":id/geolocaliser")
  geolocaliser(@Param("id") id: string) {
    return this.prestatairesService.geolocaliser(id);
  }

  @Post(":id/fusionner")
  fusionner(@Param("id") id: string, @Body("doublonId") doublonId: string) {
    if (!doublonId) throw new NotFoundException("doublonId requis");
    return this.prestatairesService.fusionner(id, doublonId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prestatairesService.remove(id);
  }

  @Get(":id/comptes-portail")
  comptesPortail(@Param("id") id: string) {
    return this.prestatairesService.comptesPortail(id);
  }

  @Post(":id/comptes-portail/:poste")
  creerComptePortail(@Param("id") id: string, @Param("poste") poste: string) {
    return this.prestatairesService.creerComptePortail(id, poste);
  }

  @Post(":id/comptes-portail/:poste/reinitialiser")
  reinitialiserMotDePassePortail(@Param("id") id: string, @Param("poste") poste: string) {
    return this.prestatairesService.reinitialiserMotDePassePortail(id, poste);
  }

  // Multi-clients portail (2026-10) — sociétés MEDASSUR+ que ce prestataire
  // peut servir en plus de sa propre société (voir PortailSocieteAcces).
  @Get(":id/acces-societes")
  async accesSocietes(@Param("id") id: string) {
    const acces = await this.prisma.portailSocieteAcces.findMany({
      where: { prestataireId: id },
      include: { societe: { select: { id: true, nom: true, type: true } } },
      orderBy: { createdAt: "asc" },
    });
    return acces.map((a: typeof acces[number]) => ({ id: a.id, societeId: a.societe.id, nom: a.societe.nom, type: a.societe.type }));
  }

  @Post(":id/acces-societes")
  async ajouterAccesSociete(@Param("id") id: string, @Body("societeId") societeId: string) {
    if (!societeId) throw new NotFoundException("societeId requis");
    return this.prisma.portailSocieteAcces.upsert({
      where: { prestataireId_societeId: { prestataireId: id, societeId } },
      create: { prestataireId: id, societeId },
      update: {},
    });
  }

  @Delete(":id/acces-societes/:societeId")
  async retirerAccesSociete(@Param("id") id: string, @Param("societeId") societeId: string) {
    await this.prisma.portailSocieteAcces.deleteMany({ where: { prestataireId: id, societeId } });
    return { ok: true };
  }
}
