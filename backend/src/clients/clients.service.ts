import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

// Shapes the response to match what the frontend's Client type expects
// (a `contrats` count + cumulative `prime`), computed from the related
// Contrat rows rather than stored redundantly.
function withAggregates<T extends { contrats: { prime: unknown }[] }>(client: T) {
  const { contrats, ...rest } = client;
  return {
    ...rest,
    contrats: contrats.length,
    prime: contrats.reduce((sum, c) => sum + Number(c.prime), 0),
  };
}

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const clients = await this.prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: { contrats: { select: { prime: true } } },
    });
    return clients.map(withAggregates);
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { contrats: { select: { prime: true } } },
    });
    if (!client) throw new NotFoundException(`Client ${id} introuvable`);
    return withAggregates(client);
  }

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: { id: randomUUID(), ...dto } });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.delete({ where: { id } });
    return { id };
  }
}
