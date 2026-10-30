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
  dateCachetManuelle?: string;
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

  // Import réel (2026-09/2026-10) — lecture ARIANA 360° : avant l'OCR, la
  // liste des prestataires connus est chargée et passée à l'IA pour une
  // résolution de nom plus fiable ; après l'OCR, le rapprochement facture
  // est tenté même si l'utilisateur n'a pas sélectionné de prestataire
  // (auto-résolution par nom extrait). Le rapprochement est enrichi d'une
  // détection du paiement réel (chaîne BordereauReglement → LettreCheque)
  // qui clôture automatiquement les factures déjà payées (cas récupération
  // de données — factures scannées après le fait).
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

    // Contexte 360° — liste des prestataires pour l'OCR ARIANA
    const prestatairesConnus = await this.prisma.prestataire.findMany({
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
      take: 300,
    });

    const resultat = await this.analyse.analyser(file.buffer, file.originalname, { prestatairesConnus });

    // Auto-résolution prestataire : si l'utilisateur n'en a pas sélectionné
    // mais qu'ARIANA a lu un nom d'émetteur, tenter un appariement en base.
    let prestataireIdEffectif = params.prestataireId;
    if (!prestataireIdEffectif && resultat.nomEmetteurExtrait) {
      const trouve = await this.trouverPrestataireParNom(resultat.nomEmetteurExtrait, prestatairesConnus);
      if (trouve) prestataireIdEffectif = trouve.id;
    }

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
        prestataireId: prestataireIdEffectif,
        referenceExtraite: resultat.referenceExtraite,
        montantExtrait: resultat.montantExtrait,
        dateCachet: params.dateCachetManuelle || resultat.dateCachet,
        nomEmetteurExtrait: resultat.nomEmetteurExtrait,
        demandeurId,
      },
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
    });

    if (resultat.type === "Facture prestataire" && prestataireIdEffectif) {
      return this.rapprocher(doc.id);
    }
    return doc;
  }

  // Auto-résolution prestataire par nom (ARIANA 360°, 2026-10).
  // Règles strictes pour éviter les faux appariements (voir incident
  // 2026-10-30 : correspondance inverse trop large → mauvais prestataire
  // lié alors qu'ARIANA avait lu un nom différent dans le résumé).
  // Stratégie : exact d'abord, puis contenance bidirectionnelle sur 20+
  // caractères ; aucune correspondance partielle sur nom court ou ambigu.
  private async trouverPrestataireParNom(
    nom: string,
    cache?: { id: string; nom: string }[],
  ): Promise<{ id: string } | null> {
    const normaliser = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const terme = normaliser(nom);
    if (terme.length < 5) return null;

    if (cache?.length) {
      // 1. Correspondance exacte (après normalisation)
      const exact = cache.find((p) => normaliser(p.nom) === terme);
      if (exact) return { id: exact.id };

      // 2. Contenance directe : le terme est entièrement DANS le nom enregistré
      //    (ex. terme="pharmacie kiyine" dans "PHARMACIE LA KIYINE DE LIBREVILLE")
      //    → seulement si le terme fait au moins 10 caractères
      if (terme.length >= 10) {
        const dans = cache.filter((p) => normaliser(p.nom).includes(terme));
        if (dans.length === 1) return { id: dans[0].id };
      }

      // 3. Contenance du nom enregistré dans le terme — seulement si le nom
      //    fait au moins 12 caractères (évite les noms courts qui matchent
      //    n'importe quoi, comme "CDS" dans un texte long).
      const dans2 = cache.filter((p) => {
        const n = normaliser(p.nom);
        return n.length >= 12 && terme.includes(n);
      });
      if (dans2.length === 1) return { id: dans2[0].id };

      return null;
    }

    // Fallback DB (sans cache)
    const exact = await this.prisma.prestataire.findFirst({
      where: { nom: { equals: terme, mode: "insensitive" } },
      select: { id: true },
    });
    if (exact) return exact;
    return null;
  }

  async streamFichier(id: string, res: import("express").Response) {
    const doc = await this.prisma.gedDocument.findUnique({ where: { id } });
    if (!doc || !doc.fichier) throw new NotFoundException(`Document ${id} introuvable`);
    const filePath = path.join(UPLOADS_GED_DIR, doc.fichier);
    res.setHeader("Content-Disposition", `inline; filename="${doc.nom}"`);
    res.sendFile(filePath);
  }

  async update(id: string, data: { prestataireId?: string | null; entiteLiee?: string; dateCachet?: string | null }) {
    return this.prisma.gedDocument.update({
      where: { id },
      data: {
        ...(data.prestataireId !== undefined ? { prestataireId: data.prestataireId || null } : {}),
        ...(data.entiteLiee !== undefined ? { entiteLiee: data.entiteLiee } : {}),
        ...(data.dateCachet !== undefined ? { dateCachet: data.dateCachet || null } : {}),
      },
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
    });
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

    let prestataireIdEffectif = doc.prestataireId;
    let factures = await this.factures.findAll({ prestataireId: prestataireIdEffectif, reference: doc.referenceExtraite });

    // Fallback 1 — ARIANA tente de résoudre le vrai prestataire depuis
    // nomEmetteurExtrait si le prestataireId enregistré ne donne rien
    // (mauvaise sélection manuelle ou mauvaise auto-résolution à l'upload).
    if (factures.length !== 1 && doc.nomEmetteurExtrait) {
      const trouve = await this.trouverPrestataireParNom(doc.nomEmetteurExtrait);
      if (trouve && trouve.id !== prestataireIdEffectif) {
        const facturesViaNom = await this.factures.findAll({ prestataireId: trouve.id, reference: doc.referenceExtraite });
        if (facturesViaNom.length === 1) {
          prestataireIdEffectif = trouve.id;
          factures = facturesViaNom;
          await this.prisma.gedDocument.update({ where: { id }, data: { prestataireId: prestataireIdEffectif } });
        }
      }
    }

    // Fallback 2 — scanner objet + resume pour trouver un prestataire connu
    // (cas où nomEmetteurExtrait est le mauvais letterhead mais le corps du
    // document mentionne explicitement le bon prestataire, ex. incident
    // 2026-10-30 : "CDS MEDICAL" en tête, "Union Médicale" dans le texte).
    if (factures.length !== 1 && doc.referenceExtraite) {
      const texteDoc = [doc.objet, doc.resume].filter(Boolean).join(" ");
      if (texteDoc.length > 10) {
        const prestataires = await this.prisma.prestataire.findMany({
          select: { id: true, nom: true }, orderBy: { nom: "asc" }, take: 300,
        });
        const normalise = (s: string) =>
          s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        const texteNorm = normalise(texteDoc);
        // Cherche les prestataires dont le nom (≥ 10 chars) apparaît dans le texte
        const candidats = prestataires.filter((p) => {
          const n = normalise(p.nom);
          return n.length >= 10 && texteNorm.includes(n) && p.id !== prestataireIdEffectif;
        });
        for (const candidat of candidats) {
          const f = await this.factures.findAll({ prestataireId: candidat.id, reference: doc.referenceExtraite });
          if (f.length === 1) {
            prestataireIdEffectif = candidat.id;
            factures = f;
            await this.prisma.gedDocument.update({
              where: { id },
              data: { prestataireId: prestataireIdEffectif, nomEmetteurExtrait: candidat.nom },
            });
            break;
          }
        }
      }
    }

    // Fallback 3 — Relevé de règlement (référence RLV… ou numéro de bordereau).
    // Un "Relevé de règlement factures prestataire" porte la référence du
    // BordereauReglement, pas d'une facture individuelle. Si les fallbacks 1 et 2
    // n'ont pas trouvé de facture par référence, chercher un bordereau dont le
    // numéro correspond et, si ce bordereau est payé, marquer "Traité totalement"
    // en attachant la première facture liée (pour avoir un lien cliquable).
    if (factures.length !== 1) {
      const bordereau = await this.prisma.bordereauReglement.findFirst({
        where: {
          OR: [
            { numero: doc.referenceExtraite ?? undefined },
            { numero: { contains: doc.referenceExtraite ?? "", mode: "insensitive" } },
          ],
          prestataireId: prestataireIdEffectif,
        },
        include: {
          lettreCheque: { select: { numero: true, numeroCheque: true, montantTotal: true, dateEmission: true } },
          lignes: { where: { statut: { not: "Annulé" } }, select: { factureId: true }, take: 1 },
        },
      });

      if (bordereau) {
        const statutTraitement = bordereau.statut === "Payé" ? "Traité totalement" : "Traité partiellement";
        const premierFactureId = bordereau.lignes[0]?.factureId ?? null;
        return this.prisma.gedDocument.update({
          where: { id },
          data: { statutTraitement, factureId: premierFactureId },
          include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
        });
      }

      return this.prisma.gedDocument.update({
        where: { id }, data: { statutTraitement: "Non traité", factureId: null },
        include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
      });
    }

    const facture = factures[0];
    const lignesActives = facture.lignes.filter((l) => l.statut !== "Annulé");
    const total = lignesActives.reduce((s, l) => s + Number(l.montant), 0);
    const montantOk = doc.montantExtrait == null || Math.abs(total - Number(doc.montantExtrait)) <= TOLERANCE_MONTANT;

    // Détection paiement 360° (ARIANA, 2026-10) — lit la chaîne complète
    // BordereauReglement → LettreCheque pour savoir si la facture a déjà
    // été payée comptablement, même si son statut est encore "Soumise"
    // (cas typique de la récupération de données).
    let statutTraitement: string;

    if (facture.statut === "Payée") {
      // Déjà clôturée lors d'un traitement précédent
      statutTraitement = "Traité totalement";
    } else {
      const lignesPaiement = await this.prisma.priseEnCharge.findMany({
        where: { factureId: facture.id, statut: { not: "Annulé" } },
        select: {
          bordereau: {
            select: {
              statut: true,
              lettreCheque: {
                select: { numero: true, numeroCheque: true, montantTotal: true, dateEmission: true },
              },
            },
          },
        },
      });

      const avecBordereau = lignesPaiement.filter((l) => l.bordereau != null);
      const toutesPayees = avecBordereau.length > 0
        && avecBordereau.every((l) => l.bordereau?.statut === "Payé");

      if (toutesPayees) {
        // ARIANA clôture la facture : toutes les lignes sont dans un
        // bordereau "Payé" → statut "Payée", traitement = totalement.
        await this.prisma.facture.update({
          where: { id: facture.id },
          data: { statut: "Payée" },
        });
        statutTraitement = "Traité totalement";
      } else {
        statutTraitement = facture.statut === "Soumise" && montantOk ? "Traité totalement" : "Traité partiellement";
      }
    }

    return this.prisma.gedDocument.update({
      where: { id }, data: { statutTraitement, factureId: facture.id },
      include: { prestataire: { select: { nom: true } }, facture: { select: { id: true, referenceFacture: true, statut: true } } },
    });
  }

  // Rapport de liaison GED (2026-10) — voir demande utilisateur : "faire des
  // rapport (facture traité totalement ou partiellement et donner la ou les
  // référence de règlement maladie, comptable et le chèque correspondant)".
  // Remonte toute la chaîne GedDocument → Facture → PriseEnCharge →
  // BordereauReglement → LettreCheque pour fournir un rapport exhaustif.
  async genererRapportLiaison(id: string) {
    const doc = await this.prisma.gedDocument.findUnique({
      where: { id },
      include: {
        prestataire: { select: { nom: true } },
        facture: {
          include: {
            lignes: {
              where: { statut: { not: "Annulé" } },
              include: { bordereau: { include: { lettreCheque: true } } },
            },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);

    if (!doc.factureId || !doc.facture) {
      return {
        documentId: doc.id, nom: doc.nom, type: doc.type,
        statutTraitement: doc.statutTraitement,
        prestataire: doc.prestataire?.nom ?? null,
        facture: null, bordereaux: [], lettresCheque: [],
      };
    }

    const facture = doc.facture;

    type BordLigne = NonNullable<typeof facture.lignes[0]["bordereau"]>;
    type LcBord = NonNullable<BordLigne["lettreCheque"]>;

    const bordereauMap = new Map<string, BordLigne>();
    for (const ligne of facture.lignes) {
      if (ligne.bordereau) bordereauMap.set(ligne.bordereau.id, ligne.bordereau);
    }
    const bordereaux = [...bordereauMap.values()];

    const lettresChequeMap = new Map<string, LcBord>();
    for (const b of bordereaux) {
      if (b.lettreCheque) lettresChequeMap.set(b.lettreCheque.id, b.lettreCheque);
    }

    return {
      documentId: doc.id, nom: doc.nom, type: doc.type,
      statutTraitement: doc.statutTraitement,
      prestataire: doc.prestataire?.nom ?? null,
      facture: {
        id: facture.id,
        referenceFacture: facture.referenceFacture,
        statut: facture.statut,
        dateReception: facture.dateReception,
        montantSaisi: facture.lignes.reduce((s, l) => s + Number(l.montant), 0),
        montantExtrait: doc.montantExtrait != null ? Number(doc.montantExtrait) : null,
      },
      bordereaux: bordereaux.map((b) => ({
        id: b.id, numero: b.numero, statut: b.statut,
        montantTotal: Number(b.montantTotal),
        datePaiement: b.datePaiement ?? null,
      })),
      lettresCheque: [...lettresChequeMap.values()].map((lc) => ({
        id: lc.id, numero: lc.numero, numeroCheque: lc.numeroCheque,
        montantTotal: Number(lc.montantTotal), dateEmission: lc.dateEmission,
      })),
    };
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
