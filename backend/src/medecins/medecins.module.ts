import { Module } from "@nestjs/common";
import { MedecinsController } from "./medecins.controller";
import { MedecinsService } from "./medecins.service";

@Module({
  controllers: [MedecinsController],
  providers: [MedecinsService],
  exports: [MedecinsService],
})
export class MedecinsModule {}
