import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CompagniesService } from "./compagnies.service";
import { CreateCompagnieDto } from "./dto/create-compagnie.dto";
import { UpdateCompagnieDto } from "./dto/update-compagnie.dto";
import {
  ReplaceAccessoiresDto, ReplaceSurprimesAgeDto, ReplaceClausesAjustementDto,
  ReplaceTerritorialitesDto, ReplaceTauxCouvertureDto, ReplaceGarantiesCatalogueDto,
} from "./dto/replace-listes.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("compagnies")
@UseGuards(JwtAuthGuard)
export class CompagniesController {
  constructor(private readonly compagniesService: CompagniesService) {}

  @Get()
  findAll() {
    return this.compagniesService.findAll();
  }

  // Déclarées avant ":id" pour que Nest ne capture pas "auto-gestion"
  // comme une valeur de :id.
  @Get("auto-gestion")
  findAllAutoGestion() {
    return this.compagniesService.findAllAutoGestion();
  }

  @Post("auto-gestion/:clientId")
  createAutoGestion(@Param("clientId") clientId: string) {
    return this.compagniesService.createAutoGestion(clientId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.compagniesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompagnieDto) {
    return this.compagniesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompagnieDto) {
    return this.compagniesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.compagniesService.remove(id);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.compagniesService.uploadLogo(id, file);
  }

  @Delete(":id/logo")
  deleteLogo(@Param("id") id: string) {
    return this.compagniesService.deleteLogo(id);
  }

  @Put(":id/accessoires")
  replaceAccessoires(@Param("id") id: string, @Body() dto: ReplaceAccessoiresDto) {
    return this.compagniesService.replaceAccessoires(id, dto);
  }

  @Put(":id/surprimes-age")
  replaceSurprimesAge(@Param("id") id: string, @Body() dto: ReplaceSurprimesAgeDto) {
    return this.compagniesService.replaceSurprimesAge(id, dto);
  }

  @Put(":id/clauses-ajustement")
  replaceClausesAjustement(@Param("id") id: string, @Body() dto: ReplaceClausesAjustementDto) {
    return this.compagniesService.replaceClausesAjustement(id, dto);
  }

  @Put(":id/territorialites")
  replaceTerritorialites(@Param("id") id: string, @Body() dto: ReplaceTerritorialitesDto) {
    return this.compagniesService.replaceTerritorialites(id, dto);
  }

  @Put(":id/taux-couverture")
  replaceTauxCouverture(@Param("id") id: string, @Body() dto: ReplaceTauxCouvertureDto) {
    return this.compagniesService.replaceTauxCouverture(id, dto);
  }

  @Put(":id/garanties")
  replaceGarantiesCatalogue(@Param("id") id: string, @Body() dto: ReplaceGarantiesCatalogueDto) {
    return this.compagniesService.replaceGarantiesCatalogue(id, dto);
  }
}
