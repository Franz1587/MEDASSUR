import { Module } from "@nestjs/common";
import { PrescriptionsService } from "./prescriptions.service";
import { FacturesModule } from "../factures/factures.module";
import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [FacturesModule, DocumentsModule],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
