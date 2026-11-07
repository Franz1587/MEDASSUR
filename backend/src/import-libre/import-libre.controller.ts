import { BadRequestException, Body, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportLibreService, LigneApercu, LignePopulation, LigneActeMedical, TypeImportLibre } from "./import-libre.service";
import { ImportClasseurService, type OptionsClasseur } from "./import-classeur.service";
import { ImportPecService } from "./import-pec.service";

const LIMITE_FICHIER = 50 * 1024 * 1024; // 50 MB

@Controller("import-libre")
@UseGuards(JwtAuthGuard)
export class ImportLibreController {
  constructor(
    private readonly service: ImportLibreService,
    private readonly classeurs: ImportClasseurService,
    private readonly pec: ImportPecService,
  ) {}

  // Aperçu universel — détecte le type si type=auto (défaut)
  @Post("apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercu(
    @UploadedFile() file: Express.Multer.File,
    @Body("modeCorrection") modeCorrection?: string,
    @Query("type") type?: TypeImportLibre,
  ) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.service.apercu(file, modeCorrection === "true", type ?? "auto");
  }

  // Confirmation factures
  @Post("confirmer")
  confirmer(
    @Body("lignes") lignes: LigneApercu[],
    @Body("modeCorrection") modeCorrection?: boolean,
    @Query("type") type?: TypeImportLibre,
  ) {
    if (!Array.isArray(lignes) || lignes.length === 0) throw new BadRequestException("Aucune ligne à importer.");
    return this.service.confirmer(lignes, modeCorrection === true, type ?? "factures");
  }

  // Confirmation population (statuts + contrats)
  @Post("confirmer-population")
  confirmerPopulation(@Body("lignes") lignes: LignePopulation[]) {
    if (!Array.isArray(lignes) || lignes.length === 0) throw new BadRequestException("Aucune ligne à importer.");
    return this.service.confirmerPopulation(lignes);
  }

  // Confirmation d'un classeur multi-feuilles : l'aperçu est gardé côté serveur (planId).
  @Post("confirmer-classeur")
  confirmerClasseur(@Body("planId") planId: string, @Body("options") options?: Partial<OptionsClasseur>) {
    if (!planId) throw new BadRequestException("Aperçu manquant — relancez l'analyse du classeur.");
    return this.classeurs.confirmer(planId, options ?? {});
  }

  // Confirmation PEC (entente préalable) — plan gardé côté serveur
  @Post("confirmer-pec")
  confirmerPec(@Body("planId") planId: string) {
    if (!planId) throw new BadRequestException("Aperçu manquant — relancez l'analyse.");
    return this.pec.confirmer(planId);
  }

  // Confirmation actes médicaux (catalogue)
  @Post("confirmer-actes")
  confirmerActes(@Body("lignes") lignes: LigneActeMedical[]) {
    if (!Array.isArray(lignes) || lignes.length === 0) throw new BadRequestException("Aucune ligne à importer.");
    return this.service.confirmerActesMedicaux(lignes);
  }
}
