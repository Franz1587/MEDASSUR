import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { FacturesService } from "../factures/factures.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { GedAnalyseService } from "./ged-analyse.service";

const UPLOADS_GED_DIR = path.join(UPLOADS_ROOT, "ged");
const CATEGORIE_STORAGE = "ged";

// Seuil de tolérance sur le rapprochement de montant (2026-09) — l'OCR peut
// arrondir/mal lire un chiffre ; un écart de quelques dizaines de FCFA ne
// doit pas empêcher un rapprochement par ailleurs correct (référence
// identique, un seul prestataire concerné).
const TOLERANCE_MONTANT = 100;

export interface UploadGedDocumentParams {
  sens: "Entrant" | "Sortant";
  entiteLiee?: string;
  prestataireId?: string;
  tags?: string[];
}

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private analyse: GedAnalyseService,
    private factures: FacturesService,
  ) {}

  findAll() {
    return this.prisma.gedDocument.findMany({
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // Import réel (2026-09, reprise du chantier "en pause") — voir demande
  // utilisateur d'origine : "importer les factures et les courriers des
  // prestataires... enregistrement automatique du document avec un résumé
  // et en créant l'objet en lisant le contenu". Un seul appel : dépôt du
  // fichier (disque ou Supabase Storage selon StorageService.actif, même
  // principe que AccordPrealableService.uploadDocument) + lecture IA +
  // tentative de rapprochement facture, en une seule ligne dans la liste —
  // jamais un classement "à confirmer" en deux temps comme l'ancienne
  // maquette (voir git history src/features/ged).
  async upload(file: Express.Multer.File, params: UploadGedDocumentParams, demandeurId: string) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");

    const ext = path.extname(file.originalname) || "";
    const filename = `${randomUUID()}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload(CATEGORIE_STORAGE, filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_GED_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_GED_DIR, filename), file.buffer);
    }

    const resultat = await this.analyse.analyser(file.buffer, file.originalname);

    const doc = await this.prisma.gedDocument.create({
      data: {
        id: `DOC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        nom: file.originalname,
        type: resultat.type ?? "Autre",
        entiteLiee: params.entiteLiee?.trim() || "",
        statutOcr: resultat.statutOcr,
        statutSignature: "N/A",
        tags: params.tags ?? [],
        date: new Date().toLocaleDateString("fr-FR"),
        fichier: filename,
        sens: params.sens,
        objet: resultat.objet,
        resume: resultat.resume,
        prestataireId: params.prestataireId,
        referenceExtraite: resultat.referenceExtraite,
        montantExtrait: resultat.montantExtrait,
        demandeurId,
      },
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
    });

    if (resultat.type === "Facture prestataire" && params.prestataireId) {
      return this.rapprocher(doc.id);
    }
    return doc;
  }

  // Rapprochement facture GED ↔ facture réellement saisie (2026-09) — voir
  // demande utilisateur d'origine : "suivi et comparaison des factures
  // enregistrées par la GED et celles traitées et saisies afin de dire
  // lesquelles ont été traitées totalement et lesquelles l'ont été
  // partiellement". Rejouable manuellement (voir GedController) : la
  // facture peut être saisie APRÈS l'import GED, ou une correction de
  // référence côté document peut nécessiter un nouvel essai.
  async rapprocher(id: string) {
    const doc = await this.prisma.gedDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);

    if (doc.type !== "Facture prestataire") {
      return this.prisma.gedDocument.update({
        where: { id }, data: { statutTraitement: "Sans objet" },
        include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
      });
    }

    if (!doc.prestataireId || !doc.referenceExtraite) {
      return this.prisma.gedDocument.update({
        where: { id }, data: { statutTraitement: "Non traité", factureId: null },
        include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
      });
    }

    const factures = await this.factures.findAll({ prestataireId: doc.prestataireId, reference: doc.referenceExtraite });
    if (factures.length !== 1) {
      return this.prisma.gedDocument.update({
        where: { id }, data: { statutTraitement: "Non traité", factureId: null },
        include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
      });
    }

    const facture = factures[0];
    const total = facture.lignes
      .filter((l) => l.statut !== "Annulé")
      .reduce((s, l) => s + Number(l.montant), 0);
    const montantOk = doc.montantExtrait == null || Math.abs(total - Number(doc.montantExtrait)) <= TOLERANCE_MONTANT;
    const statutTraitement = facture.statut === "Soumise" && montantOk ? "Traité totalement" : "Traité partiellement";

    return this.prisma.gedDocument.update({
      where: { id }, data: { statutTraitement, factureId: facture.id },
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
    });
  }

  async remove(id: string) {
    const doc = await this.prisma.gedDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);
    if (doc.fichier) {
      if (this.storage.actif) await this.storage.delete(CATEGORIE_STORAGE, doc.fichier);
      else await fs.promises.unlink(path.join(UPLOADS_GED_DIR, doc.fichier)).catch(() => undefined);
    }
    await this.prisma.gedDocument.delete({ where: { id } });
    return { id };
  }
}
