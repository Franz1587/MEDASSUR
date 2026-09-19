import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AvenantsService } from "./avenants.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateAvenantDto } from "./dto/create-avenant.dto";
import { UpdateAvenantDto } from "./dto/update-avenant.dto";

@Controller("avenants")
@UseGuards(JwtAuthGuard)
export class AvenantsController {
  constructor(private readonly service: AvenantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAvenantDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAvenantDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/appliquer")
  appliquer(@Param("id") id: string) {
    return this.service.appliquer(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
