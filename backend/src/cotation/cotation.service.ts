import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCotationDto } from "./dto/create-cotation.dto";

export interface TarifCalcule {
  chargements: number;
  marge: number;
  commission: number;
  tarifFinal: number;
  pepm: number;
}

@Injectable()
export class CotationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Pricing Engine: dérive chargements / marge / commission / PEPM à partir
   * de la prime pure et des facteurs de risque (garanties, territorialité,
   * stop-loss). Les taux ci-dessous sont les règles métier du courtier —
   * centralisées ici plutôt que laissées au client de l'API.
   */
  calculer(dto: CreateCotationDto): TarifCalcule {
    const primePure = dto.primePure;

    let tauxChargement = 0.15;
    if (dto.niveauGaranties === "Premium") tauxChargement += 0.03;
    if (/CEMAC|international|EVASAN/i.test(dto.territorialite)) tauxChargement += 0.05;

    const chargements = primePure * tauxChargement;

    const tauxMarge = 0.08;
    const marge = primePure * tauxMarge;

    const tauxCommission = 0.1;
    const commission = (primePure + chargements) * tauxCommission;

    const chargeStopLoss = dto.stopLoss > 0 ? primePure * 0.02 : 0;

    const tarifFinal = primePure + chargements + marge + commission + chargeStopLoss;
    const pepm = dto.effectifAssure > 0 ? tarifFinal / (dto.effectifAssure * 12) : 0;

    return { chargements, marge, commission, tarifFinal, pepm };
  }

  findAll() {
    return this.prisma.cotation.findMany();
  }

  create(dto: CreateCotationDto) {
    const { effectifAssure: _effectifAssure, ...rest } = dto;
    const calc = this.calculer(dto);
    return this.prisma.cotation.create({
      data: {
        id: randomUUID(),
        ...rest,
        chargements: calc.chargements,
        marge: calc.marge,
        commission: calc.commission,
        tarifFinal: calc.tarifFinal,
        pepm: calc.pepm,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      },
    });
  }
}
