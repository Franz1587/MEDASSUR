import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SinistresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.sinistre.findMany({ include: { client: true } });
  }
}
