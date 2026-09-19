import { Module } from "@nestjs/common";
import { PrestatairesService } from "./prestataires.service";
import { PrestatairesController } from "./prestataires.controller";

@Module({
  providers: [PrestatairesService],
  controllers: [PrestatairesController],
  exports: [PrestatairesService],
})
export class PrestatairesModule {}
