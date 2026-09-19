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

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("MedAssur API")
    .setDescription(
      "API du backend MedAssur (NestJS/Prisma) — gestion d'assurance santé (contrats, prises en charge, facturation, règlement, comptabilité, portails externes). " +
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
// voir .env.example). Sans ces variables (dev local non configuré) : laisse
// passer sans prompt, pour ne jamais gêner le développement quotidien.
export function protegerSwagger(req: Request, res: Response, next: NextFunction) {
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const [fourni, motDePasseFourni] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
    if (fourni === user && motDePasseFourni === pass) return next();
  }
  res.setHeader("WWW-Authenticate", "Basic realm=\"MedAssur API docs\"");
  res.status(401).send("Authentification requise.");
}
