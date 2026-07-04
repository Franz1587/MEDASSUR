import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FondsDeRoulementService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.fondsDeRoulement.findMany({ include: { contrat: { include: { client: true } } } });
  }
}
