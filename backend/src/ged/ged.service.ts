import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGedDocumentDto } from "./dto/create-ged-document.dto";

@Injectable()
export class GedService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.gedDocument.findMany();
  }

  create(dto: CreateGedDocumentDto) {
    return this.prisma.gedDocument.create({
      data: {
        id: `DOC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        ...dto,
        statutOcr: "Analysé",
        statutSignature: "N/A",
        date: new Date().toLocaleDateString("fr-FR"),
      },
    });
  }

  async remove(id: string) {
    const doc = await this.prisma.gedDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);
    await this.prisma.gedDocument.delete({ where: { id } });
    return { id };
  }
}
