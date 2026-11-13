import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require("compression");
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { json, type Request, type Response, type NextFunction } from "express";
import { AppModule } from "./app.module";
import { UPLOADS_ROOT } from "./uploads-dir.util";
import { uploadsAccessMiddleware } from "./storage/uploads-access.middleware";
import { creerAutorisationUploads } from "./storage/uploads-authorizer";
import { getJwtSecret } from "./auth/jwt-secret";
import { PrismaService } from "./prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { buildOpenApiDocument, protegerSwagger, swaggerActif } from "./swagger.util";
import { signatureDesPdf } from "./documents/signature-pdf.middleware";
import { DocumentSignatureService } from "./documents/document-signature.service";
import helmet from "helmet";

// Origines navigateur autorisées (CORS). Les requêtes sans en-tête Origin
// (apps mobiles, curl, même origine) ne sont pas concernées par cette liste.
function originesCors(): string[] {
  const normaliser = (o: string) => o.trim().replace(/\/+$/, "");
  const configurees = (process.env.CORS_ORIGINS ?? "").split(",").map(normaliser).filter(Boolean);
  const origines = new Set(configurees);
  if (process.env.APP_URL) {
    try { origines.add(new URL(process.env.APP_URL).origin); } catch { /* APP_URL invalide : ignorée */ }
  }
  if (configurees.length === 0 && process.env.NODE_ENV !== "production") {
    ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"].forEach((o) => origines.add(o));
  }
  if (configurees.length === 0 && process.env.NODE_ENV === "production") {
    console.warn("[CORS] CORS_ORIGINS non défini en production : aucune origine navigateur cross-origin autorisée.");
  }
  return [...origines];
}

// TRUST_PROXY : "true"/"false", nombre de sauts (ex. "1") ou valeur Express ("loopback"...).
function valeurTrustProxy(brut: string): boolean | number | string {
  const v = brut.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", valeurTrustProxy(process.env.TRUST_PROXY));
  // En-têtes de sécurité pour une API JSON + téléchargements : CSP désactivée
  // (le même process sert le SPA et l'UI Swagger, qui utilisent des scripts/
  // styles inline), CORP "cross-origin" pour les images/documents chargés par
  // le SPA depuis l'origine de l'API, HSTS uniquement en production.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity: process.env.NODE_ENV === "production"
      ? { maxAge: 15_552_000, includeSubDomains: true }
      : false,
  }));
  app.use(compression());
  // QR de signature électronique sur tout PDF émis (voir signature-pdf.middleware).
  app.use(signatureDesPdf(app.get(DocumentSignatureService)));
  // Requêtes lentes journalisées (route, statut, durée) : on optimise ce qui
  // est réellement lent en production, mesuré, jamais deviné.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const debut = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - debut;
      if (ms >= 1000) console.warn(`[Lenteur] ${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${ms} ms`);
    });
    next();
  });
  // exposedHeaders : sans ça, le frontend ne peut pas lire Content-Disposition
  // sur une réponse cross-origin (fetch authentifié + blob, voir
  // src/services/documents.service.ts) — nécessaire pour que les documents
  // téléchargés portent leur vrai nom au lieu de l'id de blob généré par le
  // navigateur.
  const origines = originesCors();
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origines.includes(origin)),
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  });
  // Sonde de supervision (2026-09) — voir demande utilisateur : outil de
  // déploiement externe ("Kodee") qui vérifie l'état du service via
  // /api/health. Route Express brute (publique, sans JWT) ; ne renvoie que
  // l'état global et celui de la base (SELECT 1, délai max 2 s).
  const prismaSonde = app.get(PrismaService);
  app.use("/api/health", async (_req: Request, res: Response) => {
    let db: "up" | "down" = "down";
    let minuteur: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        prismaSonde.$queryRaw`SELECT 1`,
        new Promise((_, rejeter) => { minuteur = setTimeout(() => rejeter(new Error("timeout")), 2000); }),
      ]);
      db = "up";
    } catch {
      db = "down";
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
    res.json({ status: db === "up" ? "ok" : "degraded", db });
  });
  // Limite JSON par défaut : 2mb. Seules les routes d'import en masse
  // (CSV/Excel de plusieurs milliers de lignes envoyés en un seul body JSON,
  // 50 000+ lignes — voir ImportEnMasseModal) gardent 50mb ; la signature
  // publique (image PNG en data URL) 10mb. Les uploads multipart ne sont pas
  // concernés. Parseurs spécifiques déclarés AVANT le parseur global : le
  // premier à lire le body gagne. Le corps brut est conservé pour les
  // webhooks signés (voir zavu-webhook.controller.ts).
  app.use(
    ["/api/import", "/api/import-libre", "/api/clients/import", "/api/contrats/import", "/api/sante/assures/import"],
    json({ limit: "50mb" }),
  );
  app.use("/api/signer", json({ limit: "10mb" }));
  app.use(json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      const url = (req as unknown as Request).originalUrl ?? "";
      if (url.startsWith("/api/webhooks/")) (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Fichiers uploadés (logos, photos, documents...) — servis en dehors du
  // préfixe /api, sous /uploads/<categorie>/<fichier>, URL inchangée pour le
  // frontend, mais plus jamais en accès libre : JWT (en-tête ou ?token=) ou
  // URL signée expirante, contrôle société/propriétaire, en-têtes défensifs,
  // anti-traversée (voir storage/uploads-access.middleware.ts). Le stockage
  // est 100% disque local (StorageService inactif, voir storage.service.ts).
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  app.use("/uploads", uploadsAccessMiddleware({
    root: UPLOADS_ROOT,
    secret: configService.get<string>("UPLOAD_URL_SECRET") || getJwtSecret(configService),
    verifyToken: (token) => jwtService.verifyAsync<Record<string, unknown>>(token),
    authorize: creerAutorisationUploads(app.get(PrismaService)),
  }));
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
  if (swaggerActif()) {
    app.use("/api/docs", protegerSwagger);
    SwaggerModule.setup("api/docs", app, buildOpenApiDocument(app));
  } else {
    console.warn("[Swagger] Désactivé en production : définir SWAGGER_USER et SWAGGER_PASSWORD pour l'activer.");
  }
  app.setGlobalPrefix("api");
  // Frontend statique servi par ce même process (2026-09, déploiement VPS) —
  // voir mémoire "project-deploiement-vps". Actif seulement si FRONTEND_DIST_DIR
  // est renseignée (prod) ; absente en dev, où le frontend tourne via `vite`
  // sur son propre port. `/api` et `/uploads` déjà enregistrés au-dessus
  // gardent la priorité ; tout le reste retombe sur index.html (SPA).
  const frontendDir = process.env.FRONTEND_DIST_DIR;
  if (frontendDir) {
    // index.html jamais mis en cache par le navigateur (2026-09) — voir
    // demande utilisateur : après un déploiement, une session déjà ouverte
    // gardait l'ANCIEN index.html en cache (aucun en-tête Cache-Control
    // explicite = heuristique du navigateur), qui référence les anciens
    // fichiers JS/CSS hashés de la build précédente — désormais absents du
    // serveur après le nouveau déploiement. Symptôme observé : échecs
    // silencieux (ex. connexion "Email ou mot de passe incorrect" alors
    // que les identifiants étaient corrects) disparaissant en navigation
    // privée (aucun cache) ou après un vidage de cache manuel. Les autres
    // fichiers (JS/CSS avec hash dans leur nom, changent de nom à chaque
    // build) restent cachables sans risque — seul index.html doit toujours
    // être revalidé.
    app.useStaticAssets(frontendDir, {
      setHeaders: (res, filePath) => {
        const basename = path.basename(filePath);
        if (basename === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/\.[0-9a-f]{8,}\.(js|css|woff2?)$/i.test(basename)) {
          // Fichiers JS/CSS/polices avec hash Vite dans le nom — immuables
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          // Images, SVG, assets sans hash (guide-assets/*.png…) — 24 h
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`MEDASSUR+ API listening on http://localhost:${port}/api`);
}
bootstrap();
