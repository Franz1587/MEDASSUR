import { Module } from "@nestjs/common";
import { CourrierService } from "./courrier.service";
import { CourrierController } from "./courrier.controller";
import { CourrierTypeService } from "./courrier-type.service";
import { CourrierTypeController } from "./courrier-type.controller";

@Module({
  providers: [CourrierService, CourrierTypeService],
  controllers: [CourrierController, CourrierTypeController],
  exports: [CourrierService, CourrierTypeService],
})
export class CourrierModule {}
