import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ComptesMobileService } from "./comptes-mobile.service";
import { GenererComptesMobileDto } from "./dto/generer-comptes-mobile.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

// Durcissement (2026-08) — cette action crée désormais un vrai compte
// connectable (voir ComptesMobileService.generer), réservée aux
// gestionnaires internes habilités à gérer la population d'un contrat.
@Controller("comptes-mobile")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrateur", "direction_generale", "directeur_technique", "gestionnaire_production", "gestionnaire_sante")
export class ComptesMobileController {
  constructor(private readonly service: ComptesMobileService) {}

  @Post("generer")
  generer(@Body() dto: GenererComptesMobileDto) {
    return this.service.generer(dto);
  }
}
