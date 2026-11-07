import type { ConfigService } from "@nestjs/config";

const LONGUEUR_MIN_SECRET = 32;

/** Secret JWT unique pour la signature (AuthModule) et la vérification (JwtStrategy) — refuse de démarrer sans secret robuste. */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>("JWT_SECRET");
  if (!secret || secret.length < LONGUEUR_MIN_SECRET) {
    throw new Error(`JWT_SECRET manquant ou trop court (${LONGUEUR_MIN_SECRET} caractères minimum requis).`);
  }
  return secret;
}
