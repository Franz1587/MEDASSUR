import { Module } from "@nestjs/common";
import { AccordPrealableService } from "./accord-prealable.service";
import { AccordPrealableController } from "./accord-prealable.controller";

@Module({
  providers: [AccordPrealableService],
  controllers: [AccordPrealableController],
})
export class AccordPrealableModule {}
