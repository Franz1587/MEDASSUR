import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { Public } from "../auth/access.decorators";
import { PrismaService } from "../prisma/prisma.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
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
    const page = await this.pageCarteAssure(assure);
    res.send(htmlFormulaire(terme, page));
  }

  // ── Scan QR ─────────────────────────────────────────────────────────
  @Get("v/:matricule")
  async afficher(@Param("matricule") matricule: string, @Res() res: Response): Promise<void> {
    const assure = await this.prisma.assureSante.findFirst({
      where: { matricule },
      include: {
        contrat: {
          select: {
            statut: true,
            tauxCouvertureAmbulatoire: true,
            tauxCouvertureHospitalisation: true,
            nomCarteSante: true,
            societeId: true,
            client: { select: { nom: true } },
          },
        },
        famille: { select: { nom: true, prenom: true } },
      },
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    if (!assure) {
      res.send(htmlInconnu(matricule));
      return;
    }

    res.send(await this.pageCarteAssure(assure));
  }

  // ── PDF recto public ────────────────────────────────────────────────
  @Get("pdf/:matricule")
  async pdf(@Param("matricule") matricule: string, @Res() res: Response): Promise<void> {
    await this.documents.renderCartePdfPublic(matricule, res);
  }

  // ── Méthodes privées ─────────────────────────────────────────────────

  /** Cherche un assuré par matricule OU numéro de téléphone (cross-tenant). */
  private async rechercherAssure(q: string) {
    // Normalise : retire espaces, tirets, parenthèses
    const normalise = q.replace(/[\s\-().+]/g, "");

    // Essai par matricule exact d'abord
    let assure = await this.prisma.assureSante.findFirst({
      where: { matricule: q },
      include: {
        contrat: {
          select: {
            statut: true,
            tauxCouvertureAmbulatoire: true,
            tauxCouvertureHospitalisation: true,
            nomCarteSante: true,
            societeId: true,
            client: { select: { nom: true } },
          },
        },
        famille: { select: { nom: true, prenom: true } },
      },
    });
    if (assure) return assure;

    // Essai par téléphone (champ telephone sur AssureSante ou sur Famille)
    // On accepte la correspondance partielle (fin du numéro) pour supporter
    // les formats 06…, +241…, 00241…
    if (normalise.length >= 6) {
      assure = await this.prisma.assureSante.findFirst({
        where: { telephone: { endsWith: normalise.slice(-8) } },
        include: {
          contrat: {
            select: {
              statut: true,
              tauxCouvertureAmbulatoire: true,
              tauxCouvertureHospitalisation: true,
              nomCarteSante: true,
              societeId: true,
              client: { select: { nom: true } },
            },
          },
          famille: { select: { nom: true, prenom: true } },
        },
      });
    }
    return assure ?? null;
  }

  /** Construit le HTML de carte à partir d'un AssureSante hydraté. */
  private async pageCarteAssure(assure: Awaited<ReturnType<typeof this.rechercherAssure>>) {
    if (!assure) return htmlInconnu("—");

    const societeId: string | null = (assure.contrat as { societeId?: string } | null)?.societeId ?? null;
    let params: ParamsEntreprise = null;

    if (societeId) {
      params = await this.prisma.parametresEntreprise.findFirst({
        where: { id: societeId },
        select: { nom: true, sousTitre: true, couleurPrimaire: true, couleurSecondaire: true, logo: true },
      }) as ParamsEntreprise;
    }

    const actif = assure.statut === "Actif" && assure.contrat?.statut === "Actif";

    let logoSrc = "";
    if (params?.logo) {
      const logoPath = path.join(UPLOADS_ROOT, "logos-entreprises", params.logo);
      if (fs.existsSync(logoPath)) {
        const ext = (path.extname(params.logo).slice(1) || "png").toLowerCase().replace("jpg", "jpeg");
        try { logoSrc = `data:image/${ext};base64,${fs.readFileSync(logoPath).toString("base64")}`; } catch { /* jamais bloquant */ }
      }
    }

    const primaire = params?.couleurPrimaire ?? "#004a9f";
    const secondaire = params?.couleurSecondaire ?? "#f37801";
    const societeNom = params?.nom ?? "MEDASSUR+";
    const nomPrincipal = assure.famille
      ? `${assure.famille.nom} ${assure.famille.prenom ?? ""}`.trim()
      : `${assure.nom} ${(assure as { prenom?: string | null }).prenom ?? ""}`.trim();
    const societeContrat = assure.contrat?.nomCarteSante?.trim() || assure.contrat?.client?.nom || "—";
    const taux = (val: string | null | undefined) => val ? val.replace(/\s/g, "") : "—";

    return htmlCarte({
      matricule: assure.matricule,
      nom: assure.nom,
      prenom: (assure as { prenom?: string | null }).prenom ?? "—",
      dateNaissance: (assure as { dateNaissance?: string | null }).dateNaissance ?? "—",
      nomPrincipal,
      societeContrat,
      tauxAmbulatoire: taux(assure.contrat?.tauxCouvertureAmbulatoire as string | null | undefined),
      tauxHospitalisation: taux(assure.contrat?.tauxCouvertureHospitalisation as string | null | undefined),
      actif,
      societeNom,
      logoSrc,
      primaire,
      secondaire,
    });
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type ParamsEntreprise = {
  nom: string; sousTitre: string | null;
  couleurPrimaire: string; couleurSecondaire: string; logo: string | null;
} | null;

// ── Helpers HTML ─────────────────────────────────────────────────────────────

interface CarteData {
  matricule: string; nom: string; prenom: string; dateNaissance: string;
  nomPrincipal: string; societeContrat: string;
  tauxAmbulatoire: string; tauxHospitalisation: string;
  actif: boolean; societeNom: string; logoSrc: string;
  primaire: string; secondaire: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SHELL_CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#eef2f7;padding:16px;min-height:100vh}`;

function htmlCarte(d: CarteData): string {
  const statusIcon = d.actif
    ? `<svg viewBox="0 0 52 52" width="56" height="56"><circle cx="26" cy="26" r="25" fill="#43a047"/><path d="M14 26l9 9 15-16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 52 52" width="56" height="56"><circle cx="26" cy="26" r="25" fill="#e53935"/><path d="M17 17l18 18M35 17l-18 18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
  const statusTitre = d.actif ? "Carte active" : "Carte désactivée";
  const statusDesc = d.actif ? "Personne encore couverte" : "Cette personne n'est plus couverte";
  const statusCss = d.actif ? "background:#e8f5e9;border:2px solid #43a047" : "background:#fce4ec;border:2px solid #e53935";
  const titreCouleur = d.actif ? "#2e7d32" : "#c62828";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carte Santé – Vérification</title>
<style>
${SHELL_CSS}
.pdf-wrap{max-width:420px;margin:0 auto 16px;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.14);background:#fff;min-height:120px}
.pdf-wrap canvas{width:100%;display:block}
.pdf-loading{padding:40px;text-align:center;color:#888;font-size:14px}
.status{max-width:420px;margin:0 auto 16px;border-radius:14px;padding:22px 16px;text-align:center;${statusCss}}
.status-titre{font-size:22px;font-weight:bold;margin:8px 0 4px;color:${titreCouleur}}
.status-desc{font-size:15px;color:#444}
.check-box{max-width:420px;margin:0 auto 20px;background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 2px 10px rgba(0,0,0,.08);text-align:center}
.check-box-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.check-box-url{font-size:14px;font-weight:bold;color:#004a9f;word-break:break-all}
.footer{text-align:center;font-size:11px;color:#aaa;padding-bottom:16px}
</style>
</head>
<body>
<div class="pdf-wrap">
  <div class="pdf-loading" id="pdfLoading">Chargement de la carte…</div>
  <canvas id="pdfCanvas" style="display:none"></canvas>
</div>
<div class="status">
  ${statusIcon}
  <div class="status-titre">${statusTitre}</div>
  <div class="status-desc">${statusDesc}</div>
</div>
<div class="check-box">
  <div class="check-box-label">Vérification manuelle (sans scanner)</div>
  <div class="check-box-url">medassur.cloud/api/carte/check</div>
</div>
<div class="footer">Vérification MEDASSUR+ &middot; medassur.cloud</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
pdfjsLib.getDocument('/api/carte/pdf/${esc(d.matricule)}').promise.then(function(pdf){
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
h2{color:#c62828;font-size:20px;margin-bottom:12px}p{color:#555;font-size:14px;margin-top:8px}
a{color:#004a9f;font-size:13px}
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

/** Page formulaire : si résultat fourni, l'affiche inline en dessous du formulaire. */
function htmlFormulaire(q: string | null, resultatHtml: string | null): string {
  const valeur = q ? esc(q) : "";

  // Extrait le <body> du résultat pour l'inclure inline (évite iframe)
  let bloc = "";
  if (resultatHtml) {
    const m = resultatHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    bloc = m ? m[1] : resultatHtml;
  }

  const messageErreur = q && !resultatHtml
    ? `<div style="max-width:420px;margin:12px auto;padding:12px 16px;background:#fce4ec;border:1px solid #e53935;border-radius:10px;color:#c62828;font-size:14px;">
        Aucune carte trouvée pour <b>${valeur}</b>. Vérifiez le matricule ou le numéro de téléphone.
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vérifier une carte santé – MEDASSUR+</title>
<style>
${SHELL_CSS}
.hero{text-align:center;padding:28px 16px 16px;max-width:460px;margin:0 auto}
.hero h1{font-size:22px;font-weight:bold;color:#004a9f;margin-bottom:6px}
.hero p{font-size:14px;color:#555}
.form-box{background:#fff;border-radius:14px;max-width:460px;margin:0 auto 20px;padding:20px 20px 24px;box-shadow:0 2px 14px rgba(0,0,0,.10)}
.form-box label{display:block;font-size:13px;font-weight:bold;color:#333;margin-bottom:6px}
.form-box input[type=text]{width:100%;padding:11px 14px;border:1.5px solid #ccc;border-radius:8px;font-size:15px;outline:none;transition:border .2s}
.form-box input[type=text]:focus{border-color:#004a9f}
.form-box button{margin-top:14px;width:100%;padding:12px;background:#004a9f;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
.form-box button:hover{background:#003580}
.hint{font-size:12px;color:#888;margin-top:8px}
.footer{text-align:center;margin-top:12px;font-size:11px;color:#aaa;padding-bottom:24px}
.logo-top{text-align:center;padding-top:20px;margin-bottom:4px}
</style>
</head>
<body>
<div class="logo-top">
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="20" fill="#004a9f"/>
    <path d="M12 20h16M20 12v16" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  </svg>
</div>
<div class="hero">
  <h1>Vérifier une carte santé</h1>
  <p>Saisissez le numéro matricule ou le numéro de téléphone de l'assuré pour vérifier sa couverture.</p>
  <p style="margin-top:10px;font-size:13px;color:#888">Lien à communiquer aux prestataires&nbsp;: <b style="color:#004a9f">medassur.cloud/api/carte/check</b></p>
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
${bloc}
<div class="footer">MEDASSUR+ &middot; medassur.cloud</div>
</body>
</html>`;
}
