import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TresorerieService {
  constructor(private prisma: PrismaService) {}

  findComptes() {
    return this.prisma.compteBancaire.findMany();
  }

  findFlux() {
    return this.prisma.fluxTresorerie.findMany();
  }
}
