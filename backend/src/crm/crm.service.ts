import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.prospect.findMany();
  }
}
