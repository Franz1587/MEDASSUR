import type { NextFunction, Request, Response } from "express";
import { PDFDocument } from "pdf-lib";
import type { DocumentSignatureService } from "./document-signature.service";

// Signature électronique de TOUT document émis (2026-11) — voir demande
// utilisateur : "tout document peu importe son type, statistique, réseau de
// soins, avenant, quittance, courrier... feuilles de soins et d'examen, même
// les bons convertis, les prises en charge ; tout document généré et créé
// dans MEDASSUR+ doit avoir un QR code pour l'authentifier". Plutôt que
// d'ajouter le QR dans chacun des ~30 générateurs (et d'en oublier), chaque
// PDF envoyé par l'API est signé ici, au moment de l'envoi : une preuve en
// base (DocumentSignatureService.signer) et son QR en bas à droite de chaque
// page. En-tête de réponse `X-Signature` posé par le générateur :
//   "integree" — le document dessine déjà son QR à un emplacement prévu ;
//   "aucune"   — fichier déposé par un utilisateur (scan, pièce jointe) que
//                l'application n'a pas produit et ne doit pas certifier.
export const EN_TETE_SIGNATURE = "X-Signature";

const TAILLE_QR = 30;

async function apposerQr(pdf: Buffer, signatures: DocumentSignatureService, req: Request, res: Response): Promise<Buffer> {
  const fichier = /filename="?([^";]+)/.exec(String(res.getHeader("Content-Disposition") ?? ""))?.[1]?.replace(/\.pdf$/i, "") ?? "Document";
  const user = (req as Request & { user?: { userId?: string; nom?: string; roleId?: string } }).user;
  // "Tableau-Garanties-R0603157" → type « Tableau Garanties », référence « R0603157 »
  // (jamais l'URL interne, qui porterait l'identifiant technique du contrat).
  const morceaux = fichier.split(/[-_ ]+/);
  const iRef = morceaux.findIndex((m) => /\d/.test(m));
  const type = (iRef > 0 ? morceaux.slice(0, iRef) : morceaux).join(" ");
  const reference = iRef >= 0 ? morceaux.slice(iRef).join("-") : new Date().toLocaleDateString("fr-FR");
  const { qrBuffer } = await signatures.signer(type, reference, {
    id: user?.userId ?? null, nom: user?.nom ?? "Accès public", roleId: user?.roleId ?? "public",
  });
  const document = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const qr = await document.embedPng(qrBuffer);
  for (const page of document.getPages()) {
    const { x, y, width } = page.getCropBox();
    page.drawImage(qr, { x: x + width - TAILLE_QR - 6, y: y + 6, width: TAILLE_QR, height: TAILLE_QR });
  }
  return Buffer.from(await document.save());
}

export function signatureDesPdf(signatures: DocumentSignatureService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.startsWith("/api/")) return next();
    const ecrire = res.write.bind(res) as (...a: unknown[]) => boolean;
    const terminer = res.end.bind(res) as (...a: unknown[]) => Response;
    let morceaux: Buffer[] | null = null;
    const aSigner = () => String(res.getHeader("Content-Type") ?? "").includes("application/pdf") && !res.getHeader(EN_TETE_SIGNATURE);
    const enBuffer = (chunk: unknown, encodage?: unknown) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, typeof encodage === "string" ? (encodage as BufferEncoding) : undefined));

    res.write = ((chunk: unknown, ...reste: unknown[]) => {
      if (morceaux === null && aSigner()) morceaux = [];
      if (!morceaux) return ecrire(chunk, ...reste);
      morceaux.push(enBuffer(chunk, reste[0]));
      (reste.find((r) => typeof r === "function") as (() => void) | undefined)?.();
      return true;
    }) as Response["write"];

    res.end = ((chunk?: unknown, ...reste: unknown[]) => {
      const aDesDonnees = chunk !== undefined && chunk !== null && typeof chunk !== "function";
      if (morceaux === null && aDesDonnees && aSigner()) morceaux = [];
      if (!morceaux) return terminer(chunk, ...reste);
      if (aDesDonnees) morceaux.push(enBuffer(chunk, reste[0]));
      const original = Buffer.concat(morceaux);
      // Jamais bloquant : sans signature possible, le document part tel quel.
      apposerQr(original, signatures, req, res)
        .catch(() => original)
        .then((pdf) => { res.setHeader("Content-Length", pdf.length); terminer(pdf); });
      return res;
    }) as Response["end"];

    next();
  };
}
