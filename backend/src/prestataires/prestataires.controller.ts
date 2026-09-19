import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PrestatairesService } from "./prestataires.service";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("prestataires")
@UseGuards(JwtAuthGuard)
export class PrestatairesController {
  constructor(private readonly prestatairesService: PrestatairesService) {}

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
}
