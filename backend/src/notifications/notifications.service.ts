import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.notification.findMany({ orderBy: { dateEnvoi: "desc" } });
  }

  create(destinataireType: string, destinataireId: string, message: string) {
    return this.prisma.notification.create({
      data: { id: randomUUID(), destinataireType, destinataireId, message, statut: "Envoyée" },
    });
  }

  marquerLue(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { statut: "Lue" } });
  }
}
