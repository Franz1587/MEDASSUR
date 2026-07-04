import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FlotteService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.flotte.findMany({ include: { client: true, compagnie: true, vehicules: true } });
  }
}
