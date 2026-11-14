import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { Public } from "../auth/access.decorators";
import { PrismaService } from "../prisma/prisma.service";
import { ASSETS_ROOT } from "../uploads-dir.util";
import { DocumentsService } from "./documents.service";

// Vérification publique d'une carte santé — accessible SANS compte (2026-11).
// Deux entrées :
//   • /api/carte/v/:matricule  — scan QR (URL encodée dans le QR)
//   • /api/carte/check[?q=…]  — formulaire web (matricule OU téléphone)
// @Public() : pas de JWT → pas d'ALS → middleware tenant inactif →
// requêtes cross-tenant, correct ici (matricule unique dans le SI).
@Public()
@Controller("carte")
export class CartePubliqueController {
  constructor(private readonly prisma: PrismaService, private readonly documents: DocumentsService) {}

  // ── Logo statique MEDASSUR+ (sans JWT) ──────────────────────────────
  @Get("assets/logo")
  logo(@Res() res: Response): void {
    const p = path.join(ASSETS_ROOT, "logo-full.png");
    if (!fs.existsSync(p)) { res.status(404).end(); return; }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(p).pipe(res);
  }

  // ── Formulaire de vérification manuelle ─────────────────────────────
  @Get("check")
  async check(@Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(htmlFormulaire(null, null));
  }

  // GET /api/carte/check/search?q=... — recherche par matricule OU téléphone
  @Get("check/search")
  async checkSearch(@Query("q") q: string, @Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const terme = (q ?? "").trim();
    if (!terme) { res.send(htmlFormulaire(null, null)); return; }
    const assure = await this.rechercherAssure(terme);
    if (!assure) { res.send(htmlFormulaire(terme, null)); return; }
    const actif = assure.statut === "Actif" && (assure.contrat as { statut?: string } | null)?.statut === "Actif";
    const nomComplet = nomAffiche(assure);
    res.send(htmlFormulaire(terme, { matricule: assure.matricule, actif, nomComplet }));
  }

  // ── Scan QR ─────────────────────────────────────────────────────────
  @Get("v/:matricule")
  async afficher(@Param("matricule") matricule: string, @Res() res: Response): Promise<void> {
    const include = {
      contrat: { select: { statut: true, tauxCouvertureAmbulatoire: true, tauxCouvertureHospitalisation: true, nomCarteSante: true, societeId: true, client: { select: { nom: true } } } },
      famille: { select: { nom: true, prenom: true } },
    };
    // Chercher par matricule exact (hors societe-bootstrap en priorité)
    let assure: Awaited<ReturnType<typeof this.prisma.assureSante.findFirst>> =
      await this.prisma.assureSante.findFirst({ where: { matricule, NOT: { contrat: { societeId: "societe-bootstrap" } } }, include })
      ?? await this.prisma.assureSante.findFirst({ where: { matricule }, include });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (!assure) { res.send(htmlInconnu(matricule)); return; }

    // Si l'assuré a une identité transverse, utiliser l'affiliation la plus
    // récente/active (priorité : contrat Actif + matricule alphabétiquement
    // DESC pour favoriser les préfixes récents comme LRX- sur GAB-).
    if ((assure as any).identiteId) {
      const affiliations = await this.prisma.assureSante.findMany({
        where: { identiteId: (assure as any).identiteId, NOT: { contrat: { societeId: "societe-bootstrap" } } },
        include,
        orderBy: [{ statut: "asc" }, { matricule: "desc" }],
      });
      const meilleure = affiliationPriorite(affiliations);
      if (meilleure) assure = meilleure as typeof assure;
    }

    const a = assure as any;
    const actif = a.statut === "Actif" && a.contrat?.statut === "Actif";
    res.send(htmlScanQR({ matricule: a.matricule, actif, nomComplet: nomAffiche(a) }));
  }

  // ── PDF recto public ────────────────────────────────────────────────
  @Get("pdf/:matricule")
  async pdf(@Param("matricule") matricule: string, @Res() res: Response): Promise<void> {
    await this.documents.renderCartePdfPublic(matricule, res);
  }

  // ── Méthodes privées ─────────────────────────────────────────────────

  /** Cherche un assuré par matricule OU numéro de téléphone (cross-tenant).
   *  - Par matricule : exact, tous types (principal ou ayant droit).
   *  - Par téléphone : assuré direct OU ayant droit dont le principal a ce tel.
   *    Les principaux (familleId null) remontent en premier (NULL < UUID en PG).
   */
  private async rechercherAssure(q: string) {
    const normalise = q.replace(/[\s\-().+]/g, "");
    const include = {
      contrat: { select: { statut: true, societeId: true, client: { select: { nom: true } } } },
      famille: { select: { nom: true, prenom: true } },
    } as const;

    // 1. Matricule exact (hors societe-bootstrap en priorité)
    let assure = await this.prisma.assureSante.findFirst({
      where: { matricule: q, NOT: { contrat: { societeId: "societe-bootstrap" } } }, include,
    }) ?? await this.prisma.assureSante.findFirst({ where: { matricule: q }, include });
    if (assure) return assure;

    // 2. Téléphone : cherche sur l'assuré direct ET sur le principal de la famille.
    //    orderBy familleId asc → NULL en premier → les principaux remontent avant les ADs.
    if (normalise.length >= 6) {
      const suffixe = normalise.slice(-8);
      assure = await this.prisma.assureSante.findFirst({
        where: {
          OR: [
            { telephone: { endsWith: suffixe } },
            { famille: { telephone: { endsWith: suffixe } } },
          ],
          NOT: { contrat: { societeId: "societe-bootstrap" } },
        },
        include,
        orderBy: [{ familleId: "asc" }, { statut: "asc" }, { matricule: "desc" }],
      }) ?? await this.prisma.assureSante.findFirst({
        where: {
          OR: [
            { telephone: { endsWith: suffixe } },
            { famille: { telephone: { endsWith: suffixe } } },
          ],
        },
        include,
        orderBy: [{ familleId: "asc" }, { statut: "asc" }, { matricule: "desc" }],
      });
    }
    return assure ?? null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ResultatCarte {
  matricule: string;
  actif: boolean;
  nomComplet: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nomAffiche(a: { nom: string; prenom?: string | null; famille?: { nom: string; prenom?: string | null } | null }): string {
  if (a.famille) return `${a.famille.nom} ${a.famille.prenom ?? ""}`.trim();
  return `${a.nom} ${(a as { prenom?: string | null }).prenom ?? ""}`.trim();
}

/** Parmi plusieurs affiliations liées par identiteId, retourne la plus pertinente :
 *  contrat Actif + statut Actif d'abord, puis matricule alphabétiquement DESC
 *  (un préfixe récent type LRX- vient avant les anciens préfixes).
 */
function affiliationPriorite<T extends { statut: string; contrat: { statut: string } | null }>(list: T[]): T | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const aOk = a.statut === "Actif" && a.contrat?.statut === "Actif";
    const bOk = b.statut === "Actif" && b.contrat?.statut === "Actif";
    if (aOk !== bOk) return aOk ? -1 : 1;
    return 0;
  })[0];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SHELL_CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#eef2f7;padding:16px 16px 32px;min-height:100vh}`;

const RESULT_CSS = `
.pdf-wrap{max-width:460px;margin:16px auto 12px;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.14);background:#fff;min-height:120px}
.pdf-wrap canvas{width:100%;display:block}
.pdf-loading{padding:40px;text-align:center;color:#888;font-size:14px}
.status-box{max-width:460px;margin:0 auto 12px;border-radius:14px;padding:18px 16px;text-align:center}
.status-box.active{background:#e8f5e9;border:2px solid #43a047}
.status-box.inactive{background:#fce4ec;border:2px solid #e53935}
.status-titre{font-size:20px;font-weight:bold;margin:6px 0 3px}
.status-titre.active{color:#2e7d32}
.status-titre.inactive{color:#c62828}
.status-desc{font-size:14px;color:#444}
.check-url-box{max-width:460px;margin:0 auto 8px;background:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,.07);text-align:center}
.check-url-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.check-url{font-size:13px;font-weight:bold;color:#004a9f}`;

function htmlResultat(r: ResultatCarte): string {
  const statusIcon = r.actif
    ? `<svg viewBox="0 0 52 52" width="48" height="48"><circle cx="26" cy="26" r="25" fill="#43a047"/><path d="M14 26l9 9 15-16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 52 52" width="48" height="48"><circle cx="26" cy="26" r="25" fill="#e53935"/><path d="M17 17l18 18M35 17l-18 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
  const cls = r.actif ? "active" : "inactive";
  const titre = r.actif ? "Carte active" : "Carte désactivée";
  const desc = r.actif ? "Personne encore couverte" : "Cette personne n'est plus couverte";

  return `
<div class="pdf-wrap">
  <div class="pdf-loading" id="pdfLoading">Chargement de la carte…</div>
  <canvas id="pdfCanvas" style="display:none"></canvas>
</div>
<div class="status-box ${cls}">
  ${statusIcon}
  <div class="status-titre ${cls}">${titre}</div>
  <div class="status-desc">${desc}</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
pdfjsLib.getDocument('/api/carte/pdf/${esc(r.matricule)}').promise.then(function(pdf){
  return pdf.getPage(1);
}).then(function(page){
  var dpr=window.devicePixelRatio||1;
  var vp=page.getViewport({scale:dpr*1.6});
  var canvas=document.getElementById('pdfCanvas');
  canvas.width=vp.width; canvas.height=vp.height;
  canvas.style.display='block';
  document.getElementById('pdfLoading').style.display='none';
  return page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
}).catch(function(){ document.getElementById('pdfLoading').textContent='Carte indisponible.'; });
</script>`;
}

/** Page formulaire + résultat éventuel. */
function htmlFormulaire(q: string | null, resultat: ResultatCarte | null): string {
  const valeur = q ? esc(q) : "";
  const messageErreur = q && !resultat
    ? `<div style="max-width:460px;margin:0 auto 12px;padding:12px 16px;background:#fce4ec;border:1px solid #e53935;border-radius:10px;color:#c62828;font-size:14px;">
        Aucune carte trouvée pour <b>${valeur}</b>. Vérifiez le matricule ou le numéro de téléphone.
       </div>`
    : "";
  const blocResultat = resultat ? htmlResultat(resultat) : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vérifier une carte santé – MEDASSUR+</title>
<style>
${SHELL_CSS}
${RESULT_CSS}
.logo-top{text-align:center;padding-top:24px;margin-bottom:4px}
.logo-top img{height:72px;width:auto}
.hero{text-align:center;padding:8px 16px 16px;max-width:460px;margin:0 auto}
.hero h1{font-size:22px;font-weight:bold;color:#004a9f;margin-bottom:6px;font-family:Arial,sans-serif}
.hero p{font-size:14px;color:#555}
.hero .check-link{margin-top:8px;font-size:13px;color:#555}
.hero .check-link a{color:#004a9f;font-weight:bold;text-decoration:none}
.hero .check-link a:hover{text-decoration:underline}
.form-box{background:#fff;border-radius:14px;max-width:460px;margin:0 auto 12px;padding:20px 20px 24px;box-shadow:0 2px 14px rgba(0,0,0,.10)}
.form-box label{display:block;font-size:13px;font-weight:bold;color:#333;margin-bottom:6px}
.form-box input[type=text]{width:100%;padding:11px 14px;border:1.5px solid #ccc;border-radius:8px;font-size:15px;outline:none;transition:border .2s}
.form-box input[type=text]:focus{border-color:#004a9f}
.form-box button{margin-top:14px;width:100%;padding:12px;background:#004a9f;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
.form-box button:hover{background:#003580}
.hint{font-size:12px;color:#888;margin-top:8px}
.footer{text-align:center;margin-top:12px;font-size:11px;color:#aaa}
</style>
</head>
<body>
<div class="logo-top">
  <img src="/api/carte/assets/logo" alt="MEDASSUR+">
</div>
<div class="hero">
  <h1>Vérifier une carte santé</h1>
  <p>Saisissez le numéro matricule ou le numéro de téléphone de l'assuré pour vérifier sa couverture.</p>
  <p class="check-link">Lien à communiquer aux prestataires&nbsp;: <a href="/api/carte/check">medassur.cloud/api/carte/check</a></p>
</div>
<div class="form-box">
  <form method="GET" action="/api/carte/check/search">
    <label for="q">Matricule ou numéro de téléphone</label>
    <input type="text" id="q" name="q" value="${valeur}" placeholder="ex. GAB-2024-00123 ou 077123456" autocomplete="off" autocorrect="off" spellcheck="false">
    <div class="hint">Le numéro de téléphone peut être saisi avec ou sans indicatif (+241).</div>
    <button type="submit">Vérifier</button>
  </form>
</div>
${messageErreur}
${blocResultat}
<div class="footer">MEDASSUR+ &middot; medassur.cloud</div>
</body>
</html>`;
}

/** Page résultat pour scan QR direct (URL /api/carte/v/:matricule). */
function htmlScanQR(r: ResultatCarte): string {
  const statusIcon = r.actif
    ? `<svg viewBox="0 0 52 52" width="48" height="48"><circle cx="26" cy="26" r="25" fill="#43a047"/><path d="M14 26l9 9 15-16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 52 52" width="48" height="48"><circle cx="26" cy="26" r="25" fill="#e53935"/><path d="M17 17l18 18M35 17l-18 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
  const cls = r.actif ? "active" : "inactive";
  const titre = r.actif ? "Carte active" : "Carte désactivée";
  const desc = r.actif ? "Personne encore couverte" : "Cette personne n'est plus couverte";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carte Santé – Vérification</title>
<style>
${SHELL_CSS}
${RESULT_CSS}
.logo-top{text-align:center;padding-top:16px;margin-bottom:8px}
.logo-top img{height:56px;width:auto}
</style>
</head>
<body>
<div class="logo-top">
  <img src="/api/carte/assets/logo" alt="MEDASSUR+">
</div>
<div class="pdf-wrap">
  <div class="pdf-loading" id="pdfLoading">Chargement de la carte…</div>
  <canvas id="pdfCanvas" style="display:none"></canvas>
</div>
<div class="status-box ${cls}">
  ${statusIcon}
  <div class="status-titre ${cls}">${titre}</div>
  <div class="status-desc">${desc}</div>
</div>
<div class="check-url-box">
  <div class="check-url-label">Vérifier un autre assuré</div>
  <a href="/api/carte/check" class="check-url" style="display:block;text-decoration:none;padding:4px 0">Formulaire de vérification →</a>
</div>
<div class="footer" style="padding-bottom:16px">Vérification MEDASSUR+ &middot; medassur.cloud</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
pdfjsLib.getDocument('/api/carte/pdf/${esc(r.matricule)}').promise.then(function(pdf){
  return pdf.getPage(1);
}).then(function(page){
  var dpr=window.devicePixelRatio||1;
  var vp=page.getViewport({scale:dpr*1.6});
  var canvas=document.getElementById('pdfCanvas');
  canvas.width=vp.width; canvas.height=vp.height;
  canvas.style.display='block';
  document.getElementById('pdfLoading').style.display='none';
  return page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
}).catch(function(){ document.getElementById('pdfLoading').textContent='Carte indisponible.'; });
</script>
</body>
</html>`;
}

function htmlInconnu(ref: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carte introuvable</title>
<style>${SHELL_CSS}
.box{background:#fff;border-radius:14px;max-width:380px;margin:40px auto;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.12);text-align:center}
h2{color:#c62828;font-size:20px;margin-bottom:12px}p{color:#555;font-size:14px;margin-top:8px}a{color:#004a9f;font-size:13px}
</style>
</head><body>
<div class="box">
<svg viewBox="0 0 52 52" width="56" height="56" style="margin-bottom:12px"><circle cx="26" cy="26" r="25" fill="#e53935"/>
<path d="M26 14v16M26 36v2" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>
<h2>Carte introuvable</h2>
<p>Aucune carte n'a pu être trouvée pour <b>${esc(ref)}</b>.</p>
<p>Ce QR code est peut-être périmé ou invalide.</p>
<p style="margin-top:16px"><a href="/api/carte/check">Essayer avec un autre numéro</a></p>
<p style="margin-top:16px;font-size:12px;color:#aaa">MEDASSUR+ &middot; medassur.cloud</p>
</div></body></html>`;
}
