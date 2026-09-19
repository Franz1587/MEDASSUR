import { Module } from "@nestjs/common";
import { BordereauxController } from "./bordereaux.controller";
import { BordereauxService } from "./bordereaux.service";

@Module({
  controllers: [BordereauxController],
  providers: [BordereauxService],
  exports: [BordereauxService],
})
export class BordereauxModule {}
