import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SanteService {
  constructor(private prisma: PrismaService) {}

  findAssures() {
    return this.prisma.assureSante.findMany({ include: { contrat: true } });
  }

  findPrisesEnCharge() {
    return this.prisma.priseEnCharge.findMany({ include: { assure: true } });
  }
}
