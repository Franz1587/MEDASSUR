import { Module } from "@nestjs/common";
import { PortailMedecinController } from "./portail-medecin.controller";
import { DocumentsModule } from "../documents/documents.module";
import { PrescriptionsModule } from "../prescriptions/prescriptions.module";

@Module({
  imports: [DocumentsModule, PrescriptionsModule],
  controllers: [PortailMedecinController],
})
export class PortailMedecinModule {}
