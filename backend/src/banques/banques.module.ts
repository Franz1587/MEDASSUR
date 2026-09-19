import { Module } from "@nestjs/common";
import { BanquesService } from "./banques.service";
import { BanquesController } from "./banques.controller";

@Module({
  providers: [BanquesService],
  controllers: [BanquesController],
  exports: [BanquesService],
})
export class BanquesModule {}
