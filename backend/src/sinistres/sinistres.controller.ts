import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SinistresService } from "./sinistres.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateSinistreDto } from "./dto/create-sinistre.dto";
import { UpdateSinistreDto } from "./dto/update-sinistre.dto";

@Controller("sinistres")
@UseGuards(JwtAuthGuard)
export class SinistresController {
  constructor(private readonly service: SinistresService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSinistreDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSinistreDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
