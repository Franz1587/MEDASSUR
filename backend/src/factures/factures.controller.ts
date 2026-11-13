import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { envoyerExport, formatExport } from "../lib/export-tableau.util";
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
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_SANTE } from "../auth/access-roles";

// Saisie des factures (prises en charge, tableau de bord sinistres/santé) et écrans de règlement (éligibles).
@Controller("factures")
@UseGuards(JwtAuthGuard)
@RequireModule("prisesEnCharge", "reglementPrestataire", "reglementComptable")
export class FacturesController {
  constructor(private readonly service: FacturesService) {}

  @Get()
  findAll(
    @Query("prestataireId") prestataireId?: string, @Query("contratId") contratId?: string,
    @Query("clientId") clientId?: string, @Query("statut") statut?: string, @Query("reference") reference?: string,
    @Query("du") du?: string, @Query("au") au?: string, @Query("gestionnaireId") gestionnaireId?: string,
    @Query("page") page?: string, @Query("taille") taille?: string,
  ) {
    const filtres = { prestataireId, contratId, clientId, statut, reference, du, au, gestionnaireId };
    // `page` présent → pagination serveur ({ items, total }) ; sinon liste (compatibilité).
    if (page) return this.service.findPage(filtres, Math.max(1, Number(page) || 1), Math.min(500, Math.max(1, Number(taille) || 20)));
    return this.service.findAll(filtres);
  }

  // Export multiformat (xlsx, csv, pdf, docx) de la liste ou du détail des lignes.
  @Get("export")
  async exporter(
    @Res() res: Response,
    @Query("format") format?: string, @Query("niveau") niveau?: string,
    @Query("prestataireId") prestataireId?: string, @Query("contratId") contratId?: string,
    @Query("clientId") clientId?: string, @Query("statut") statut?: string, @Query("reference") reference?: string,
    @Query("du") du?: string, @Query("au") au?: string, @Query("factureId") factureId?: string,
  ) {
    const tableau = await this.service.exporter({ prestataireId, contratId, clientId, statut, reference, du, au, factureId }, niveau === "lignes" ? "lignes" : "factures");
    return envoyerExport(res, formatExport(format), tableau);
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

  @Roles(...ROLES_SANTE)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFactureDto) {
    return this.service.update(id, dto);
  }

  @Roles(...ROLES_SANTE)
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

  @Roles(...ROLES_SANTE)
  @Patch(":id/lignes/:ligneId/rejeter")
  rejeterLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: RejeterLigneFactureDto) {
    return this.service.rejeterLigne(id, ligneId, dto.motifRejet);
  }

  @Roles(...ROLES_SANTE)
  @Patch(":id/lignes/:ligneId/annuler")
  annulerLigne(@Param("id") id: string, @Param("ligneId") ligneId: string, @Body() dto: AnnulerLigneFactureDto) {
    return this.service.annulerLigne(id, ligneId, dto.motif);
  }

  @Roles(...ROLES_SANTE)
  @Delete(":id/lignes/:ligneId")
  supprimerLigne(@Param("id") id: string, @Param("ligneId") ligneId: string) {
    return this.service.supprimerLigne(id, ligneId);
  }

  @Post(":id/numeros")
  ajouterNumero(@Param("id") id: string, @Body() dto: AjouterNumeroDto) {
    return this.service.ajouterNumero(id, dto.numero);
  }

  @Roles(...ROLES_SANTE)
  @Delete(":id/numeros/:numeroId")
  supprimerNumero(@Param("id") id: string, @Param("numeroId") numeroId: string) {
    return this.service.supprimerNumero(id, numeroId);
  }
}
