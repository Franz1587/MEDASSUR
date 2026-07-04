import { Module } from "@nestjs/common";
import { RecouvrementService } from "./recouvrement.service";
import { RecouvrementController } from "./recouvrement.controller";

@Module({
  providers: [RecouvrementService],
  controllers: [RecouvrementController],
})
export class RecouvrementModule {}
