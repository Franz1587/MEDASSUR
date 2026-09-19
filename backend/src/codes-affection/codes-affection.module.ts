import { Module } from "@nestjs/common";
import { CodesAffectionController } from "./codes-affection.controller";

@Module({
  controllers: [CodesAffectionController],
})
export class CodesAffectionModule {}
