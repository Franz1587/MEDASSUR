import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateProspectDto } from "./dto/create-prospect.dto";
import { UpdateProspectDto } from "./dto/update-prospect.dto";
import { AjouterNoteProspectDto } from "./dto/ajouter-note-prospect.dto";
import { LierClientProspectDto } from "./dto/lier-client-prospect.dto";

type ReqUser = Request & { user: { userId: string } };

@Controller("crm/prospects")
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  // Déclarée AVANT ":id" — même précaution de routage que partout ailleurs
  // dans ce backend (voir FacturesController) : "statistiques" serait
  // sinon capturé comme une valeur de :id.
  @Get("statistiques")
  statistiques(@Query("exercice") exercice?: string) {
    return this.service.statistiques(exercice);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/suggestion-commission")
  suggestionCommission(@Param("id") id: string) {
    return this.service.suggestionsCommission(id);
  }

  @Post()
  create(@Body() dto: CreateProspectDto, @Req() req: ReqUser) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProspectDto, @Req() req: ReqUser) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Post(":id/notes")
  ajouterNote(@Param("id") id: string, @Body() dto: AjouterNoteProspectDto, @Req() req: ReqUser) {
    return this.service.ajouterNote(id, dto.description, req.user.userId);
  }

  @Patch(":id/lier-client")
  lierClient(@Param("id") id: string, @Body() dto: LierClientProspectDto, @Req() req: ReqUser) {
    return this.service.lierClient(id, dto.clientId, req.user.userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadLogo(id, file);
  }

  @Delete(":id/logo")
  deleteLogo(@Param("id") id: string) {
    return this.service.deleteLogo(id);
  }
}
