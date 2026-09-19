import { Module } from "@nestjs/common";
import { RoleTemplatesService } from "./role-templates.service";
import { RoleTemplatesController } from "./role-templates.controller";

@Module({
  providers: [RoleTemplatesService],
  controllers: [RoleTemplatesController],
  exports: [RoleTemplatesService],
})
export class RoleTemplatesModule {}
