import { Module } from "@nestjs/common";
import { QuittancesLibresService } from "./quittances-libres.service";
import { QuittancesLibresController } from "./quittances-libres.controller";

@Module({
  providers: [QuittancesLibresService],
  controllers: [QuittancesLibresController],
  exports: [QuittancesLibresService],
})
export class QuittancesLibresModule {}
