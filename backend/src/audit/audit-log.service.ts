import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.auditLog.findMany({ orderBy: { dateAction: "desc" } });
  }

  log(entite: string, entiteId: string, action: string, utilisateur: string, details?: string) {
    return this.prisma.auditLog.create({
      data: { entite, entiteId, action, utilisateur, details },
    });
  }
}
