import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CommunicationsService } from "./communications.service";
import { EnvoyerCommunicationDto } from "./dto/envoyer-communication.dto";
import { RetourCommunicationDto } from "./dto/retour-communication.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("communications")
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get()
  findAll(@Query("canal") canal?: string, @Query("destinataireType") destinataireType?: string, @Query("declencheur") declencheur?: string) {
    return this.service.findAll({ canal, destinataireType, declencheur });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  envoyer(@Body() dto: EnvoyerCommunicationDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.envoyer(dto, req.user.userId);
  }

  @Patch(":id/retour")
  enregistrerRetour(@Param("id") id: string, @Body() dto: RetourCommunicationDto) {
    return this.service.enregistrerRetour(id, dto.retour);
  }
}
