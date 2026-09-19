import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import { CotationService } from "./cotation.service";
import { CreateCotationDto } from "./dto/create-cotation.dto";
import { UpdateCotationDto } from "./dto/update-cotation.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("cotation")
@UseGuards(JwtAuthGuard)
export class CotationController {
  constructor(private readonly service: CotationService) {}

  @Get()
  findAll(@Query("appelOffresId") appelOffresId?: string) {
    return this.service.findAll(appelOffresId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCotationDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCotationDto) {
    return this.service.update(id, dto);
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
