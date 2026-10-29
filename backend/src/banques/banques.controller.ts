import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BanquesService } from "./banques.service";
import { CreateBanqueDto } from "./dto/create-banque.dto";
import { CreateLotChequesDto } from "./dto/create-lot-cheques.dto";
import { CreateCompteReglementDto } from "./dto/create-compte-reglement.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("banques")
@UseGuards(JwtAuthGuard)
export class BanquesController {
  constructor(private readonly service: BanquesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Route littérale AVANT ":id" (voir convention NestJS établie), sinon
  // ":id" absorbe "statistiques" comme un identifiant de banque.
  @Get("statistiques")
  statistiques() {
    return this.service.statistiques();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/mouvements")
  mouvements(@Param("id") id: string) {
    return this.service.mouvements(id);
  }

  @Post()
  create(@Body() dto: CreateBanqueDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: Partial<CreateBanqueDto> & { statut?: string }) {
    return this.service.update(id, dto);
  }

  @Post(":id/lots")
  ajouterLot(@Param("id") id: string, @Body() dto: CreateLotChequesDto & { compteReglementId?: string }) {
    return this.service.ajouterLot(id, dto);
  }

  // Comptes de règlement — sous-comptes d'une banque pour les règlements
  // prestataires (2026-10, demande utilisateur : "Orabank Sanlam, Orabank NSIA").
  @Post("comptes")
  ajouterCompte(@Body() dto: CreateCompteReglementDto) {
    return this.service.ajouterCompte(dto);
  }

  @Patch("comptes/:compteId")
  updateCompte(@Param("compteId") id: string, @Body() dto: Partial<CreateCompteReglementDto> & { statut?: string }) {
    return this.service.updateCompte(id, dto);
  }
}
