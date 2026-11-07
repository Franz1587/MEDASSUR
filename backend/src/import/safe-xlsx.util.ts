import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";

// Lecture de classeurs Excel importés par des utilisateurs (audit sécurité
// 2026-11) : plafonds de taille et de plage appliqués AVANT/APRÈS le parsing
// pour borner la mémoire et le temps CPU (DoS), en complément de la montée de
// version de SheetJS (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS).
export const MAX_FICHIER_XLSX_OCTETS = 20 * 1024 * 1024;
export const MAX_CELLULES_FEUILLE = Number(process.env.IMPORT_XLSX_MAX_CELLULES) > 0
  ? Number(process.env.IMPORT_XLSX_MAX_CELLULES)
  : 200_000;

export function verifierTailleXlsx(buffer: Buffer | Uint8Array): void {
  if (buffer.byteLength > MAX_FICHIER_XLSX_OCTETS) {
    throw new BadRequestException(`Fichier Excel trop volumineux (maximum ${MAX_FICHIER_XLSX_OCTETS / 1024 / 1024} Mo).`);
  }
}

function verifierPlages(wb: XLSX.WorkBook): void {
  for (const nom of wb.SheetNames) {
    const ref = wb.Sheets[nom]?.["!ref"];
    if (!ref) continue;
    const r = XLSX.utils.decode_range(ref);
    const cellules = (r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1);
    if (cellules > MAX_CELLULES_FEUILLE) {
      throw new BadRequestException(`La feuille « ${nom} » est trop grande (${cellules} cellules, maximum ${MAX_CELLULES_FEUILLE}).`);
    }
  }
}

// Équivalent sécurisé de XLSX.read(buffer, { type: "buffer" }) : taille bornée,
// formules/HTML/styles non évalués, plage de chaque feuille plafonnée.
export function lireXlsxSur(buffer: Buffer | Uint8Array, options: XLSX.ParsingOptions = {}): XLSX.WorkBook {
  verifierTailleXlsx(buffer);
  const wb = XLSX.read(buffer, { cellFormula: false, cellHTML: false, cellStyles: false, ...options, type: "buffer" });
  if (!options.bookSheets && !options.bookProps) verifierPlages(wb);
  return wb;
}
