import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { HonorairesService } from "./honoraires.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateHonorairesDto } from "./dto/create-honoraires.dto";

@Controller("honoraires")
@UseGuards(JwtAuthGuard)
export class HonorairesController {
  constructor(private readonly service: HonorairesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateHonorairesDto) {
    return this.service.create(dto);
  }

  @Patch(":id/facturer")
  facturer(@Param("id") id: string) {
    return this.service.facturer(id);
  }
}
