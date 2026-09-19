import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PortailClientUtilisateursService } from "./portail-client-utilisateurs.service";
import { CreatePortailUtilisateurDto } from "./dto/create-portail-utilisateur.dto";
import { UpdateModulesPortailDto } from "./dto/update-modules-portail.dto";

type PortailRequest = Request & { user: { userId: string; roleId: string; clientId: string | null } };

// Gestion des utilisateurs du portail client, PAR le client (2026-08) —
// voir demande utilisateur. Accès conditionné à la rubrique
// "portailUtilisateurs" côté frontend (menu), mais aussi vérifié ici :
// n'importe quel client_entreprise/client_particulier authentifié peut
// appeler cette API, la protection réelle vient de PortailClientUtilisateursService
// (cloisonnement clientId + anti-élévation de privilège sur les modules).
@Controller("portail-client/utilisateurs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("client_entreprise", "client_particulier")
export class PortailClientUtilisateursController {
  constructor(private readonly service: PortailClientUtilisateursService) {}

  private clientIdDe(req: PortailRequest): string {
    if (!req.user.clientId) throw new ForbiddenException("Ce compte n'est rattaché à aucun souscripteur.");
    return req.user.clientId;
  }

  @Get()
  findAll(@Req() req: PortailRequest) {
    return this.service.findAllPourClient(this.clientIdDe(req));
  }

  @Post()
  create(@Body() dto: CreatePortailUtilisateurDto, @Req() req: PortailRequest) {
    return this.service.create(this.clientIdDe(req), req.user.userId, req.user.roleId, dto);
  }

  @Patch(":id/modules")
  updateModules(@Param("id") id: string, @Body() dto: UpdateModulesPortailDto, @Req() req: PortailRequest) {
    return this.service.updateModules(this.clientIdDe(req), req.user.userId, id, dto.modules);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: PortailRequest) {
    return this.service.remove(this.clientIdDe(req), req.user.userId, id);
  }
}
