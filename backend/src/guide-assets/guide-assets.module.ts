import { Module } from "@nestjs/common";
import { GuideAssetsController } from "./guide-assets.controller";

@Module({ controllers: [GuideAssetsController] })
export class GuideAssetsModule {}
