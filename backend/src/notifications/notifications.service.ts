import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Réservé au destinataire concerné — jamais toutes les notifications de
  // tous les utilisateurs (voir NotificationsController, destinataireId =
  // l'utilisateur authentifié).
  findPourUtilisateur(destinataireId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { destinataireId },
      orderBy: { dateEnvoi: "desc" },
      take: limit,
    });
  }

  create(destinataireType: string, destinataireId: string, message: string) {
    return this.prisma.notification.create({
      data: { id: randomUUID(), destinataireType, destinataireId, message, statut: "Envoyée" },
    });
  }

  marquerLue(id: string, destinataireId: string) {
    return this.prisma.notification.updateMany({ where: { id, destinataireId }, data: { statut: "Lue" } });
  }

  marquerToutesLues(destinataireId: string) {
    return this.prisma.notification.updateMany({ where: { destinataireId, statut: "Envoyée" }, data: { statut: "Lue" } });
  }
}
