import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { QuittancesLibresService } from "./quittances-libres.service";
import { CreateQuittanceLibreDto } from "./dto/create-quittance-libre.dto";
import { PayerTrancheDto } from "./dto/payer-tranche.dto";
import { AnnulerQuittanceLibreDto } from "./dto/annuler-quittance-libre.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

type ReqUser = Request & { user: { userId: string } };

@Controller("quittances-libres")
@UseGuards(JwtAuthGuard)
export class QuittancesLibresController {
  constructor(private readonly service: QuittancesLibresService) {}

  @Get()
  findAll(@Query("contratId") contratId?: string, @Query("statut") statut?: string) {
    return this.service.findAll({ contratId, statut });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQuittanceLibreDto, @Req() req: ReqUser) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body() dto: AnnulerQuittanceLibreDto) {
    return this.service.annuler(id, dto.motif);
  }

  @Patch("tranches/:trancheId/payer")
  payerTranche(@Param("trancheId") trancheId: string, @Body() dto: PayerTrancheDto) {
    return this.service.payerTranche(trancheId, dto);
  }

  @Patch("tranches/:trancheId/annuler-paiement")
  annulerPaiementTranche(@Param("trancheId") trancheId: string) {
    return this.service.annulerPaiementTranche(trancheId);
  }
}
