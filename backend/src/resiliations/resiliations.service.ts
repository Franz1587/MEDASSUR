import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ResiliationsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.resiliation.findMany({ include: { contrat: { include: { client: true } } } });
  }
}
