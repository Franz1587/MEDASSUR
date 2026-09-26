import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request, Response } from "express";
import { ContratsService } from "./contrats.service";
import { CreateContratDto } from "./dto/create-contrat.dto";
import { UpdateContratDto } from "./dto/update-contrat.dto";
import { ReplaceGarantiesDto } from "./dto/replace-garanties.dto";
import { MouvementPopulationDto } from "./dto/mouvement-population.dto";
import { BasculerPopulationDto } from "./dto/basculer-population.dto";
import { ImportContratsDto } from "./dto/import-contrats.dto";
import { UpdateExerciceDto } from "./dto/update-exercice.dto";
import { UpdateExercicePrimeDto } from "./dto/update-exercice-prime.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CommunicationsService } from "../communications/communications.service";

@Controller("contrats")
@UseGuards(JwtAuthGuard)
export class ContratsController {
  constructor(private readonly contratsService: ContratsService, private readonly communications: CommunicationsService) {}

  @Get()
  findAll(@Query("compagnieId") compagnieId?: string) {
    return this.contratsService.findAll(compagnieId);
  }

  // Doivent rester déclarées AVANT ":id" — sinon Nest matche ces segments
  // littéraux comme valeur de :id (routage par ordre de déclaration).
  // Réimputation des contrats déjà rattachés à une agence (2026-09) — voir
  // demande utilisateur : "Oui, réimputer les 28". Simulation par défaut
  // (liste exacte des changements, rien d'écrit) ; ?appliquer=true pour
  // exécuter. Réservé à la direction/l'administration de la société.
  @Post("reimputer-agences")
  @UseGuards(RolesGuard)
  @Roles("administrateur", "direction_generale", "directeur_technique")
  reimputerAgences(@Query("appliquer") appliquer?: string) {
    return this.contratsService.reimputerContratsAgences(appliquer === "true");
  }

  // Rattrapage des primes (2026-09) — voir demande utilisateur : "ça ne
  // s'actualise pas systématiquement". Recalcule la prime de l'exercice
  // courant de chaque contrat selon sa population réelle (voir
  // prime-exercice.util.ts) ; simulation par défaut, ?appliquer=true pour
  // exécuter. Réservé à la direction/l'administration.
  @Post("recalculer-primes")
  @UseGuards(RolesGuard)
  @Roles("administrateur", "direction_generale", "directeur_technique")
  recalculerPrimes(@Query("appliquer") appliquer?: string) {
    return this.contratsService.recalculerPrimesTousContrats(appliquer === "true");
  }

  @Get("prochain-numero-police")
  prochainNumeroPolice(@Query("compagnieId") compagnieId: string) {
    return this.contratsService.prochainNumeroPolice(compagnieId).then((numeroPolice) => ({ numeroPolice }));
  }

  @Get("modele-import")
  async modeleImport(@Res() res: Response) {
    const buffer = await this.contratsService.genererModeleImport();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-contrats.xlsx"');
    res.send(buffer);
  }

  @Post("import/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  apercuImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.contratsService.parseImportFile(file.buffer);
  }

  @Post("import")
  confirmerImport(@Body() dto: ImportContratsDto) {
    return this.contratsService.importer(dto.rows);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contratsService.findOne(id);
  }

  // Notifie automatiquement tout le réseau de prestataires (2026-08) — voir
  // demande utilisateur : "si un nouveau client est ajouté, l'application
  // doit envoyer l'information systématiquement à tous les prestataires
  // avec la liste des clients actualisée". Fire-and-forget délibéré : un
  // échec de notification ne doit jamais faire échouer la création du
  // contrat elle-même (voir CommunicationsService.
  // notifierPrestatairesNouveauContrat).
  @Post()
  async create(@Body() dto: CreateContratDto, @Req() req: Request & { user: { userId: string } }) {
    const contrat = await this.contratsService.create(dto, req.user.userId);
    this.communications.notifierPrestatairesNouveauContrat(contrat.id).catch(() => undefined);
    return contrat;
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContratDto) {
    return this.contratsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.contratsService.remove(id);
  }

  @Patch(":id/garanties")
  replaceGaranties(@Param("id") id: string, @Body() dto: ReplaceGarantiesDto) {
    return this.contratsService.replaceGaranties(id, dto);
  }

  @Post(":id/mouvement-population")
  mouvementPopulation(@Param("id") id: string, @Body() dto: MouvementPopulationDto) {
    return this.contratsService.mouvementPopulation(id, dto);
  }

  @Post(":id/basculer-population")
  basculerPopulation(@Param("id") id: string, @Body() dto: BasculerPopulationDto) {
    return this.contratsService.basculerPopulation(id, dto);
  }

  @Get(":id/historique-compagnie")
  historiqueCompagnie(@Param("id") id: string) {
    return this.contratsService.historiqueCompagnie(id);
  }

  // Correction manuelle d'un exercice (2026-08 — voir demande utilisateur :
  // recalibrage des exercices suivants après correction d'une date
  // d'import erronée) — voir ContratsService.recalibrerExercice.
  @Patch(":id/exercices/:numero")
  recalibrerExercice(@Param("id") id: string, @Param("numero") numero: string, @Body() dto: UpdateExerciceDto) {
    return this.contratsService.recalibrerExercice(id, Number(numero), dto);
  }

  // Prime détaillée d'un exercice passé (2026-09 — voir demande
  // utilisateur : reprise de données, saisir la prime par personne +
  // accessoires d'une ancienne période pour rendre le calcul du S/P
  // possible sur cette période) — voir ContratsService.mettreAJourPrimeExercice.
  @Patch(":id/exercices/:numero/prime")
  mettreAJourPrimeExercice(@Param("id") id: string, @Param("numero") numero: string, @Body() dto: UpdateExercicePrimeDto) {
    return this.contratsService.mettreAJourPrimeExercice(id, Number(numero), dto);
  }

  // Dérogation de saisie post-résiliation (2026-09) — voir demande
  // utilisateur : bouton "Permettre la saisie des prestations et des
  // prises en charge après la date de résiliation ou fermeture des
  // droits" — voir ContratsService.toggleDerogationSaisie.
  @Patch(":id/derogation-saisie")
  toggleDerogationSaisie(@Param("id") id: string, @Body() dto: { autoriser: boolean }) {
    return this.contratsService.toggleDerogationSaisie(id, !!dto.autoriser);
  }

  // Population reconstituée sur une période passée (du/au optionnels — sans
  // eux, renvoie la population actuelle) + filtre statut — voir l'onglet
  // Population de la fiche contrat, bouton "Rechercher" à côté des filtres.
  @Get(":id/population-historique")
  populationHistorique(
    @Param("id") id: string, @Query("statut") statut?: string, @Query("du") du?: string, @Query("au") au?: string,
  ) {
    return this.contratsService.populationHistorique(id, statut, du, au);
  }
}
