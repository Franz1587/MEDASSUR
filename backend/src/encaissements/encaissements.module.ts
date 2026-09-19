import { Module } from "@nestjs/common";
import { EncaissementsController } from "./encaissements.controller";
import { EncaissementsService } from "./encaissements.service";

@Module({
  controllers: [EncaissementsController],
  providers: [EncaissementsService],
  exports: [EncaissementsService],
})
export class EncaissementsModule {}
