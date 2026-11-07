import { randomUUID } from "crypto";
import * as path from "path";
import { BadRequestException } from "@nestjs/common";

// Sécurité des fichiers téléversés — point d'entrée UNIQUE pour toute
// écriture dans uploads/. Le nom d'origine ne sert qu'à déduire l'extension
// (liste blanche par catégorie) ; le contenu est vérifié par signature
// ("magic bytes") ; le nom stocké est un UUID v4 (128 bits) sans aucun
// caractère contrôlé par l'utilisateur.

export type UploadCategory = "image" | "document" | "logo";

export interface SafeUpload {
  /** Extension normalisée, avec le point (ex. ".png"). */
  ext: string;
  /** Type MIME déduit de l'extension validée (jamais celui déclaré par le client). */
  mime: string;
  /** `${uuid}${ext}` */
  storedName: string;
}

export interface SanitizeUploadInput {
  originalName?: string | null;
  mimetype?: string | null;
  buffer: Buffer;
  category: UploadCategory;
  /** Plafond de taille en octets (défaut : plafond de la catégorie). */
  maxBytes?: number;
}

type Kind = "pdf" | "png" | "jpg" | "webp" | "gif" | "zip" | "ole" | "text";

const EXTENSIONS: Record<UploadCategory, readonly string[]> = {
  image: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  document: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".odt", ".ods", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"],
  logo: [".png", ".jpg", ".jpeg", ".webp"],
};

const MIME_PAR_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

/** Extensions affichables dans le navigateur ; tout le reste est servi en téléchargement. */
export const INLINE_SAFE_EXTENSIONS: readonly string[] = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"];

const KIND_REQUIS: Record<string, Kind> = {
  ".pdf": "pdf", ".png": "png", ".jpg": "jpg", ".jpeg": "jpg", ".webp": "webp", ".gif": "gif",
  ".docx": "zip", ".xlsx": "zip", ".pptx": "zip", ".odt": "zip", ".ods": "zip",
  ".doc": "ole", ".xls": "ole", ".ppt": "ole",
  ".csv": "text", ".txt": "text",
};

const EXTENSION_PAR_KIND: Partial<Record<Kind, string>> = { pdf: ".pdf", png: ".png", jpg: ".jpg", webp: ".webp", gif: ".gif" };

// Un OOXML/ODF contient toujours un de ces chemins dans son annuaire ZIP.
const MARQUEUR_ZIP: Record<string, string> = {
  ".docx": "word/", ".xlsx": "xl/", ".pptx": "ppt/", ".odt": "mimetype", ".ods": "mimetype",
};

function mo(nom: string, defaut: number): number {
  const brut = Number(process.env[nom]);
  return Number.isFinite(brut) && brut > 0 ? Math.floor(brut * 1024 * 1024) : defaut;
}

/** Plafonds par catégorie (octets), surchargeables via UPLOAD_MAX_IMAGE_MB / UPLOAD_MAX_LOGO_MB / UPLOAD_MAX_DOCUMENT_MB. */
export function tailleMaxUpload(category: UploadCategory): number {
  switch (category) {
    case "logo": return mo("UPLOAD_MAX_LOGO_MB", 4 * 1024 * 1024);
    case "image": return mo("UPLOAD_MAX_IMAGE_MB", 8 * 1024 * 1024);
    default: return mo("UPLOAD_MAX_DOCUMENT_MB", 25 * 1024 * 1024);
  }
}

export function mimePourExtension(ext: string): string {
  return MIME_PAR_EXTENSION[ext.toLowerCase()] ?? "application/octet-stream";
}

/** Détecte le format réel d'un contenu à partir de ses premiers octets. */
export function detecterFormat(buffer: Buffer): Exclude<Kind, "text"> | null {
  if (buffer.length >= 5 && buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return "pdf";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 6) {
    const entete = buffer.subarray(0, 6).toString("latin1");
    if (entete === "GIF87a" || entete === "GIF89a") return "gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05) && (buffer[3] === 0x04 || buffer[3] === 0x06)) return "zip";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "ole";
  return null;
}

function texteValide(buffer: Buffer): boolean {
  const debut = buffer.subarray(0, 8192);
  if (debut.includes(0)) return false;
  const texte = debut.toString("utf8").replace(/^\uFEFF/, "").trimStart();
  // Marquage HTML/SVG/XML/script déguisé en .txt/.csv : refusé quel que soit le Content-Type servi.
  return !/^<(\?xml|!doctype|html|svg|script|head|body)/i.test(texte);
}

function extensionDuNom(nom?: string | null): string {
  if (!nom) return "";
  const ext = path.extname(path.basename(nom.replace(/\0/g, ""))).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

/**
 * Valide un fichier téléversé et produit un nom stocké sûr.
 * @throws BadRequestException si l'extension, le contenu ou la taille sont refusés.
 */
export function sanitizeUpload(input: SanitizeUploadInput): SafeUpload {
  const { originalName, buffer, category } = input;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new BadRequestException("Fichier vide ou illisible.");
  const plafond = input.maxBytes ?? tailleMaxUpload(category);
  if (buffer.length > plafond) {
    throw new BadRequestException(`Fichier trop volumineux (maximum ${Math.round(plafond / 1024 / 1024)} Mo).`);
  }

  const autorisees = EXTENSIONS[category];
  const format = detecterFormat(buffer);
  let ext = extensionDuNom(originalName);
  if (ext === "") {
    // Nom sans extension (ex. photo de caméra) : déduite du contenu réel.
    ext = (format ? EXTENSION_PAR_KIND[format] : undefined) ?? "";
  }
  if (!ext || !autorisees.includes(ext)) {
    throw new BadRequestException(`Type de fichier non autorisé${ext ? ` (${ext})` : ""}. Formats acceptés : ${autorisees.join(", ")}.`);
  }

  const requis = KIND_REQUIS[ext];
  if (requis === "text") {
    if (!texteValide(buffer)) throw new BadRequestException("Contenu du fichier texte refusé.");
  } else {
    if (format !== requis) throw new BadRequestException("Le contenu du fichier ne correspond pas à son extension.");
    if (requis === "zip") {
      const marqueur = MARQUEUR_ZIP[ext];
      if (marqueur && !buffer.includes(Buffer.from(marqueur))) throw new BadRequestException("Le contenu du fichier ne correspond pas à son extension.");
      if (buffer.includes(Buffer.from("vbaProject.bin"))) throw new BadRequestException("Les documents contenant des macros sont refusés.");
    }
  }

  return { ext, mime: mimePourExtension(ext), storedName: `${randomUUID()}${ext}` };
}

/**
 * Variante pour les pièces jointes de Communications, dont le nom d'affichage
 * n'a pas de colonne dédiée : `${uuid}__${libellé}${ext}` où le libellé est
 * réduit à [A-Za-z0-9_-] (aucun caractère de chemin, d'espace ou de balisage).
 */
export function nomStockeAvecLibelle(safe: SafeUpload, originalName?: string | null): string {
  const base = path.basename((originalName ?? "").replace(/\0/g, "")).replace(/\.[^.]*$/, "");
  const libelle = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return libelle ? `${safe.storedName.slice(0, -safe.ext.length)}__${libelle}${safe.ext}` : safe.storedName;
}

/** Nom affiché d'une pièce jointe de Communications (formats `uuid__libellé.ext`, `uuid.ext` et historique `6hex-nom`). */
export function nomAffichagePieceJointe(stocke: string): string {
  const m = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:__(.+?))?(\.[A-Za-z0-9]+)$/.exec(stocke);
  if (m) return m[1] ? `${m[1]}${m[2]}` : `piece-jointe${m[2]}`;
  return stocke.replace(/^[0-9a-f]{6}-/, "");
}

export interface InboundAttachment extends SafeUpload {
  /** true si le type était refusé : conservé en `.bin` (téléchargement forcé), jamais interprété. */
  quarantined: boolean;
}

/**
 * Variante non bloquante pour les pièces jointes d'emails entrants : un type
 * refusé n'est pas rejeté (l'email reste archivé) mais stocké en `.bin`.
 * Renvoie null si la pièce est vide ou dépasse le plafond (abandonnée).
 */
export function sanitizeInboundAttachment(input: Omit<SanitizeUploadInput, "category">): InboundAttachment | null {
  const { buffer, originalName } = input;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > tailleMaxUpload("document")) return null;
  try {
    return { ...sanitizeUpload({ ...input, category: "document" }), quarantined: false };
  } catch (e) {
    console.warn(`[Upload] Pièce jointe entrante mise en quarantaine (.bin) : "${String(originalName ?? "").slice(0, 80).replace(/[\r\n]/g, " ")}" — ${e instanceof Error ? e.message : "refusée"}`);
    return { ext: ".bin", mime: "application/octet-stream", storedName: `${randomUUID()}.bin`, quarantined: true };
  }
}
