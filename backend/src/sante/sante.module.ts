import { Module } from "@nestjs/common";
import { SanteService } from "./sante.service";
import { SanteController } from "./sante.controller";

@Module({
  providers: [SanteService],
  controllers: [SanteController],
})
export class SanteModule {}
