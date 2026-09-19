import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LettrageService } from "./lettrage.service";
import { LettrageController } from "./lettrage.controller";

@Module({
  imports: [PrismaModule],
  providers: [LettrageService],
  controllers: [LettrageController],
  exports: [LettrageService],
})
export class LettrageModule {}
