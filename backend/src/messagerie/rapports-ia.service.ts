import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Rapports de clôture générés par cloturer_conversation_resolue (2026-09)
// — voir MessagerieAgentIaService/schema.prisma RapportConversationIA pour
// le contexte complet (demande utilisateur : "il faut aussi que Ariana
// fasse un rapport lorsqu'elle a pu gérer une demande et que l'assuré
// repart satisfait"). Lecture seule côté gestionnaire, hormis le marquage
// lu/non lu.
@Injectable()
export class RapportsIaService {
  constructor(private prisma: PrismaService) {}

  findAll(lu?: string) {
    return this.prisma.rapportConversationIA.findMany({
      where: lu !== undefined ? { lu: lu === "true" } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async marquerLu(id: string, lu: boolean) {
    const existant = await this.prisma.rapportConversationIA.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException(`Rapport ${id} introuvable`);
    return this.prisma.rapportConversationIA.update({ where: { id }, data: { lu } });
  }
}
