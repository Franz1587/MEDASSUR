import {
  Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AppelOffresService } from "./appel-offres.service";
import { CreateAppelOffresDto } from "./dto/create-appel-offres.dto";
import { UpdateAppelOffresDto } from "./dto/update-appel-offres.dto";
import { CreatePropositionDto } from "./dto/create-proposition.dto";
import { UpdatePropositionDto } from "./dto/update-proposition.dto";
import { UploadAppelOffresDocumentDto } from "./dto/upload-document.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("appel-offres")
@UseGuards(JwtAuthGuard)
export class AppelOffresController {
  constructor(private readonly service: AppelOffresService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAppelOffresDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAppelOffresDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/propositions")
  ajouterProposition(@Param("id") id: string, @Body() dto: CreatePropositionDto) {
    return this.service.ajouterProposition(id, dto);
  }

  @Patch(":id/propositions/:propId")
  modifierProposition(@Param("id") id: string, @Param("propId") propId: string, @Body() dto: UpdatePropositionDto) {
    return this.service.modifierProposition(id, propId, dto);
  }

  @Delete(":id/propositions/:propId")
  supprimerProposition(@Param("id") id: string, @Param("propId") propId: string) {
    return this.service.supprimerProposition(id, propId);
  }

  @Post(":id/documents")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  uploaderDocument(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadAppelOffresDocumentDto) {
    return this.service.uploaderDocument(id, file, dto);
  }

  @Delete(":id/documents/:docId")
  supprimerDocument(@Param("id") id: string, @Param("docId") docId: string) {
    return this.service.supprimerDocument(id, docId);
  }
}
