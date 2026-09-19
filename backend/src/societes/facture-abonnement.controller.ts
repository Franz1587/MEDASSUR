import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { FactureAbonnementService } from "./facture-abonnement.service";
import { GenererFactureAbonnementDto } from "./dto/generer-facture-abonnement.dto";
import { PayerFactureAbonnementDto } from "./dto/payer-facture-abonnement.dto";

// Comptabilité / Facturation plateforme (2026-09) — voir demande
// utilisateur : "un module complet de comptabilité avec tous les états...
// un vrai formulaire dédié à la facturation." Réservé au Super Admin.
@Controller("facturation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class FactureAbonnementController {
  constructor(private readonly service: FactureAbonnementService) {}

  @Get("factures")
  findAll(@Query("societeId") societeId?: string, @Query("statut") statut?: string, @Query("type") type?: string) {
    return this.service.findAll({ societeId, statut, type });
  }

  @Get("factures/:id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  // Document PDF conforme aux normes de facturation (2026-09) — voir
  // demande utilisateur : "l'application doit générer une facture
  // conforme aux normes comptable et de facturation."
  @Get("factures/:id/pdf")
  genererPdf(@Param("id") id: string, @Res() res: Response) {
    return this.service.genererPdf(id, res);
  }

  @Get("resume")
  resume() {
    return this.service.resume();
  }

  // États comptables (2026-09) — voir demande utilisateur.
  @Get("etats/balance-agee")
  balanceAgee() {
    return this.service.balanceAgee();
  }

  @Get("etats/taxes")
  etatTaxes(@Query("du") du?: string, @Query("au") au?: string) {
    return this.service.etatTaxes(du, au);
  }

  @Get("societes/:societeId/grand-livre")
  grandLivre(@Param("societeId") societeId: string) {
    return this.service.grandLivre(societeId);
  }

  // Lettrage du compte 411 (2026-09) — voir demande utilisateur.
  @Get("etats/lettrage-clients")
  lettrageClients() {
    return this.service.lettrageClients();
  }

  // États SYSCOHADA (2026-09) — voir demande utilisateur : "au Gabon...
  // c'est le SYSCOHADA qui est en vigueur (avec le plan comptable OHADA)...
  // il faut tous les états comptable, bilan, compte de résultat, résultat
  // net de l'exercice."
  @Get("etats/journal")
  journalOhada() {
    return this.service.journalOhada();
  }

  @Get("etats/balance-generale")
  balanceOhada() {
    return this.service.balanceOhada();
  }

  @Get("etats/compte-de-resultat")
  compteDeResultat() {
    return this.service.compteDeResultat();
  }

  @Get("etats/bilan")
  bilan() {
    return this.service.bilan();
  }

  // Formulaire de facturation complet (2026-09) — voir demande utilisateur.
  @Post("societes/:societeId/factures")
  genererFacture(@Param("societeId") societeId: string, @Body() dto: GenererFactureAbonnementDto) {
    return this.service.genererFacture(societeId, dto);
  }

  // Insertion rapide (2026-09) — voir demande utilisateur : "le formulaire
  // de facturation... ne fonctionne toujours pas comme une facturation
  // dédiée." Calcule les lignes (abonnement/installation/cartes) SANS
  // créer de facture, pour les insérer dans l'éditeur multi-lignes toujours
  // visible du formulaire.
  @Get("societes/:societeId/lignes-suggerees")
  suggererLignes(@Param("societeId") societeId: string, @Query("type") type: string, @Query("nombrePersonnes") nombrePersonnes?: string) {
    return this.service.suggererLignes(societeId, type, { nombrePersonnes: nombrePersonnes ? Number(nombrePersonnes) : undefined });
  }

  @Patch("factures/:id/payer")
  payer(@Param("id") id: string, @Body() dto: PayerFactureAbonnementDto) {
    return this.service.payer(id, dto);
  }

  @Patch("factures/:id/annuler")
  annuler(@Param("id") id: string) {
    return this.service.annuler(id);
  }
}
