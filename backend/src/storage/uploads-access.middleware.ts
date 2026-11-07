import { createHmac, timingSafeEqual } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { INLINE_SAFE_EXTENSIONS, mimePourExtension } from "./upload-security.util";

// Accès authentifié et durci aux fichiers uploadés (remplace l'ancien
// `useStaticAssets` ouvert à tous). Middleware Express pur, sans dépendance
// NestJS — l'authentification et l'autorisation (tenant/propriétaire) sont
// injectées par main.ts.
//
// Deux modes d'accès :
//   1. JWT — `Authorization: Bearer` ou `?token=` (balises <img>/<a>/viewers
//      qui ne peuvent pas poser d'en-tête) ;
//   2. URL signée expirante — `?exp=<epoch s>&sig=<hmac hex>` (liens envoyés
//      par SMS/email à des destinataires sans compte).
// Le middleware ne journalise JAMAIS l'URL complète (le jeton y figure).

export interface UploadsAuthUser {
  userId: string;
  roleId: string;
  societeId: string | null;
  assureSanteId: string | null;
  clientId: string | null;
  prestataireId: string | null;
  medecinId: string | null;
}

export interface UploadsAccessOptions {
  /** Dossier racine des uploads. */
  root: string;
  /** Secret HMAC des URL signées. */
  secret: string;
  /** Vérifie un JWT et renvoie son payload, ou null s'il est invalide/expiré. */
  verifyToken: (token: string) => Promise<Record<string, unknown> | null>;
  /** Contrôle tenant/propriétaire pour un utilisateur authentifié. */
  authorize: (user: UploadsAuthUser, categorie: string, fichier: string, segments: string[]) => Promise<boolean>;
}

const TTL_SIGNATURE_DEFAUT_S = 7 * 24 * 3600;

/** Secret HMAC des URL signées : UPLOAD_URL_SECRET, à défaut JWT_SECRET (même valeur que côté main.ts). */
export function secretUrlsSignees(): string {
  const secret = process.env.UPLOAD_URL_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("UPLOAD_URL_SECRET ou JWT_SECRET (32 caractères minimum) requis pour signer les liens de fichiers.");
  return secret;
}

function chemin(segments: string[]): string {
  return segments.join("/");
}

function signature(secret: string, cheminRelatif: string, exp: number): string {
  return createHmac("sha256", secret).update(`${cheminRelatif}\n${exp}`).digest("hex");
}

/** Chemin relatif signé (ex. `communications/<fichier>`) → suffixe de requête `?exp=…&sig=…`. */
export function signerChemin(secret: string, cheminRelatif: string, ttlSecondes = TTL_SIGNATURE_DEFAUT_S): string {
  const propre = cheminRelatif.replace(/^\/+/, "");
  const exp = Math.floor(Date.now() / 1000) + ttlSecondes;
  return `exp=${exp}&sig=${signature(secret, propre, exp)}`;
}

/** URL absolue signée `${base}/uploads/<categorie>/<fichier>?exp=…&sig=…`. */
export function urlUploadSignee(secret: string, base: string, categorie: string, fichier: string, ttlSecondes = TTL_SIGNATURE_DEFAUT_S): string {
  const racine = base.replace(/\/+$/, "");
  return `${racine}/uploads/${encodeURIComponent(categorie)}/${encodeURIComponent(fichier)}?${signerChemin(secret, `${categorie}/${fichier}`, ttlSecondes)}`;
}

function signatureValide(secret: string, cheminRelatif: string, expBrut: unknown, sigBrut: unknown): boolean {
  if (typeof expBrut !== "string" || typeof sigBrut !== "string" || !/^\d{1,12}$/.test(expBrut) || !/^[0-9a-f]{64}$/i.test(sigBrut)) return false;
  const exp = Number(expBrut);
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const attendue = Buffer.from(signature(secret, cheminRelatif, exp), "hex");
  const recue = Buffer.from(sigBrut, "hex");
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

// Retourne les segments décodés et sûrs, ou null (traversée, octet nul, séparateurs cachés...).
function segmentsSurs(brut: string): string[] | null {
  if (brut.includes("\0") || /%00/i.test(brut)) return null;
  let decode: string;
  try { decode = decodeURIComponent(brut); } catch { return null; }
  if (decode.includes("\0") || decode.includes("\\")) return null;
  const segments = decode.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return null;
  for (const s of segments) {
    if (s === "." || s === ".." || s.includes(":") || s.length > 255) return null;
  }
  return segments;
}

function nomTelechargement(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const propre = brut.replace(/[\u0000-\u001f\u007f"\\/;:*?<>|]/g, "_").trim().slice(0, 120);
  return propre.length > 0 ? propre : null;
}

function disposition(inline: boolean, nom: string | null): string {
  const type = inline ? "inline" : "attachment";
  if (!nom) return type;
  const ascii = nom.replace(/[^\x20-\x7e]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom).replace(/['()]/g, escape)}`;
}

function refuser(res: Response, statut: number, message: string): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(statut).json({ statusCode: statut, message });
}

function extraireJeton(req: Request): string | null {
  const entete = req.headers.authorization;
  if (typeof entete === "string" && /^Bearer\s+\S+$/i.test(entete)) return entete.replace(/^Bearer\s+/i, "");
  const q = req.query?.token;
  return typeof q === "string" && q.length > 0 && q.length < 8192 ? q : null;
}

function versUtilisateur(payload: Record<string, unknown>): UploadsAuthUser | null {
  const texte = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  const userId = texte(payload.sub);
  const roleId = texte(payload.roleId);
  if (!userId || !roleId) return null;
  return {
    userId, roleId,
    societeId: texte(payload.societeId), assureSanteId: texte(payload.assureSanteId), clientId: texte(payload.clientId),
    prestataireId: texte(payload.prestataireId), medecinId: texte(payload.medecinId),
  };
}

export function uploadsAccessMiddleware(options: UploadsAccessOptions): RequestHandler {
  const racineBrute = path.resolve(options.root);
  let racineReelle: string | null = null;

  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return refuser(res, 405, "Méthode non autorisée.");
      }
      const segments = segmentsSurs(req.path);
      if (!segments) return refuser(res, 400, "Chemin invalide.");
      const [categorie, ...reste] = segments;
      const fichier = reste[reste.length - 1];
      const relatif = chemin(segments);

      // 1. Authentification : URL signée, sinon JWT.
      let autorise = false;
      if (req.query?.sig !== undefined || req.query?.exp !== undefined) {
        autorise = signatureValide(options.secret, relatif, req.query.exp, req.query.sig);
        if (!autorise) return refuser(res, 403, "Lien invalide ou expiré.");
      } else {
        const jeton = extraireJeton(req);
        if (!jeton) return refuser(res, 401, "Authentification requise.");
        const payload = await options.verifyToken(jeton).catch(() => null);
        const user = payload ? versUtilisateur(payload) : null;
        if (!user) return refuser(res, 401, "Jeton invalide ou expiré.");
        // 2. Autorisation : tenant + propriétaire.
        autorise = await options.authorize(user, categorie, fichier, segments).catch(() => false);
        if (!autorise) return refuser(res, 403, "Accès refusé à ce fichier.");
      }

      // 3. Résolution disque durcie : fichier régulier sous la racine réelle.
      racineReelle ??= await fs.promises.realpath(racineBrute);
      const candidat = path.resolve(racineReelle, ...segments);
      if (!candidat.startsWith(racineReelle + path.sep)) return refuser(res, 400, "Chemin invalide.");
      let reel: string;
      try { reel = await fs.promises.realpath(candidat); } catch { return refuser(res, 404, "Fichier introuvable."); }
      if (!reel.startsWith(racineReelle + path.sep)) return refuser(res, 404, "Fichier introuvable.");
      const stat = await fs.promises.stat(reel);
      if (!stat.isFile()) return refuser(res, 404, "Fichier introuvable.");

      // 4. En-têtes défensifs.
      const ext = path.extname(reel).toLowerCase();
      const inline = INLINE_SAFE_EXTENSIONS.includes(ext);
      const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
      res.setHeader("Content-Type", mimePourExtension(ext));
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Le visionneur PDF de Chrome ne s'affiche pas sous `sandbox` ; le PDF
      // ne s'exécute pas dans le contexte du site (visionneur isolé).
      res.setHeader("Content-Security-Policy", ext === ".pdf" ? "default-src 'none'; style-src 'unsafe-inline'" : "sandbox; default-src 'none'");
      res.setHeader("Content-Disposition", disposition(inline, nomTelechargement(req.query?.filename)));
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Referrer-Policy", "no-referrer");
      // Les <img>/viewers du SPA peuvent être servis depuis une autre origine (dev, mobile).
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", stat.mtime.toUTCString());
      if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
      res.setHeader("Content-Length", String(stat.size));
      if (req.method === "HEAD") { res.status(200).end(); return; }

      const flux = fs.createReadStream(reel);
      flux.on("error", () => { if (!res.headersSent) refuser(res, 404, "Fichier introuvable."); else res.destroy(); });
      flux.pipe(res);
    } catch {
      if (!res.headersSent) refuser(res, 500, "Erreur lors de la lecture du fichier.");
    }
  };
}
