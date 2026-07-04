import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GedService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.gedDocument.findMany();
  }
}
