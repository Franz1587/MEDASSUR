import { Module } from "@nestjs/common";
import { HonorairesService } from "./honoraires.service";
import { HonorairesController } from "./honoraires.controller";

@Module({
  providers: [HonorairesService],
  controllers: [HonorairesController],
})
export class HonorairesModule {}
