import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ComptabiliteService {
  constructor(private prisma: PrismaService) {}

  findJournal() {
    return this.prisma.journalEntry.findMany();
  }
}
