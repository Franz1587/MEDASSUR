import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "medassur-dev-secret-change-in-production",
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  // JwtModule exporté (2026-09) — réutilisé par SocietesModule pour émettre
  // un token de "mode assistance" (voir SocietesService.assistance), avec
  // exactement le même secret/signature que la connexion normale.
  exports: [JwtModule],
})
export class AuthModule {}
