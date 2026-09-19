import { BadRequestException, Body, Controller, Post, Get, Query, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportService } from "./import.service";
import { ImportFacturesDto } from "./dto/import-facture.dto";
import { ImportReglementsDto } from "./dto/import-reglement.dto";
import { ImportAccordsPrealablesDto } from "./dto/import-accord-prealable.dto";

// 2026-09 — voir demande utilisateur : "il faut que chaque import puisse
// générer une écriture de plus de 50000 lignes... sans planter le système."
// Tous les imports .xlsx (pas seulement le mode global Factures) partagent
// désormais la même limite large — un fichier de 50 000+ lignes avec mise
// en forme/richText peut peser plusieurs Mo, l'ancienne limite de 8 Mo
// aurait rejeté l'upload avant même la lecture.
const LIMITE_FICHIER = 50 * 1024 * 1024;
const LIMITE_FICHIER_FACTURES_GLOBAL = LIMITE_FICHIER;
// 2026-09 : 300 s'est révélé trop bas en pratique (LA RUCHE EXCELLENCE a
// tenté d'importer 322 photos d'un coup → "Failed to fetch", le nombre
// de fichiers dépassait `maxCount` de FilesInterceptor, ce qui casse la
// connexion en plein upload au lieu d'une réponse HTTP propre). Relevé
// largement au-dessus de la plus grosse population actuelle (349
// personnes) pour absorber la croissance sans revisiter ce plafond.
const LIMITE_PHOTOS = 2000; // dossier complet en une fois — voir demande utilisateur

@Controller("import")
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  // ── Factures ─────────────────────────────────────────────────────
  // Le MODÈLE reste léger, indépendant du contrat (2026-08 — voir demande
  // utilisateur : "le fichier doit juste être lié au contrat, pas rempli
  // avec toute la population") ; c'est l'APERÇU/LA CONFIRMATION qui sont
  // rattachés au contrat choisi (voir ImportService.parseFactures/
  // importerFactures) — matricule/nom y sont résolus dans SA population.
  @Get("modele-factures")
  async modeleFactures(@Res() res: Response) {
    const buffer = await this.importService.genererModeleFactures();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-factures.xlsx"');
    res.send(buffer);
  }

  @Post("factures/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercuFactures(@Query("contratId") contratId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    if (!contratId) throw new BadRequestException("contratId requis.");
    return this.importService.parseFactures(file.buffer, contratId);
  }

  @Post("factures")
  confirmerFactures(@Body() dto: ImportFacturesDto) {
    return this.importService.importerFactures(dto.contratId, dto.rows);
  }

  // ── Factures — import GLOBAL "tous contrats confondus" (2026-08) — voir
  // demande utilisateur : matricule seul, résolu dans la population de
  // TOUS les contrats, sans aperçu ligne à ligne (upload direct → résumé)
  // pour rester fluide même à 50 000+ lignes. Les lignes dont le matricule
  // n'existe encore dans aucun contrat sont mises en attente (voir
  // ImportService.importerFacturesGlobal) plutôt que rejetées.
  @Get("modele-factures-global")
  async modeleFacturesGlobal(@Res() res: Response) {
    const buffer = await this.importService.genererModeleFacturesGlobal();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-factures-tous-contrats.xlsx"');
    res.send(buffer);
  }

  @Post("factures-global")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER_FACTURES_GLOBAL } }))
  importerFacturesGlobal(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.importService.importerFacturesGlobal(file.buffer);
  }

  // Synchronisation de la file d'attente (2026-08 — voir demande
  // utilisateur : "l'application devra systématiquement synchroniser [et]
  // charger les factures sur les bons contrats") — déclenchée
  // automatiquement par le frontend après tout ajout de population
  // (import Assurés, mouvement Population/Participants), avec ce bouton en
  // repli manuel visible/fiable pour tout autre cas.
  @Post("factures-en-attente/synchroniser")
  synchroniserFacturesEnAttente() {
    return this.importService.synchroniserFacturesEnAttente();
  }

  @Get("factures-en-attente/nombre")
  async compterFacturesEnAttente() {
    return { nombre: await this.importService.compterFacturesEnAttente() };
  }

  // ── Règlements ───────────────────────────────────────────────────
  @Get("modele-reglements")
  async modeleReglements(@Res() res: Response) {
    const buffer = await this.importService.genererModeleReglements();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-reglements.xlsx"');
    res.send(buffer);
  }

  @Post("reglements/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercuReglements(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.importService.parseReglements(file.buffer);
  }

  @Post("reglements")
  confirmerReglements(@Body() dto: ImportReglementsDto) {
    return this.importService.importerReglements(dto.rows);
  }

  // ── Prises en charge ─────────────────────────────────────────────
  // Modèle léger, indépendant du contrat — même principe que Factures.
  @Get("modele-accords-prealables")
  async modeleAccordsPrealables(@Res() res: Response) {
    const buffer = await this.importService.genererModeleAccordsPrealables();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-prises-en-charge.xlsx"');
    res.send(buffer);
  }

  @Post("accords-prealables/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercuAccordsPrealables(@Query("contratId") contratId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    if (!contratId) throw new BadRequestException("contratId requis.");
    return this.importService.parseAccordsPrealables(file.buffer, contratId);
  }

  @Post("accords-prealables")
  confirmerAccordsPrealables(@Body() dto: ImportAccordsPrealablesDto) {
    return this.importService.importerAccordsPrealables(dto.contratId, dto.rows);
  }

  // ── Assurés et ayants droit ───────────────────────────────────────
  @Get("modele-assures")
  async modeleAssures(@Res() res: Response) {
    const buffer = await this.importService.genererModeleAssures();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-assures.xlsx"');
    res.send(buffer);
  }

  @Post("assures/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  apercuAssures(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.importService.parseAssures(file.buffer);
  }

  // ── Photos en masse (2026-08) — voir demande utilisateur : "importer
  // même les photos dans un dossier en une fois (mais il faudra juste que
  // la photo soit renommée par les matricules de bénéficiaire de la
  // photo)". Chaque fichier est apparié à son assuré par son NOM (sans
  // extension) = matricule — voir ImportService.importerPhotos.
  @Post("photos")
  @UseInterceptors(FilesInterceptor("fichiers", LIMITE_PHOTOS, { storage: memoryStorage(), limits: { fileSize: LIMITE_FICHIER } }))
  importerPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException("Aucun fichier reçu.");
    return this.importService.importerPhotos(files);
  }
}
