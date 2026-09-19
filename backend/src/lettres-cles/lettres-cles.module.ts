import { Module } from "@nestjs/common";
import { LettresClesService } from "./lettres-cles.service";
import { LettresClesController } from "./lettres-cles.controller";

@Module({
  providers: [LettresClesService],
  controllers: [LettresClesController],
  exports: [LettresClesService],
})
export class LettresClesModule {}
