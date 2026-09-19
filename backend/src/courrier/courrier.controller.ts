import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CourrierService } from "./courrier.service";
import { CreateCourrierDto } from "./dto/create-courrier.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("courrier")
@UseGuards(JwtAuthGuard)
export class CourrierController {
  constructor(private readonly service: CourrierService) {}

  @Get()
  findAll(
    @Query("reference") reference?: string,
    @Query("typeId") typeId?: string,
    @Query("destinataire") destinataire?: string,
    @Query("auteurId") auteurId?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
  ) {
    return this.service.findAll({ reference, typeId, destinataire, auteurId, du, au });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCourrierDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }
}
