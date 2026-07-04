import { Module } from "@nestjs/common";
import { DevisService } from "./devis.service";
import { DevisController } from "./devis.controller";

@Module({
  providers: [DevisService],
  controllers: [DevisController],
})
export class DevisModule {}
