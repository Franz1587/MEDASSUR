import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccordPrealableDto } from "./dto/create-accord-prealable.dto";
import { DecisionAccordPrealableDto } from "./dto/decision-accord-prealable.dto";

@Injectable()
export class AccordPrealableService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.accordPrealable.findMany({ include: { assure: true } });
  }

  async findOne(id: string) {
    const accord = await this.prisma.accordPrealable.findUnique({ where: { id }, include: { assure: true } });
    if (!accord) throw new NotFoundException(`Accord préalable ${id} introuvable`);
    return accord;
  }

  create(dto: CreateAccordPrealableDto) {
    return this.prisma.accordPrealable.create({
      data: {
        id: randomUUID(),
        ...dto,
        statutAnalyseMedicale: "En cours",
        statutValidationFinanciere: "En cours",
        decision: "En attente",
      },
    });
  }

  /** Fait avancer le workflow: analyse médicale -> validation financière -> décision. */
  async decider(id: string, dto: DecisionAccordPrealableDto) {
    await this.findOne(id);
    return this.prisma.accordPrealable.update({ where: { id }, data: dto });
  }
}
