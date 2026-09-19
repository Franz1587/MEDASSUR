import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AbonnementController } from "./abonnement.controller";

@Module({
  imports: [PrismaModule],
  controllers: [AbonnementController],
})
export class AbonnementModule {}
