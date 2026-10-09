import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { ASSETS_ROOT } from "../uploads-dir.util";

const GUIDE_DIR = path.join(ASSETS_ROOT, "guide");

const NOM_VALIDE = /^[a-zA-Z0-9_\-.]+\.png$/;

@Controller("guide-assets")
export class GuideAssetsController {
  @Get(":filename")
  async servir(@Param("filename") filename: string, @Res() res: Response): Promise<void> {
    if (!NOM_VALIDE.test(filename)) {
      res.status(400).json({ message: "Nom de fichier invalide." });
      return;
    }
    const filePath = path.join(GUIDE_DIR, filename);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(filePath).pipe(res);
  }
}
