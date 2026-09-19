import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LettresClesService } from "./lettres-cles.service";
import { CreateLettreCleDto } from "./dto/create-lettre-cle.dto";
import { UpdateLettreCleDto } from "./dto/update-lettre-cle.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("lettres-cles")
@UseGuards(JwtAuthGuard)
export class LettresClesController {
  constructor(private readonly service: LettresClesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":code")
  findOne(@Param("code") code: string) {
    return this.service.findOne(code);
  }

  @Post()
  create(@Body() dto: CreateLettreCleDto) {
    return this.service.create(dto);
  }

  @Patch(":code")
  update(@Param("code") code: string, @Body() dto: UpdateLettreCleDto) {
    return this.service.update(code, dto);
  }

  @Delete(":code")
  remove(@Param("code") code: string) {
    return this.service.remove(code);
  }
}
