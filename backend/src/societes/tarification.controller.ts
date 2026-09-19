import { Body, Controller, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { TarificationService } from "./tarification.service";
import { UpsertModulePrixDto } from "./dto/module-prix.dto";
import { UpsertTauxChangeDto } from "./dto/taux-change.dto";
import { UpdateParametresFacturationDto } from "./dto/parametres-facturation.dto";

// Tarification par module + taux de change — réservé au Super Admin (voir
// TarificationService).
@Controller("tarification")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class TarificationController {
  constructor(private readonly service: TarificationService) {}

  @Get("modules")
  getModulePrix() {
    return this.service.getModulePrix();
  }

  @Post("modules")
  upsertModulePrix(@Body() dto: UpsertModulePrixDto) {
    return this.service.upsertModulePrix(dto);
  }

  @Get("taux-change")
  getTauxChange() {
    return this.service.getTauxChange();
  }

  @Post("taux-change")
  upsertTauxChange(@Body() dto: UpsertTauxChangeDto) {
    return this.service.upsertTauxChange(dto);
  }

  // Estimation en direct (2026-09) — voir demande utilisateur : "l'option
  // d'abonnement s'enrichisse en fonction des fonctionnalités cochées" —
  // consommé par le picker de modules à chaque coche pour afficher un total
  // qui évolue en temps réel.
  @Get("estimation")
  estimation(@Query("modules") modules?: string) {
    const liste = modules ? modules.split(",").filter(Boolean) : [];
    return this.service.calculerPrixModules(liste).then((prixMensuelXaf) => ({ prixMensuelXaf }));
  }

  // Tarification par personne assurée (2026-09) — voir demande
  // utilisateur : "la licence annuelle par assuré... on facture la carte
  // par assuré et ayant droit."
  @Get("parametres")
  getParametresFacturation() {
    return this.service.getParametresFacturation();
  }

  @Patch("parametres")
  updateParametresFacturation(@Body() dto: UpdateParametresFacturationDto) {
    return this.service.updateParametresFacturation(dto);
  }
}
