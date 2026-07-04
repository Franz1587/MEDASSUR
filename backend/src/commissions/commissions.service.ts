import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.commission.findMany({ include: { compagnie: true } });
  }
}
