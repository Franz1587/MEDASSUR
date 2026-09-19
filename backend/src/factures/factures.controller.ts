import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { FacturesService } from "./factures.service";
import { CreateFactureDto } from "./dto/create-facture.dto";
import { UpdateFactureDto } from "./dto/update-facture.dto";
import { AnnulerFactureDto } from "./dto/annuler-facture.dto";
import { ApercuLigneDto } from "./dto/apercu-ligne.dto";
import { CreateFactureLigneDto } from "../sante/dto/create-facture-ligne.dto";
import { UpdateFactureLigneDto } from "../sante/dto/update-facture-ligne.dto";
import { RejeterLigneFactureDto } from "../sante/dto/rejeter-ligne-facture.dto";
import { AnnulerLigneFactureDto } from "../sante/dto/annuler-ligne-facture.dto";
import { AjouterNumeroDto } from "./dto/ajouter-numero.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("factures")
@UseGuards(JwtAuthGuard)
export class FacturesController {
  constructor(private readonly service: FacturesService) {}

  @Get()
  findAll(
    @Query("prestataireId") prestataireId?: string, @Query("contratId") contratId?: string,
    @Query("clientId") clientId?: string, @Query("statut") statut?: string, @Query("reference") reference?: string,
    @Query("du") du?: string, @Query("au") au?: string, @Query("gestionnaireId") gestionnaireId?: string,
  ) {
    return this.service.findAll({ prestataireId, contratId, clientId, statut, reference, du, au, gestionnaireId });
  }

  // Déclarée avant ":id" pour que Nest ne capture pas "eligibles-reglement"
  // comme une valeur de :id — écran de génération de règlement.
  @Get("eligibles-reglement")
  findEligiblesReglement(
    @Query("prestataireId") prestataireId: string, @Query("compagnieId") compagnieId?: string,
    @Query("clientId") clientId?: string, @Query("du") du?: string, @Query("au") au?: string,
  ) {
    return this.service.findEligiblesReglement({ prestataireId, compagnieId, clientId, du, au });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFactureDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFactureDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body() dto: AnnulerFactureDto) {
    return this.service.annuler(id, dto.motif);
  }

  @Post(":id/lignes/apercu")
  apercuLigne(@Param("id") id: string, @Body() dto: ApercuLigneDto) {
    return this.service.apercuLigne(id, dto);
  }

  @Post(":id/lignes")
  ajouterLigne(@Param("id") id: string, @Body() dto: CreateFactureLigneDto) {
    return this.service.ajouterLigne(id, dto);
  }

  @Patch(":id/lignes/:ligneId")
  modifierLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: UpdateFactureLigneDto) {
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

  @Post(":id/numeros")
  ajouterNumero(@Param("id") id: string, @Body() dto: AjouterNumeroDto) {
    return this.service.ajouterNumero(id, dto.numero);
  }

  @Delete(":id/numeros/:numeroId")
  supprimerNumero(@Param("id") id: string, @Param("numeroId") numeroId: string) {
    return this.service.supprimerNumero(id, numeroId);
  }
}
