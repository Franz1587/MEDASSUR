import { Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MessagerieService } from "./messagerie.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";

type MessagerieRequest = Request & { user: { userId: string; nom: string; roleId: string } };

// Messagerie (2026-08) — voir demande utilisateur : "il faut créer pour
// tous les acteurs ou utilisateur un onglet de Messagerie permettant, aux
// assurés, au client et aux prestataire de discuter directement avec
// l'assurance depuis l'application... pouvoir envoyer des pièces
// jointes... garder l'historique... donner systématiquement un objet dès
// l'ouverture." Volontairement SANS @Roles() — ouvert à TOUT utilisateur
// authentifié (interne comme externe), le cloisonnement se fait dans
// MessagerieService (estRoleInterne) plutôt que par un guard de rôle unique
// comme les contrôleurs portail-spécifiques.
@Controller("messagerie")
@UseGuards(JwtAuthGuard)
export class MessagerieController {
  constructor(private readonly messagerie: MessagerieService) {}

  @Post("conversations")
  creer(@Body() dto: CreateConversationDto, @Req() req: MessagerieRequest) {
    return this.messagerie.creer(dto, req.user.userId, req.user.roleId);
  }

  @Get("conversations")
  liste(@Req() req: MessagerieRequest) {
    return this.messagerie.liste(req.user.userId, req.user.roleId);
  }

  @Get("conversations/non-lus")
  nonLus(@Req() req: MessagerieRequest) {
    return this.messagerie.nonLus(req.user.userId, req.user.roleId).then((count) => ({ count }));
  }

  @Get("conversations/:id/messages")
  messages(@Param("id") id: string, @Req() req: MessagerieRequest) {
    return this.messagerie.messages(id, req.user.userId, req.user.roleId);
  }

  @Post("conversations/:id/messages")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  envoyerMessage(
    @Param("id") id: string,
    @Body("contenu") contenu: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: MessagerieRequest,
  ) {
    return this.messagerie.envoyerMessage(id, req.user.userId, req.user.roleId, contenu, file);
  }

  @Patch("conversations/:id/prendre")
  prendre(@Param("id") id: string, @Req() req: MessagerieRequest) {
    return this.messagerie.prendre(id, req.user.userId, req.user.roleId);
  }

  @Patch("conversations/:id/statut")
  changerStatut(@Param("id") id: string, @Body("statut") statut: string, @Req() req: MessagerieRequest) {
    return this.messagerie.changerStatut(id, req.user.userId, req.user.roleId, statut);
  }

  @Patch("conversations/:id/lus")
  marquerLus(@Param("id") id: string, @Req() req: MessagerieRequest) {
    return this.messagerie.marquerLus(id, req.user.userId, req.user.roleId).then(() => ({ ok: true }));
  }
}
