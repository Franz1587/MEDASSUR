import { Module } from "@nestjs/common";
import { GedService } from "./ged.service";
import { GedController } from "./ged.controller";

@Module({
  providers: [GedService],
  controllers: [GedController],
})
export class GedModule {}
