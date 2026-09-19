import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { ImportClientsDto } from "./dto/import-clients.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("clients")
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // compagnieId : ne fait remonter que les souscripteurs ayant réellement
  // un Contrat avec cette compagnie (voir écran de génération de
  // règlement — filtre dépendant Compagnie -> Souscripteur).
  @Get()
  findAll(@Query("compagnieId") compagnieId?: string) {
    return this.clientsService.findAll(compagnieId);
  }

  // Import en masse (2026-08) — routes littérales déclarées AVANT ":id"
  // (routage par ordre de déclaration, voir demande utilisateur).
  @Get("modele-import")
  async modeleImport(@Res() res: Response) {
    const buffer = await this.clientsService.genererModeleImport();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-souscripteurs.xlsx"');
    res.send(buffer);
  }

  @Post("import/apercu")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  apercuImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.clientsService.parseImportFile(file.buffer);
  }

  @Post("import")
  confirmerImport(@Body() dto: ImportClientsDto) {
    return this.clientsService.importer(dto.rows);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clientsService.findOne(id);
  }

  @Get(":id/portfolio")
  findPortfolio(@Param("id") id: string) {
    return this.clientsService.findPortfolio(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.clientsService.remove(id);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.clientsService.uploadLogo(id, file);
  }

  @Delete(":id/logo")
  deleteLogo(@Param("id") id: string) {
    return this.clientsService.deleteLogo(id);
  }
}
