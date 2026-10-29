import { Module } from "@nestjs/common";
import { ImportLibreService } from "./import-libre.service";
import { ImportLibreController } from "./import-libre.controller";
import { SanteModule } from "../sante/sante.module";
import { FacturesModule } from "../factures/factures.module";
import { PrestatairesModule } from "../prestataires/prestataires.module";

@Module({
  imports: [SanteModule, FacturesModule, PrestatairesModule],
  providers: [ImportLibreService],
  controllers: [ImportLibreController],
})
export class ImportLibreModule {}
