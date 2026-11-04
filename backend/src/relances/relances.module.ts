import { Module } from "@nestjs/common";
import { RelancesService } from "./relances.service";
import { RelancesController } from "./relances.controller";
import { CommunicationsModule } from "../communications/communications.module";

@Module({
  imports: [CommunicationsModule],
  providers: [RelancesService],
  controllers: [RelancesController],
})
export class RelancesModule {}
