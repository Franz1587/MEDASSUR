import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { IdempotenceInterceptor } from "./idempotence.interceptor";

@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor }],
})
export class IdempotenceModule {}
