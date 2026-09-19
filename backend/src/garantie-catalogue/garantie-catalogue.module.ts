import { Module } from "@nestjs/common";
import { GarantieCatalogueService } from "./garantie-catalogue.service";
import { GarantieCatalogueController } from "./garantie-catalogue.controller";

@Module({
  providers: [GarantieCatalogueService],
  controllers: [GarantieCatalogueController],
})
export class GarantieCatalogueModule {}
