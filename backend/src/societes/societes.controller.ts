import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { SocietesService } from "./societes.service";
import { CreateSocieteDto } from "./dto/create-societe.dto";
import { UpdateSocieteDto } from "./dto/update-societe.dto";
import { SuspendreSocieteDto } from "./dto/suspendre-societe.dto";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";
import { PrismaService } from "../prisma/prisma.service";

// Super Admin (2026-09) — voir demande utilisateur : "c'est lui qui crée
// les sociétés d'assurances qui vont utiliser l'application comme outil
// métier". Réservé au rôle super_admin exclusivement — jamais accessible,
// même en lecture, à un administrateur "interne" d'une société (voir
// SocieteAssurance, schema.prisma, pour le détail du chantier multi-tenant
// dont ceci est la Phase 1).
@Controller("societes")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class SocietesController {
  constructor(
    private readonly service: SocietesService,
    private readonly parametresEntreprise: ParametresEntrepriseService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSocieteDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSocieteDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/suspendre")
  suspendre(@Param("id") id: string, @Body() dto: SuspendreSocieteDto) {
    return this.service.suspendre(id, dto);
  }

  @Patch(":id/reactiver")
  reactiver(@Param("id") id: string) {
    return this.service.reactiver(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/assistance")
  assistance(@Param("id") id: string, @Req() req: { user: { userId: string; email: string } }) {
    return this.service.assistance(id, req.user.userId, req.user.email);
  }

  // Logo — sur UNE société ciblée (2026-09) — voir demande utilisateur :
  // "dans l'onglet ou le formulaire de création... on doit pouvoir mettre
  // le logo de l'entreprise." Le Super Admin n'appartient à aucune
  // société (TenantContext null) : ces routes appellent
  // ParametresEntrepriseService avec l'id explicite de la société ciblée,
  // jamais via this.id()/TenantContext (réservé à l'écran interne, voir
  // ParametresEntrepriseController).
  @Post(":id/parametres-entreprise/logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.parametresEntreprise.uploadLogo(id, file);
  }

  @Delete(":id/parametres-entreprise/logo")
  deleteLogo(@Param("id") id: string) {
    return this.parametresEntreprise.deleteLogo(id);
  }

  // Abonnement individuel (2026-10) — Super Admin configure le prix par
  // société et gère les demandes d'abonnement des assurés radiés/suspendus.
  @Patch(":id/prix-abonnement-individuel")
  async setPrixAbonnementIndividuel(@Param("id") id: string, @Body("prix") prix: number | null) {
    await this.prisma.societeAssurance.update({
      where: { id },
      data: { prixAbonnementIndividuelXaf: prix === null || prix === undefined ? null : Math.round(Number(prix)) },
    });
    return { ok: true };
  }

  @Get(":id/abonnements-individuels")
  async abonnementsIndividuels(@Param("id") id: string) {
    const abonnements = await this.prisma.abonnementIndividuel.findMany({
      where: { societeId: id },
      include: { assure: { select: { nom: true, prenom: true, matricule: true } } },
      orderBy: { createdAt: "desc" },
    });
    return abonnements.map((a) => ({
      id: a.id, statut: a.statut, dateDebut: a.dateDebut, dateFin: a.dateFin,
      montantXaf: a.montantXaf, createdAt: a.createdAt,
      assure: a.assure,
    }));
  }

  @Patch(":societeId/abonnements-individuels/:id/activer")
  async activerAbonnementIndividuel(@Param("id") id: string) {
    const abo = await this.prisma.abonnementIndividuel.findUnique({ where: { id } });
    if (!abo) throw new NotFoundException("Abonnement introuvable.");
    const now = new Date();
    await this.prisma.abonnementIndividuel.update({
      where: { id },
      data: { statut: "Actif", dateDebut: now, dateFin: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) },
    });
    return { ok: true };
  }

  @Patch(":societeId/abonnements-individuels/:id/annuler")
  async annulerAbonnementIndividuel(@Param("id") id: string, @Body("motif") motif?: string) {
    const abo = await this.prisma.abonnementIndividuel.findUnique({ where: { id } });
    if (!abo) throw new NotFoundException("Abonnement introuvable.");
    await this.prisma.abonnementIndividuel.update({ where: { id }, data: { statut: "Annulé", motifAnnulation: motif ?? null } });
    return { ok: true };
  }
}
