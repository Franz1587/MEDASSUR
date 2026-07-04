import { Module } from "@nestjs/common";
import { ContratsService } from "./contrats.service";
import { ContratsController } from "./contrats.controller";

@Module({
  providers: [ContratsService],
  controllers: [ContratsController],
  exports: [ContratsService],
})
export class ContratsModule {}
