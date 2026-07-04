import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AccordPrealableService } from "./accord-prealable.service";
import { CreateAccordPrealableDto } from "./dto/create-accord-prealable.dto";
import { DecisionAccordPrealableDto } from "./dto/decision-accord-prealable.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("accord-prealable")
@UseGuards(JwtAuthGuard)
export class AccordPrealableController {
  constructor(private readonly service: AccordPrealableService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccordPrealableDto) {
    return this.service.create(dto);
  }

  @Patch(":id/decision")
  decider(@Param("id") id: string, @Body() dto: DecisionAccordPrealableDto) {
    return this.service.decider(id, dto);
  }
}
