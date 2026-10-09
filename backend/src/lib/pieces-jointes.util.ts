import { BadRequestException } from "@nestjs/common";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

// Plusieurs pièces jointes en un seul envoi (2026-10) — voir demande
// utilisateur : "il faut que l'application permette dans un échange de
// message ou pour toute autre raison la sélection de plusieurs pièces
// jointes (de tout format de document et d'image)".

// Limites communes des envois multiples : 8 Mo par fichier (comme avant),
// 10 fichiers au plus par envoi.
export const TAILLE_MAX_PIECE = 8 * 1024 * 1024;
export const NOMBRE_MAX_PIECES = 10;

// Champs multipart acceptés : "fichier" (un seul — anciennes versions de
// l'application et écrans web) et "fichiers" (plusieurs — nouvelles
// versions). Réunis dans l'ordre d'envoi.
export const CHAMPS_PIECES = [
  { name: "fichier", maxCount: 1 },
  { name: "fichiers", maxCount: NOMBRE_MAX_PIECES },
];

export type PiecesRecues = { fichier?: Express.Multer.File[]; fichiers?: Express.Multer.File[] } | undefined;

export function piecesRecues(recues: PiecesRecues): Express.Multer.File[] {
  return [...(recues?.fichier ?? []), ...(recues?.fichiers ?? [])];
}

const estPdf = (f: Express.Multer.File) => f.mimetype === "application/pdf" || path.extname(f.originalname).toLowerCase() === ".pdf";
const estImage = (f: Express.Multer.File) =>
  f.mimetype.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tif", ".tiff"].includes(path.extname(f.originalname).toLowerCase());

// Une rubrique de dossier (ordonnance, devis, facture…) ne garde qu'UN
// fichier en base : plusieurs pièces envoyées pour la même rubrique sont
// réunies en un seul PDF, page après page, dans l'ordre d'envoi (photos
// redressées selon leur orientation, PDF recopiés tels quels). Ainsi tout
// ce qui lit ce fichier (visionneuse, agent IA, dossiers internes) continue
// de fonctionner sans changement. Une seule pièce est conservée telle
// quelle, dans son format d'origine.
export async function reunirEnUnFichier(fichiers: Express.Multer.File[]): Promise<Express.Multer.File | undefined> {
  if (fichiers.length === 0) return undefined;
  if (fichiers.length === 1) return fichiers[0];

  const refuses = fichiers.filter((f) => !estPdf(f) && !estImage(f)).map((f) => f.originalname);
  if (refuses.length > 0) {
    throw new BadRequestException(
      `Pour joindre plusieurs fichiers dans une même rubrique, seuls les photos et les PDF peuvent être réunis (${refuses.join(", ")} : format non pris en charge). Envoyez ce document seul.`,
    );
  }

  const pdf = await PDFDocument.create();
  for (const f of fichiers) {
    if (estPdf(f)) {
      let source: PDFDocument;
      try {
        source = await PDFDocument.load(f.buffer, { ignoreEncryption: true });
      } catch {
        throw new BadRequestException(`PDF illisible : ${f.originalname}.`);
      }
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach((p) => pdf.addPage(p));
      continue;
    }
    let jpeg: Buffer;
    try {
      // rotate() applique l'orientation EXIF (photos prises au téléphone) ;
      // 2000 px de côté suffisent à la lecture d'une ordonnance.
      jpeg = await sharp(f.buffer).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException(`Image illisible : ${f.originalname}.`);
    }
    const image = await pdf.embedJpg(jpeg);
    // Page au format A4 (595 × 842 pt), image centrée et ajustée.
    const page = pdf.addPage([595, 842]);
    const echelle = Math.min(555 / image.width, 802 / image.height);
    const w = image.width * echelle, h = image.height * echelle;
    page.drawImage(image, { x: (595 - w) / 2, y: (842 - h) / 2, width: w, height: h });
  }
  const buffer = Buffer.from(await pdf.save());
  return { ...fichiers[0], originalname: "pieces-jointes.pdf", mimetype: "application/pdf", buffer, size: buffer.length };
}
