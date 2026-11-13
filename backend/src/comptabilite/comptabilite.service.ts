import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

@Injectable()
export class ComptabiliteService {
  constructor(private prisma: PrismaService) {}

  findJournal() {
    return this.prisma.journalEntry.findMany({ orderBy: { date: "desc" } });
  }

  // Écriture mono-ligne : un montant au débit OU au crédit (jamais les deux —
  // l'écran de saisie remet déjà l'autre côté à 0). Refuse aussi NaN,
  // l'infini et les valeurs négatives (aussi bien côté API que formulaire).
  create(dto: CreateJournalEntryDto) {
    const debit = Number(dto.debit);
    const credit = Number(dto.credit);
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
      throw new BadRequestException("Les montants débit/crédit doivent être des nombres valides.");
    }
    if (debit < 0 || credit < 0) {
      throw new BadRequestException("Les montants débit/crédit ne peuvent pas être négatifs.");
    }
    if (debit === 0 && credit === 0) {
      throw new BadRequestException("Une écriture doit avoir un montant au débit ou au crédit.");
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestException("Une écriture porte un montant au débit OU au crédit, pas les deux.");
    }
    return this.prisma.journalEntry.create({
      data: { ...dto, num: `JNL-${randomUUID().slice(0, 6).toUpperCase()}` },
    });
  }

  // Balance débit/crédit (aide pour les rapports, sans endpoint) : totaux par
  // compte (le journal n'a pas de colonne "journal" distincte — `compte` est
  // la seule clé d'imputation) et écart global, calculés en Decimal puis
  // restitués en nombres. Un journal équilibré a `ecart === 0`.
  async calculerBalance(filtres?: { compte?: string }) {
    const groupes = await this.prisma.journalEntry.groupBy({
      by: ["compte"],
      where: filtres?.compte ? { compte: filtres.compte } : undefined,
      _sum: { debit: true, credit: true },
      orderBy: { compte: "asc" },
    });
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const parCompte = groupes.map((g) => {
      const debit = g._sum.debit ?? new Prisma.Decimal(0);
      const credit = g._sum.credit ?? new Prisma.Decimal(0);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      return { compte: g.compte, totalDebit: debit.toNumber(), totalCredit: credit.toNumber(), solde: debit.minus(credit).toNumber() };
    });
    return { parCompte, totalDebit: totalDebit.toNumber(), totalCredit: totalCredit.toNumber(), ecart: totalDebit.minus(totalCredit).toNumber() };
  }
}
