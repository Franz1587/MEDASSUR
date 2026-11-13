import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { QuittancesLibresService } from "./quittances-libres.service";
import { CreateQuittanceLibreDto } from "./dto/create-quittance-libre.dto";
import { PayerTrancheDto } from "./dto/payer-tranche.dto";
import { AnnulerQuittanceLibreDto } from "./dto/annuler-quittance-libre.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_PRODUCTION } from "../auth/access-roles";

type ReqUser = Request & { user: { userId: string } };

// Onglet « Quittances libres » de l'écran Avenants.
@Controller("quittances-libres")
@UseGuards(JwtAuthGuard)
@RequireModule("avenants")
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

  @Roles(...ROLES_PRODUCTION)
  @Post()
  create(@Body() dto: CreateQuittanceLibreDto, @Req() req: ReqUser) {
    return this.service.create(dto, req.user.userId);
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body() dto: AnnulerQuittanceLibreDto) {
    return this.service.annuler(id, dto.motif);
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch("tranches/:trancheId/payer")
  payerTranche(@Param("trancheId") trancheId: string, @Body() dto: PayerTrancheDto) {
    return this.service.payerTranche(trancheId, dto);
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch("tranches/:trancheId/annuler-paiement")
  annulerPaiementTranche(@Param("trancheId") trancheId: string) {
    return this.service.annulerPaiementTranche(trancheId);
  }
}
