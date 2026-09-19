import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  email: string;
  nom: string;
  roleId: string;
  clientId?: string | null;
  assureSanteId?: string | null;
  prestataireId?: string | null;
  medecinId?: string | null;
  societeId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") ?? "medassur-dev-secret-change-in-production",
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub, email: payload.email, nom: payload.nom, roleId: payload.roleId,
      clientId: payload.clientId ?? null, assureSanteId: payload.assureSanteId ?? null,
      prestataireId: payload.prestataireId ?? null, medecinId: payload.medecinId ?? null,
      societeId: payload.societeId ?? null,
    };
  }
}
