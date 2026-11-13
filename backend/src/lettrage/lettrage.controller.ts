import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_REGLEMENT } from "../auth/access-roles";
import { LettrageService } from "./lettrage.service";

// Lettrage interne — comptes clients (souscripteurs) et fournisseurs
// (prestataires) d'une société — 2026-09. Voir lettrage.service.ts.
@Controller("lettrage")
@UseGuards(JwtAuthGuard)
@Roles(...ROLES_REGLEMENT)
export class LettrageController {
  constructor(private readonly service: LettrageService) {}

  @Get("clients")
  lettrageClients() {
    return this.service.lettrageClients();
  }

  @Get("clients/:clientId")
  lettrageClient(@Param("clientId") clientId: string) {
    return this.service.lettrageClient(clientId);
  }

  @Get("fournisseurs")
  lettrageFournisseurs() {
    return this.service.lettrageFournisseurs();
  }

  @Get("fournisseurs/:prestataireId")
  lettrageFournisseur(@Param("prestataireId") prestataireId: string) {
    return this.service.lettrageFournisseur(prestataireId);
  }
}
