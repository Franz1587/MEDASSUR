import { Module } from "@nestjs/common";
import { ActesMedicauxService } from "./actes-medicaux.service";
import { ActesMedicauxController } from "./actes-medicaux.controller";

@Module({
  providers: [ActesMedicauxService],
  controllers: [ActesMedicauxController],
})
export class ActesMedicauxModule {}
