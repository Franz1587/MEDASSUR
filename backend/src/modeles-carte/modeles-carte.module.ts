import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ModelesCarteService } from "./modeles-carte.service";
import { ModelesCarteController } from "./modeles-carte.controller";

@Module({
  imports: [PrismaModule],
  providers: [ModelesCarteService],
  controllers: [ModelesCarteController],
  exports: [ModelesCarteService],
})
export class ModelesCarteModule {}
