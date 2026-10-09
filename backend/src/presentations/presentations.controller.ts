import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ASSETS_ROOT } from "../uploads-dir.util";

const PRESENTATIONS_DIR = path.join(ASSETS_ROOT, "presentations");

const FICHIERS: Record<string, { nom: string; mime: string }> = {
  "fr-pptx": { nom: "MEDASSUR+ - Présentation.pptx",       mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  "fr-pdf":  { nom: "MEDASSUR+ - Présentation.pdf",        mime: "application/pdf" },
  "en-pptx": { nom: "MEDASSUR+ - Presentation (EN).pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  "en-pdf":  { nom: "MEDASSUR+ - Presentation (EN).pdf",  mime: "application/pdf" },
};

const SOURCES: Record<string, string> = {
  "fr-pptx": "medassur-plus-presentation-fr.pptx",
  "fr-pdf":  "medassur-plus-presentation-fr.pdf",
  "en-pptx": "medassur-plus-presentation-en.pptx",
  "en-pdf":  "medassur-plus-presentation-en.pdf",
};

@Controller("presentations")
@UseGuards(JwtAuthGuard)
export class PresentationsController {
  @Get("download")
  download(
    @Query("lang") lang: string,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    const cle = `${lang ?? "fr"}-${format ?? "pdf"}`;
    const meta = FICHIERS[cle];
    const fichierSrc = SOURCES[cle];
    if (!meta || !fichierSrc) {
      res.status(400).json({ message: "Paramètres lang/format invalides." });
      return;
    }
    const filePath = path.join(PRESENTATIONS_DIR, fichierSrc);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: "Fichier non trouvé." });
      return;
    }
    res.setHeader("Content-Type", meta.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${meta.nom}"`);
    res.setHeader("Content-Length", fs.statSync(filePath).size);
    fs.createReadStream(filePath).pipe(res);
  }
}
