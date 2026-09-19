import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditLogService } from "./audit-log.service";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";

@Module({
  imports: [ParametresEntrepriseModule],
  providers: [
    AuditLogService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  controllers: [AuditController],
  exports: [AuditLogService],
})
export class AuditModule {}
