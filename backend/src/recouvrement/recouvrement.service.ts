import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RecouvrementService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.impaye.findMany({ include: { client: true, contrat: true } });
  }
}
