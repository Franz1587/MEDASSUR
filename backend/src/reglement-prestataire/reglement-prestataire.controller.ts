import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ReglementPrestataireService } from "./reglement-prestataire.service";
import { GenererBordereauDto } from "./dto/generer-bordereau.dto";
import { PayerBordereauDto } from "./dto/payer-bordereau.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("reglement-prestataire")
@UseGuards(JwtAuthGuard)
export class ReglementPrestataireController {
  constructor(private readonly service: ReglementPrestataireService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Déclarée avant ":id" pour que Nest ne capture pas "etat-tps" comme une
  // valeur de :id — état de prélèvement TPS par prestataire × mois de
  // règlement (pièce comptable).
  @Get("etat-tps")
  etatTps(
    @Query("prestataireId") prestataireId?: string, @Query("annee") annee?: string,
    @Query("du") du?: string, @Query("au") au?: string,
  ) {
    return this.service.etatTps({ prestataireId, annee, du, au });
  }

  // Déclarée avant ":id" pour la même raison — liste des prestataires
  // assujettis à la TPS.
  @Get("prestataires-assujettis-tps")
  prestatairesAssujettisTps() {
    return this.service.prestatairesAssujettisTps();
  }

  // Déclarée avant ":id" pour la même raison — historique de factures par
  // exercice, filtrable par prestataire / période / N° de règlement /
  // référence de décompte / assuré (voir écran "Règlement" côté frontend).
  @Get("historique")
  historique(
    @Query("prestataireId") prestataireId?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
    @Query("numeroReglement") numeroReglement?: string,
    @Query("referenceDecompte") referenceDecompte?: string,
    @Query("assure") assure?: string,
    @Query("referenceReglementComptable") referenceReglementComptable?: string,
  ) {
    return this.service.historique({ prestataireId, du, au, numeroReglement, referenceDecompte, assure, referenceReglementComptable });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post("generer")
  genererBordereau(@Body() dto: GenererBordereauDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.genererBordereau(dto, req.user.userId);
  }

  @Patch(":id/valider")
  valider(@Param("id") id: string, @Body("montantValide") montantValide?: number) {
    return this.service.valider(id, montantValide);
  }

  @Patch(":id/rejeter")
  rejeter(@Param("id") id: string) {
    return this.service.rejeter(id);
  }

  // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur.
  @Patch(":id/medecin")
  definirMedecin(@Param("id") id: string, @Body("medecinId") medecinId: string | null) {
    return this.service.definirMedecin(id, medecinId ?? null);
  }

  @Patch(":id/payer")
  payer(@Param("id") id: string, @Body() dto: PayerBordereauDto) {
    return this.service.payer(id, dto);
  }
}
