import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { GedService } from "./ged.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("ged/documents")
@UseGuards(JwtAuthGuard)
export class GedController {
  constructor(private readonly service: GedService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Import réel (2026-09) — multipart : `sens` requis, `prestataireId`/
  // `entiteLiee`/`tags` (CSV) facultatifs. Champs simples en @Query, comme
  // ImportController.apercuFactures — un DTO @Body() classique se prête mal
  // à un formulaire multipart mêlant fichier et champs texte.
  @Post("upload")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query("sens") sens: "Entrant" | "Sortant",
    @Query("prestataireId") prestataireId: string | undefined,
    @Query("entiteLiee") entiteLiee: string | undefined,
    @Query("tags") tags: string | undefined,
    @Query("dateCachetManuelle") dateCachetManuelle: string | undefined,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.service.upload(
      file,
      { sens: sens === "Sortant" ? "Sortant" : "Entrant", prestataireId, entiteLiee, tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [], dateCachetManuelle: dateCachetManuelle || undefined },
      req.user.userId,
    );
  }

  @Get(":id/fichier")
  fichier(@Param("id") id: string, @Res() res: Response) {
    return this.service.streamFichier(id, res);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { prestataireId?: string | null; entiteLiee?: string; dateCachet?: string | null }) {
    return this.service.update(id, body);
  }

  @Post(":id/rapprocher")
  rapprocher(@Param("id") id: string) {
    return this.service.rapprocher(id);
  }

  @Get(":id/rapport-liaison")
  rapportLiaison(@Param("id") id: string) {
    return this.service.genererRapportLiaison(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
