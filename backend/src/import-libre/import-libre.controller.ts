import { BadRequestException, Body, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportLibreService, LigneApercu, LignePopulation, LigneActeMedical, TypeImportLibre } from "./import-libre.service";

const LIMITE_FICHIER = 50 * 1024 * 1024; // 50 MB

@Controller("import-libre")
@UseGuards(JwtAuthGuard)
export class ImportLibreController {
  constructor(private readonly service: ImportLibreService) {}

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

  // Confirmation actes médicaux (catalogue)
  @Post("confirmer-actes")
  confirmerActes(@Body("lignes") lignes: LigneActeMedical[]) {
    if (!Array.isArray(lignes) || lignes.length === 0) throw new BadRequestException("Aucune ligne à importer.");
    return this.service.confirmerActesMedicaux(lignes);
  }
}
