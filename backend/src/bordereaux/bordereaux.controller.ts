import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BordereauxService } from "./bordereaux.service";

// Bordereaux (2026-08) — données JSON pour l'aperçu écran ; le
// téléchargement PDF passe par DocumentsController (voir
// DocumentsService.renderBordereauSinistres), même principe que État TPS.
@Controller("bordereaux")
@UseGuards(JwtAuthGuard)
export class BordereauxController {
  constructor(private readonly service: BordereauxService) {}

  @Get("sinistres")
  sinistres(
    @Query("du") du?: string, @Query("au") au?: string, @Query("compagnieId") compagnieId?: string,
    @Query("typeReglement") typeReglement?: "maladie" | "comptable",
    @Query("agenceId") agenceId?: string, @Query("ville") ville?: string,
  ) {
    return this.service.sinistres(du, au, compagnieId, typeReglement, { agenceId: agenceId || undefined, ville: ville || undefined });
  }

  @Get("sinistres/villes")
  villesPrestataires() {
    return this.service.villesPrestataires();
  }

  @Get("production")
  production(@Query("du") du?: string, @Query("au") au?: string, @Query("compagnieId") compagnieId?: string) {
    return this.service.production(du, au, compagnieId);
  }

  @Get("encaissement")
  encaissement(@Query("du") du?: string, @Query("au") au?: string, @Query("compagnieId") compagnieId?: string) {
    return this.service.encaissement(du, au, compagnieId);
  }
}
