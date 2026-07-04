import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HonorairesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.honorairesGestion.findMany({ include: { contrat: { include: { client: true } } } });
  }
}
