import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VieService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.contratVie.findMany({ include: { compagnie: true, beneficiaires: true } });
  }
}
