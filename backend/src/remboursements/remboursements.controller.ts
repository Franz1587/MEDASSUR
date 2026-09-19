import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RemboursementsService } from "./remboursements.service";
import { CreateRemboursementDto } from "./dto/create-remboursement.dto";
import { UpdateRemboursementDto } from "./dto/update-remboursement.dto";
import { AnnulerRemboursementDto } from "./dto/annuler-remboursement.dto";
import { ApercuRemboursementLigneDto } from "./dto/apercu-remboursement-ligne.dto";
import { CreateRemboursementLigneDto } from "./dto/create-remboursement-ligne.dto";
import { UpdateRemboursementLigneDto } from "./dto/update-remboursement-ligne.dto";
import { RejeterLigneFactureDto } from "../sante/dto/rejeter-ligne-facture.dto";
import { AnnulerLigneFactureDto } from "../sante/dto/annuler-ligne-facture.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("remboursements")
@UseGuards(JwtAuthGuard)
export class RemboursementsController {
  constructor(private readonly service: RemboursementsService) {}

  @Get()
  findAll(
    @Query("contratId") contratId?: string, @Query("clientId") clientId?: string, @Query("statut") statut?: string,
    @Query("assurePrincipalId") assurePrincipalId?: string, @Query("du") du?: string, @Query("au") au?: string,
  ) {
    return this.service.findAll({ contratId, clientId, statut, assurePrincipalId, du, au });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRemboursementDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRemboursementDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body() dto: AnnulerRemboursementDto) {
    return this.service.annuler(id, dto.motif);
  }

  @Post(":id/lignes/apercu")
  apercuLigne(@Param("id") id: string, @Body() dto: ApercuRemboursementLigneDto) {
    return this.service.apercuLigne(id, dto);
  }

  @Post(":id/lignes")
  ajouterLigne(@Param("id") id: string, @Body() dto: CreateRemboursementLigneDto) {
    return this.service.ajouterLigne(id, dto);
  }

  @Patch(":id/lignes/:ligneId")
  modifierLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: UpdateRemboursementLigneDto) {
    return this.service.modifierLigne(id, ligneId, dto);
  }

  @Patch(":id/lignes/:ligneId/rejeter")
  rejeterLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: RejeterLigneFactureDto) {
    return this.service.rejeterLigne(id, ligneId, dto.motifRejet);
  }

  @Patch(":id/lignes/:ligneId/annuler")
  annulerLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: AnnulerLigneFactureDto) {
    return this.service.annulerLigne(id, ligneId, dto.motif);
  }

  @Delete(":id/lignes/:ligneId")
  supprimerLigne(@Param("id") id: string, @Param("ligneId") ligneId: string) {
    return this.service.supprimerLigne(id, ligneId);
  }
}
