import { Module } from "@nestjs/common";
import { SinistresService } from "./sinistres.service";
import { SinistresController } from "./sinistres.controller";

@Module({
  providers: [SinistresService],
  controllers: [SinistresController],
})
export class SinistresModule {}
