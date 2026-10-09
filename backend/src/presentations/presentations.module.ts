import { Module } from "@nestjs/common";
import { PresentationsController } from "./presentations.controller";

@Module({ controllers: [PresentationsController] })
export class PresentationsModule {}
