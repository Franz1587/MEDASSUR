import { Module } from "@nestjs/common";
import { TresorerieService } from "./tresorerie.service";
import { TresorerieController } from "./tresorerie.controller";

@Module({
  providers: [TresorerieService],
  controllers: [TresorerieController],
})
export class TresorerieModule {}
