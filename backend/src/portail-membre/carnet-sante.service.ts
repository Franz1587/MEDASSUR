import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";

const UPLOADS_CARNET_DIR = path.join(UPLOADS_ROOT, "carnet-sante");

export const RUBRIQUES_CARNET_SANTE = ["Ordonnance", "Examens"] as const;
export type RubriqueCarnetSante = (typeof RUBRIQUES_CARNET_SANTE)[number];
export type StatutBonCarnet = "NonTraite" | "PartiellementTraite" | "Traite";

// Non traité / Partiellement traité / Traité (2026-08) — voir demande
// utilisateur : "le statut du bon (Non traité, Partiellement traité,
// Traité)" — même agrégation que côté prestataire (HistoriquePrestations),
// à partir du statut EnAttente/Traite de chaque PrescriptionLigne du type
// demandé.
function statutBon(lignes: { statut: string }[]): StatutBonCarnet {
  if (lignes.every((l) => l.statut === "EnAttente")) return "NonTraite";
  if (lignes.every((l) => l.statut === "Traite")) return "Traite";
  return "PartiellementTraite";
}

export interface CarnetSanteDocument {
  id: string;
  source: "upload" | "feuille";
  assureId: string;
  assureNom: string;
  rubrique: RubriqueCarnetSante;
  fichier: string | null;
  priseEnChargeId: string | null;
  prescriptionId: string | null;
  numero: string | null;
  dateSoins: string | null;
  statut: StatutBonCarnet | null;
  libelle: string | null;
  dateAjout: Date;
}

// E-carnet Santé (2026-08) — voir demande utilisateur : "Si les informations
// ne sont pas systématiquement renseignées dans l'application par les
// structures médicales, l'assuré pourra lui-même filmer... l'application
// doit fonctionner comme des scan existant dans les téléphones mobiles pour
// créer systématiquement des documents au format pdf." v1 : la photo est
// convertie en PDF une page via PDFKit (aucune dépendance d'image
// supplémentaire nécessaire — voir doc.image ci-dessous), jamais stockée
// telle quelle. OCR explicitement hors périmètre pour cette version.
@Injectable()
export class CarnetSanteService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async ajouter(assureId: string, rubrique: string, file: Express.Multer.File, libelle?: string) {
    if (!file) throw new BadRequestException("Aucune photo reçue.");
    if (!RUBRIQUES_CARNET_SANTE.includes(rubrique as RubriqueCarnetSante)) {
      throw new BadRequestException(`Rubrique invalide : ${rubrique}`);
    }

    const filename = `${assureId}-${Date.now()}-${randomUUID().slice(0, 6)}.pdf`;
    const pdf = await this.convertirPhotoEnPdf(file.buffer);
    if (this.storage.actif) {
      await this.storage.upload("carnet-sante", filename, pdf, "application/pdf");
    } else {
      await fs.promises.mkdir(UPLOADS_CARNET_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_CARNET_DIR, filename), pdf);
    }

    return this.prisma.carnetSanteDocument.create({
      data: { assureId, rubrique, fichier: filename, libelle: libelle?.trim() || null },
    });
  }

  // Une page A4, photo centrée et mise à l'échelle (2026-08) — voir
  // demande utilisateur ci-dessus : "comme des scan existant dans les
  // téléphones mobiles" — recadrage/amélioration avancée (contraste,
  // détection de bords) explicitement hors périmètre pour cette version,
  // seule la mise en page A4 est assurée ici. Rendu en mémoire (Buffer,
  // 2026-09) plutôt que directement sur disque — nécessaire pour pouvoir
  // l'envoyer à Supabase Storage aussi bien qu'au disque local, voir
  // StorageService.
  private async convertirPhotoEnPdf(photo: Buffer): Promise<Buffer> {
    // Redimensionnement avant embarquement (2026-09) — voir demande
    // utilisateur : "je veux la rapidité, la fluidité". Une photo de
    // téléphone (souvent plusieurs Mo, résolution capteur brute) était
    // embarquée TELLE QUELLE par pdfkit dans cette page A4 — même symptôme
    // que sur les cartes d'assurance (voir dessinerPhoto/redimensionnerPhoto,
    // documents.service.ts) : documents énormes, très lents à charger dans
    // la visionneuse. 1600px de long côté reste largement lisible en A4 (≈
    // 190 DPI), ré-encodage JPEG qualité 82. Échec de lecture (format
    // exotique) → repli sur la photo brute, jamais bloquant.
    let source: Buffer | string = photo;
    try {
      // flatten fond blanc — voir même correctif sur redimensionnerPhoto,
      // documents.service.ts (sinon toute zone transparente vire au noir).
      source = await sharp(photo).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    } catch { /* repli sur la photo brute */ }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const morceaux: Buffer[] = [];
      doc.on("data", (m: Buffer) => morceaux.push(m));
      doc.on("end", () => resolve(Buffer.concat(morceaux)));
      doc.on("error", reject);
      doc.image(source, 0, 0, { fit: [doc.page.width, doc.page.height], align: "center", valign: "center" });
      doc.end();
    });
  }

  // Fusionne les documents photographiés par l'assuré ET les vrais bons
  // (Ordonnance/Examen) prescrits par un médecin (2026-08) — voir demande
  // utilisateur : "on doit voir la référence du bon, la date de soins... la
  // personne concernée... et le statut du bon (Non traité, Partiellement
  // traité, Traité)". Remplace l'ancienne heuristique "toute ligne facturée
  // de famille Consultation/Analyse/Imagerie = un document" : un "bon" n'a
  // de sens que s'il a réellement été prescrit (Prescription), avec un vrai
  // numéro et un vrai statut de traitement ligne par ligne. `source`
  // distingue les deux (voir portailMembre.service.ts, mapCarnetSanteDocument)
  // — un document "feuille" n'a pas de fichier statique à supprimer.
  async liste(idsFamille: string[], rubrique?: string): Promise<CarnetSanteDocument[]> {
    const [uploads, prescriptions] = await Promise.all([
      this.prisma.carnetSanteDocument.findMany({
        where: { assureId: { in: idsFamille }, ...(rubrique ? { rubrique } : {}) },
        include: { assure: { select: { nom: true, prenom: true } } },
      }),
      this.prisma.prescription.findMany({
        where: { priseEnCharge: { assureId: { in: idsFamille } } },
        include: {
          priseEnCharge: { include: { assure: { select: { nom: true, prenom: true } } } },
          lignes: { select: { type: true, statut: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const documentsUpload: CarnetSanteDocument[] = uploads.map((d) => ({
      id: d.id, source: "upload",
      assureId: d.assureId, assureNom: `${d.assure.nom} ${d.assure.prenom ?? ""}`.trim(),
      rubrique: d.rubrique as RubriqueCarnetSante, fichier: d.fichier, priseEnChargeId: null,
      prescriptionId: null, numero: null, dateSoins: null, statut: null,
      libelle: d.libelle, dateAjout: d.dateAjout,
    }));

    const documentsBons: CarnetSanteDocument[] = [];
    for (const p of prescriptions) {
      const branches: { cle: "Ordonnance" | "Examens"; type: "Medicament" | "Examen"; numero: string | null }[] = [
        { cle: "Ordonnance", type: "Medicament", numero: p.priseEnCharge.numeroFeuilleSoins },
        { cle: "Examens", type: "Examen", numero: p.numeroBonExamen },
      ];
      for (const b of branches) {
        if (rubrique && rubrique !== b.cle) continue;
        const lignesType = p.lignes.filter((l) => l.type === b.type);
        if (lignesType.length === 0) continue;
        const assure = p.priseEnCharge.assure;
        documentsBons.push({
          id: `bon-${p.id}-${b.cle}`, source: "feuille",
          assureId: p.priseEnCharge.assureId, assureNom: `${assure.nom} ${assure.prenom ?? ""}`.trim(),
          rubrique: b.cle, fichier: null, priseEnChargeId: p.priseEnChargeId,
          prescriptionId: p.id, numero: b.numero ?? "—", dateSoins: p.priseEnCharge.date, statut: statutBon(lignesType),
          libelle: `${b.cle === "Ordonnance" ? "Ordonnance" : "Bon d'examen"} — ${lignesType.length} ligne${lignesType.length > 1 ? "s" : ""}`,
          dateAjout: p.createdAt,
        });
      }
    }

    return [...documentsUpload, ...documentsBons].sort((a, b) => b.dateAjout.getTime() - a.dateAjout.getTime());
  }

  async supprimer(id: string, idsFamille: string[]) {
    const doc = await this.prisma.carnetSanteDocument.findUnique({ where: { id } });
    if (!doc || !idsFamille.includes(doc.assureId)) throw new NotFoundException(`Document ${id} introuvable`);
    await this.prisma.carnetSanteDocument.delete({ where: { id } });
    if (this.storage.actif) await this.storage.delete("carnet-sante", doc.fichier);
    else await fs.promises.unlink(path.join(UPLOADS_CARNET_DIR, doc.fichier)).catch(() => undefined);
  }

  cheminFichier(filename: string): string {
    return path.join(UPLOADS_CARNET_DIR, filename);
  }
}
