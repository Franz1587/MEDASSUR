import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContratDto } from "./dto/create-contrat.dto";
import { UpdateContratDto } from "./dto/update-contrat.dto";

@Injectable()
export class ContratsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.contrat.findMany({ include: { client: true, compagnie: true } });
  }

  async findOne(id: string) {
    const contrat = await this.prisma.contrat.findUnique({
      where: { id },
      include: { client: true, compagnie: true },
    });
    if (!contrat) throw new NotFoundException(`Contrat ${id} introuvable`);
    return contrat;
  }

  create(dto: CreateContratDto) {
    return this.prisma.contrat.create({ data: { id: randomUUID(), ...dto } });
  }

  async update(id: string, dto: UpdateContratDto) {
    await this.findOne(id);
    return this.prisma.contrat.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.contrat.delete({ where: { id } });
    return { id };
  }
}
