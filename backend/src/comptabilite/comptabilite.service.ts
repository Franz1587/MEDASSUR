import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

@Injectable()
export class ComptabiliteService {
  constructor(private prisma: PrismaService) {}

  findJournal() {
    return this.prisma.journalEntry.findMany({ orderBy: { date: "desc" } });
  }

  create(dto: CreateJournalEntryDto) {
    if (dto.debit === 0 && dto.credit === 0) {
      throw new BadRequestException("Une écriture doit avoir un montant au débit ou au crédit.");
    }
    return this.prisma.journalEntry.create({
      data: { ...dto, num: `JNL-${randomUUID().slice(0, 6).toUpperCase()}` },
    });
  }
}
