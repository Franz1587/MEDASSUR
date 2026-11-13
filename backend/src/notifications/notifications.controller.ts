import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AllowExternal } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";

type AuthRequest = Request & { user: { userId: string } };

@Controller("notifications")
@UseGuards(JwtAuthGuard)
@AllowExternal()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // Toujours filtré sur l'utilisateur authentifié — jamais les
  // notifications de tout le monde (bulle de notification, voir
  // AdminShell.tsx).
  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.service.findPourUtilisateur(req.user.userId);
  }

  // Création arbitraire d'une notification pour n'importe quel destinataire :
  // jamais ouverte aux comptes externes ni au personnel non administrateur.
  @Roles("administrateur", "direction_generale")
  @Post()
  create(@Body() body: { destinataireType: string; destinataireId: string; message: string }) {
    return this.service.create(body.destinataireType, body.destinataireId, body.message);
  }

  @Patch(":id/lue")
  marquerLue(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.marquerLue(id, req.user.userId);
  }

  @Patch("toutes-lues")
  marquerToutesLues(@Req() req: AuthRequest) {
    return this.service.marquerToutesLues(req.user.userId);
  }
}
