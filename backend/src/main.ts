import * as path from "path";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { json, type Request, type Response, type NextFunction } from "express";
import { AppModule } from "./app.module";
import { UPLOADS_ROOT } from "./uploads-dir.util";
import { StorageService } from "./storage/storage.service";
import { buildOpenApiDocument, protegerSwagger } from "./swagger.util";

const MIME_PAR_EXTENSION: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // exposedHeaders : sans ça, le frontend ne peut pas lire Content-Disposition
  // sur une réponse cross-origin (fetch authentifié + blob, voir
  // src/services/documents.service.ts) — nécessaire pour que les documents
  // téléchargés portent leur vrai nom au lieu de l'id de blob généré par le
  // navigateur.
  app.enableCors({ origin: true, credentials: true, exposedHeaders: ["Content-Disposition"] });
  // Sonde de supervision (2026-09) — voir demande utilisateur : outil de
  // déploiement externe ("Kodee") qui vérifie l'état du service via
  // /api/health, jusqu'ici jamais implémenté (404, à tort interprété comme
  // "service non géré" — le vrai service systemd tourne bien, voir
  // "medassur-backend.service"). Route Express brute plutôt qu'un
  // contrôleur Nest : aucune dépendance (DB, storage...) à instancier, sert
  // uniquement à confirmer que le process HTTP répond.
  app.use("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "medassur-backend", uptimeSeconds: Math.round(process.uptime()) });
  });
  // Défaut Express (100kb) trop bas pour l'import population (fichiers
  // CSV de plusieurs milliers de lignes envoyés en un seul body JSON).
  // 50mb (2026-09) — voir demande utilisateur : imports de 50 000+ lignes ;
  // le frontend envoie désormais la confirmation par lots (voir
  // ImportEnMasseModal) mais chaque lot doit rester confortablement sous
  // cette limite même pour des lignes riches en colonnes.
  app.use(json({ limit: "50mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Fichiers uploadés (logos, photos, documents...) — servis en dehors du
  // préfixe /api, sous /uploads/<categorie>/<fichier>, URL STABLE inchangée
  // pour tout le frontend (voir les ~14 helpers `xxxUrl()` de src/services/)
  // quel que soit le stockage réel derrière (2026-09, déploiement Supabase
  // — voir mémoire "project-deploiement-supabase"). Priorité à Supabase
  // Storage quand StorageService est actif (production) ; sinon, ou si le
  // fichier n'y est pas encore (catégorie pas encore migrée, ou fichier
  // créé avant la bascule), repli sur le disque local via `next()` →
  // `useStaticAssets` juste en dessous. Résolu manuellement via `app.get()`
  // (StorageService est @Global(), disponible sans passer par un contrôleur
  // dédié ici).
  const storage = app.get(StorageService);
  app.use("/uploads/:categorie/:fichier", async (req: Request, res: Response, next: NextFunction) => {
    if (!storage.actif) return next();
    const categorie = String(req.params.categorie);
    const fichier = String(req.params.fichier);
    try {
      const buffer = await storage.download(categorie, fichier);
      if (!buffer) return next();
      const ext = path.extname(fichier).toLowerCase();
      res.setHeader("Content-Type", MIME_PAR_EXTENSION[ext] ?? "application/octet-stream");
      res.send(buffer);
    } catch {
      next();
    }
  });
  app.useStaticAssets(UPLOADS_ROOT, { prefix: "/uploads" });
  // Jamais de cache navigateur sur les documents générés (2026-09) — voir
  // demande utilisateur répétée "c'est toujours pareil, rien n'a changé" en
  // retravaillant le visuel de la Lettre Chèque : le backend changeait
  // réellement à chaque déploiement (vérifié à chaque fois par un rendu de
  // test), mais AUCUNE route de documents.controller.ts ne posait
  // Cache-Control — un fetch() classique (voir src/services/documents.
  // service.ts openDocument) peut alors rejouer une réponse mise en cache
  // par le navigateur pour la MÊME URL (même id de lettre chèque/règlement/
  // décompte...) au lieu de redemander une génération fraîche. Réglé une
  // fois pour toutes ici plutôt que route par route.
  app.use("/api/documents", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    next();
  });
  // Documentation OpenAPI/Swagger (2026-09) — voir swagger.util.ts. Chemin
  // explicite "api/docs" (pas affecté par setGlobalPrefix, qui ne s'applique
  // qu'aux routes déclarées via les contrôleurs Nest) — déjà sous /api,
  // donc jamais intercepté par le fallback SPA du frontend plus bas.
  // Protection Basic Auth posée juste avant : jamais le même mécanisme que
  // l'authentification applicative (JWT), voir protegerSwagger.
  app.use("/api/docs", protegerSwagger);
  SwaggerModule.setup("api/docs", app, buildOpenApiDocument(app));
  app.setGlobalPrefix("api");
  // Frontend statique servi par ce même process (2026-09, déploiement VPS) —
  // voir mémoire "project-deploiement-vps". Actif seulement si FRONTEND_DIST_DIR
  // est renseignée (prod) ; absente en dev, où le frontend tourne via `vite`
  // sur son propre port. `/api` et `/uploads` déjà enregistrés au-dessus
  // gardent la priorité ; tout le reste retombe sur index.html (SPA).
  const frontendDir = process.env.FRONTEND_DIST_DIR;
  if (frontendDir) {
    app.useStaticAssets(frontendDir);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`MedAssur API listening on http://localhost:${port}/api`);
}
bootstrap();
