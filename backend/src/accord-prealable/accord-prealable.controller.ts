import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import * as path from "path";
import * as fs from "fs";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import type { Request } from "express";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { CHAMPS_PIECES, TAILLE_MAX_PIECE, piecesRecues, reunirEnUnFichier, type PiecesRecues } from "../lib/pieces-jointes.util";
import { memoryStorage } from "multer";
import { AccordPrealableService } from "./accord-prealable.service";
import { CreateAccordPrealableDto } from "./dto/create-accord-prealable.dto";
import { DecisionAccordPrealableDto } from "./dto/decision-accord-prealable.dto";
import { UpdateAccordPrealableDto } from "./dto/update-accord-prealable.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("accord-prealable")
@UseGuards(JwtAuthGuard)
export class AccordPrealableController {
  constructor(private readonly service: AccordPrealableService) {}

  @Get()
  findAll(
    @Query("contratId") contratId?: string,
    @Query("prestataireId") prestataireId?: string,
    @Query("type") type?: string,
    @Query("decision") decision?: string,
    @Query("origine") origine?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
    @Query("reference") reference?: string,
  ) {
    return this.service.findAll({ contratId, prestataireId, type, decision, origine, du, au, reference });
  }

  // Ordonnance électronique pharmacie (2026-10) — routes déclarées AVANT
  // :id pour éviter qu'Express matche "pharmacie" comme un id générique.
  @Get("pharmacie/:code")
  findByCodePharmacie(@Param("code") code: string) {
    return this.service.findByCodePharmacie(code);
  }

  @Patch("pharmacie/:code/delivrer")
  delivrerParPharmacie(@Param("code") code: string, @Req() req: Request & { user: { prestataireId?: string } }) {
    return this.service.delivrerParPharmacie(code, req.user?.prestataireId ?? "");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccordPrealableDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAccordPrealableDto) {
    return this.service.update(id, dto);
  }

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production".
  @Patch(":id/prendre")
  prendre(@Param("id") id: string, @Req() req: Request & { user: { userId: string } }) {
    return this.service.prendre(id, req.user.userId);
  }

  @Patch(":id/decision")
  decider(@Param("id") id: string, @Body() dto: DecisionAccordPrealableDto) {
    return this.service.decider(id, dto);
  }

  // Contrôleur de demande/saisie (2026-08) — voir demande utilisateur :
  // annule un dossier "En attente" détecté en doublon, pour laisser la
  // place à une nouvelle saisie.
  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body("motif") motif?: string) {
    return this.service.annuler(id, motif);
  }

  @Post(":id/ordonnance")
  @UseInterceptors(FileFieldsInterceptor(CHAMPS_PIECES, { storage: memoryStorage(), limits: { fileSize: TAILLE_MAX_PIECE } }))
  async uploadOrdonnance(@Param("id") id: string, @UploadedFiles() recues: PiecesRecues) {
    const file = (await reunirEnUnFichier(piecesRecues(recues))) as Express.Multer.File;
    return this.service.uploadDocument(id, "ordonnance", file);
  }

  @Post(":id/devis")
  @UseInterceptors(FileFieldsInterceptor(CHAMPS_PIECES, { storage: memoryStorage(), limits: { fileSize: TAILLE_MAX_PIECE } }))
  async uploadDevis(@Param("id") id: string, @UploadedFiles() recues: PiecesRecues) {
    const file = (await reunirEnUnFichier(piecesRecues(recues))) as Express.Multer.File;
    return this.service.uploadDocument(id, "devis", file);
  }

  // Téléchargement du PDF réplique généré par Ariana (numérisation de formulaire médical scanné).
  @Get(":id/document-numerise")
  async downloadDocumentNumerise(@Param("id") id: string, @Res() res: Response) {
    const accord = await this.service.findOne(id);
    const fichier = (accord as { documentNumerise?: string | null }).documentNumerise;
    if (!fichier) return res.status(404).json({ message: "Document numérisé non disponible pour ce dossier." });
    const filePath = path.join(UPLOADS_ROOT, "accords-prealables", fichier);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Fichier introuvable sur le serveur." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fichier}"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
