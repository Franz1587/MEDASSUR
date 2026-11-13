import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BanquesService } from "./banques.service";
import { CreateBanqueDto } from "./dto/create-banque.dto";
import { CreateLotChequesDto } from "./dto/create-lot-cheques.dto";
import { CreateCompteReglementDto } from "./dto/create-compte-reglement.dto";
import { UpdateBanqueDto } from "./dto/update-banque.dto";
import { UpdateCompteReglementDto } from "./dto/update-compte-reglement.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_REGLEMENT } from "../auth/access-roles";

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
  @Roles(...ROLES_REGLEMENT)
  @Get("statistiques")
  statistiques() {
    return this.service.statistiques();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Roles(...ROLES_REGLEMENT)
  @Get(":id/mouvements")
  mouvements(@Param("id") id: string) {
    return this.service.mouvements(id);
  }

  @Roles(...ROLES_REGLEMENT)
  @Post()
  create(@Body() dto: CreateBanqueDto) {
    return this.service.create(dto);
  }

  @Roles(...ROLES_REGLEMENT)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBanqueDto) {
    return this.service.update(id, dto);
  }

  @Roles(...ROLES_REGLEMENT)
  @Post(":id/lots")
  ajouterLot(@Param("id") id: string, @Body() dto: CreateLotChequesDto) {
    return this.service.ajouterLot(id, dto);
  }

  // Comptes de règlement — sous-comptes d'une banque pour les règlements
  // prestataires (2026-10, demande utilisateur : "Orabank Sanlam, Orabank NSIA").
  @Roles(...ROLES_REGLEMENT)
  @Post("comptes")
  ajouterCompte(@Body() dto: CreateCompteReglementDto) {
    return this.service.ajouterCompte(dto);
  }

  @Roles(...ROLES_REGLEMENT)
  @Patch("comptes/:compteId")
  updateCompte(@Param("compteId") id: string, @Body() dto: UpdateCompteReglementDto) {
    return this.service.updateCompte(id, dto);
  }
}
