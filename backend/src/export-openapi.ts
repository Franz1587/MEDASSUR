// Export statique du document OpenAPI (2026-09) — voir demande utilisateur :
// "créés-moi un fichier openAPI pour toutes les APIs". Réutilise EXACTEMENT
// le même document que l'UI Swagger en ligne (voir swagger.util.ts,
// buildOpenApiDocument) — un seul endroit fait foi pour les deux. Compilé
// avec le reste du projet (nest build), exécuté séparément via
// `node dist/export-openapi.js` (voir package.json, script "swagger:export"),
// jamais lancé au démarrage normal du serveur.
import { writeFileSync } from "fs";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { buildOpenApiDocument } from "./swagger.util";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  // dist/src/export-openapi.js -> backend/openapi.json (même racine que
  // package.json, voir "start": "node dist/src/main.js" pour la même
  // structure de compilation dist/src/*.js).
  const outPath = join(__dirname, "..", "..", "openapi.json");
  writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  console.log(`Document OpenAPI écrit : ${outPath} (${Object.keys(document.paths).length} route(s)).`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
