import { Module } from "@nestjs/common";
import { IardService } from "./iard.service";
import { IardController } from "./iard.controller";

@Module({
  providers: [IardService],
  controllers: [IardController],
})
export class IardModule {}
