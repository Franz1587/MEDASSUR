import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportLibreService, LigneApercu } from "./import-libre.service";

const LIMITE_FICHIER = 50 * 1024 * 1024; // 50 MB

@Controller("import-libre")
@UseGuards(JwtAuthGuard)
export class ImportLibreController {
  constructor(private readonly service: ImportLibreService) {}

  @Post("apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercu(@UploadedFile() file: Express.Multer.File, @Body("modeCorrection") modeCorrection?: string) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.service.apercu(file, modeCorrection === "true");
  }

  @Post("confirmer")
  confirmer(@Body("lignes") lignes: LigneApercu[], @Body("modeCorrection") modeCorrection?: boolean) {
    if (!Array.isArray(lignes) || lignes.length === 0) throw new BadRequestException("Aucune ligne à importer.");
    return this.service.confirmer(lignes, modeCorrection === true);
  }
}
