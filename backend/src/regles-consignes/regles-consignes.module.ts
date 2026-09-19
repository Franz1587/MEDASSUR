import { Module } from "@nestjs/common";
import { ReglesConsignesService } from "./regles-consignes.service";
import { ReglesConsignesController } from "./regles-consignes.controller";

@Module({
  controllers: [ReglesConsignesController],
  providers: [ReglesConsignesService],
  exports: [ReglesConsignesService],
})
export class ReglesConsignesModule {}
