import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { ASSETS_ROOT } from "../uploads-dir.util";

const GUIDE_DIR = path.join(ASSETS_ROOT, "guide");

// Sécurisation contre le path traversal : seul le nom de fichier est accepté
// (pas de répertoire imbriqué). On autorise chiffres, lettres, tirets et le
// point de l'extension — rien d'autre.
const NOM_VALIDE = /^[a-zA-Z0-9_\-.]+\.png$/;

// Endpoint public (pas de JwtAuthGuard) — les images du guide sont chargées
// via <img src> depuis le frontend, contexte déjà authentifié côté UI. Ce sont
// des captures d'écran de l'interface, pas des données patients.
@Controller("guide-assets")
export class GuideAssetsController {
  @Get(":filename")
  servir(@Param("filename") filename: string, @Res() res: Response): void {
    if (!NOM_VALIDE.test(filename)) {
      res.status(400).json({ message: "Nom de fichier invalide." });
      return;
    }
    const filePath = path.join(GUIDE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(filePath).pipe(res);
  }
}
