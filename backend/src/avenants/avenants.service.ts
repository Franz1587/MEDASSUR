import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AvenantsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.avenant.findMany({ include: { contrat: { include: { client: true } } } });
  }
}
