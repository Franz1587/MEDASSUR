import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class IardService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.policeIard.findMany({ include: { client: true, compagnie: true } });
  }
}
