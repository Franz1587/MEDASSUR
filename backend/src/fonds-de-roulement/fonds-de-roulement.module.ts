import { Module } from "@nestjs/common";
import { FondsDeRoulementService } from "./fonds-de-roulement.service";
import { FondsDeRoulementController } from "./fonds-de-roulement.controller";

@Module({
  providers: [FondsDeRoulementService],
  controllers: [FondsDeRoulementController],
})
export class FondsDeRoulementModule {}
