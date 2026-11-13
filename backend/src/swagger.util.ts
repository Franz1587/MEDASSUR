// OpenAPI/Swagger (2026-09) — voir demande utilisateur : "créés-moi un
// fichier openAPI pour toutes les APIs pour que j'aie accès au swagger".
// Document généré par introspection des décorateurs Nest déjà en place sur
// les 72 contrôleurs existants (@Controller/@Get/@Post/...) — aucune
// annotation supplémentaire nécessaire pour une couverture complète des
// routes ; seule la richesse des schémas de DTO reste limitée tant qu'ils
// ne portent pas de @ApiProperty() (hors périmètre ici). Factorisé ici pour
// être utilisé à la fois par main.ts (UI Swagger en ligne) et
// scripts/export-openapi.ts (fichier openapi.json statique) — un seul
// endroit à faire évoluer (titre, version...) pour les deux usages.
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("MEDASSUR+ API")
    .setDescription(
      "API du backend MEDASSUR+ (NestJS/Prisma) — gestion d'assurance santé (contrats, prises en charge, facturation, règlement, comptabilité, portails externes). " +
      "Authentification : obtenir un jeton via POST /api/auth/login, puis cliquer sur \"Authorize\" ci-dessus et coller le jeton (sans le préfixe \"Bearer \").",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "jwt")
    .build();
  return SwaggerModule.createDocument(app, config);
}

// Basic Auth dédiée à /api/docs (2026-09) — voir demande utilisateur,
// tranchée explicitement : l'UI Swagger expose un bouton "Try it out"
// capable d'exécuter de VRAIES requêtes contre la production si la route
// est accessible publiquement — jamais le même mécanisme que
// l'authentification applicative (JWT), volontairement séparé et simple
// (identifiants dédiés SWAGGER_USER/SWAGGER_PASSWORD, jamais commités,
// voir .env.example).
//  - Production : désactivé (404) tant que SWAGGER_USER ET SWAGGER_PASSWORD
//    ne sont pas tous deux définis.
//  - Hors production sans identifiants : accessible uniquement depuis la
//    machine locale (adresse de la socket, jamais X-Forwarded-For).
const empreinte = (s: string) => createHash("sha256").update(s).digest();
const egal = (a: string, b: string) => timingSafeEqual(empreinte(a), empreinte(b));
const ADRESSES_LOCALES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Swagger doit-il être monté ? (faux en production sans identifiants) */
export function swaggerActif(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return !!process.env.SWAGGER_USER && !!process.env.SWAGGER_PASSWORD;
}

export function protegerSwagger(req: Request, res: Response, next: NextFunction) {
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") return res.status(404).send("Not found");
    if (ADRESSES_LOCALES.has(req.socket.remoteAddress ?? "")) return next();
    return res.status(403).send("Accès local uniquement.");
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decode = Buffer.from(header.slice(6), "base64").toString("utf8");
    const i = decode.indexOf(":");
    if (i >= 0) {
      const fourniUser = decode.slice(0, i);
      const fourniPass = decode.slice(i + 1);
      // Les deux comparaisons sont toujours évaluées (pas de court-circuit).
      const userOk = egal(fourniUser, user);
      const passOk = egal(fourniPass, pass);
      if (userOk && passOk) return next();
    }
  }
  res.setHeader("WWW-Authenticate", "Basic realm=\"MEDASSUR+ API docs\"");
  res.status(401).send("Authentification requise.");
}
