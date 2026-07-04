import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompagnieDto } from "./dto/create-compagnie.dto";
import { UpdateCompagnieDto } from "./dto/update-compagnie.dto";

// Shapes the response to match what the frontend's Compagnie type expects
// (a `contrats` count + cumulative `prime`), computed from the related
// Contrat rows rather than stored redundantly.
function withAggregates<T extends { contrats: { prime: unknown }[] }>(compagnie: T) {
  const { contrats, ...rest } = compagnie;
  return {
    ...rest,
    contrats: contrats.length,
    prime: contrats.reduce((sum, c) => sum + Number(c.prime), 0),
  };
}

@Injectable()
export class CompagniesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const compagnies = await this.prisma.compagnie.findMany({
      include: { contrats: { select: { prime: true } } },
    });
    return compagnies.map(withAggregates);
  }

  async findOne(id: string) {
    const compagnie = await this.prisma.compagnie.findUnique({
      where: { id },
      include: { contrats: { select: { prime: true } } },
    });
    if (!compagnie) throw new NotFoundException(`Compagnie ${id} introuvable`);
    return withAggregates(compagnie);
  }

  create(dto: CreateCompagnieDto) {
    return this.prisma.compagnie.create({ data: { id: randomUUID(), ...dto } });
  }

  async update(id: string, dto: UpdateCompagnieDto) {
    await this.findOne(id);
    return this.prisma.compagnie.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.compagnie.delete({ where: { id } });
    return { id };
  }
}
