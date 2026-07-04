import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DevisService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.devis.findMany({ include: { client: true, offres: true } });
  }
}
