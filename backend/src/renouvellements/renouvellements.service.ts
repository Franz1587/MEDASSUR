import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RenouvellementsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.renouvellement.findMany({ include: { contrat: { include: { client: true, compagnie: true } } } });
  }
}
