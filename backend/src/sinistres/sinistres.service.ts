import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSinistreDto } from "./dto/create-sinistre.dto";
import { UpdateSinistreDto } from "./dto/update-sinistre.dto";

@Injectable()
export class SinistresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.sinistre.findMany({ include: { client: true } });
  }

  async findOne(id: string) {
    const s = await this.prisma.sinistre.findUnique({ where: { id }, include: { client: true } });
    if (!s) throw new NotFoundException(`Sinistre ${id} introuvable`);
    return s;
  }

  create(dto: CreateSinistreDto, gestionnaireId: string) {
    return this.prisma.sinistre.create({
      data: { id: `SIN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`, ...dto, gestionnaireId },
      include: { client: true },
    });
  }

  async update(id: string, dto: UpdateSinistreDto) {
    await this.findOne(id);
    return this.prisma.sinistre.update({ where: { id }, data: dto, include: { client: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.sinistre.delete({ where: { id } });
    return { id };
  }
}
