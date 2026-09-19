import * as QRCode from "qrcode";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Signature électronique des documents (2026-08) — voir demande utilisateur :
// "je veux une signature électronique unique (QR code) pour chaque document
// créé ou édité dans l'application peu importe depuis quel portail cela ait
// été fait... une authentification infaillible de chaque prestation faite."
// Voir schema.prisma DocumentSignature pour le détail du modèle et le choix
// d'un enregistrement en base (jamais un HMAC auto-porté) comme source de
// vérité — c'est cet enregistrement, immuable, qui rend une signature
// vérifiable après coup. Un appel = une nouvelle signature (une génération
// de PDF = une nouvelle preuve, jamais réécrite), même si le document
// métier sous-jacent n'a pas changé depuis la dernière fois.
export interface ActeurSignature {
  id?: string | null;
  nom: string;
  roleId: string;
}

export interface DetailStatutActuel { label: string; valeur: string }
export interface StatutActuelDocument { reference: string; statut: string; details: DetailStatutActuel[] }

// D'où l'opération a été faite (2026-08) — voir demande utilisateur : "si
// l'opération a été faite par un utilisateur depuis un portail externe".
const ROLES_PORTAIL: Record<string, string> = {
  client_particulier: "Portail Client",
  client_entreprise: "Portail Client",
  assure_principal: "Portail Assuré",
  prestataire_sante: "Portail Prestataire",
};

function origineDe(roleId: string): string {
  return ROLES_PORTAIL[roleId] ?? "Interne";
}

@Injectable()
export class DocumentSignatureService {
  constructor(private prisma: PrismaService) {}

  async signer(documentType: string, documentRef: string, acteur: ActeurSignature): Promise<{ id: string; qrBuffer: Buffer; dateSignature: Date }> {
    const signature = await this.prisma.documentSignature.create({
      data: {
        documentType, documentRef,
        acteurId: acteur.id ?? undefined, acteurNom: acteur.nom, acteurRole: acteur.roleId,
        origine: origineDe(acteur.roleId),
      },
    });
    // URL publique de vérification (2026-09 — corrigé : un ancien format
    // propriétaire "MEDASSUR-DOC:id|ref" était encodé ici, illisible par un
    // simple appareil photo puisqu'aucune page ne consommait ce format,
    // rendant le QR inutilisable en pratique). Même convention que le QR de
    // signature déjà en place (`/signer/:token`, voir
    // SignaturePubliqueController) : une vraie URL, ouvrable par n'importe
    // quel téléphone jamais connecté à l'application. Le statut, lui,
    // n'est JAMAIS encodé ici (il changerait avec le temps) — voir
    // verifier() ci-dessous, qui le recalcule en direct à chaque scan.
    const base = process.env.APP_URL ?? "https://medassur.cloud";
    const qrBuffer = await QRCode.toBuffer(`${base}/verifier/${signature.id}`, { margin: 0, width: 160 });
    return { id: signature.id, qrBuffer, dateSignature: signature.dateSignature };
  }

  // Vérification (2026-08) — voir demande utilisateur : "peu importe le
  // moment où on scan le QR code, on ait l'information de la situation
  // actualisée d'un document... une prestation qui vient d'être faite aura
  // son statut en attente de paiement, mais si plus tard on scanne le même
  // code, on pourrait voir la même référence avec comme statut 'payée' et
  // la référence du règlement". La signature elle-même (qui/quand) reste
  // figée pour toujours (c'est la preuve) ; le statut est TOUJOURS recalculé
  // depuis l'état actuel du document métier, jamais mis en cache.
  async verifier(id: string) {
    const signature = await this.prisma.documentSignature.findUnique({ where: { id } });
    if (!signature) return null;
    const statutActuel = await this.resoudreStatutActuel(signature.documentType, signature.documentRef);
    return { ...signature, statutActuel };
  }

  // Rendu public (2026-08) — voir demande utilisateur : "le statut d'une
  // facture ou d'un relevé de facture doit remonter en temps réel en
  // fonction du traitement fait côté assurance" : réutilisé directement par
  // les listes du portail prestataire (PortailPrestataireController), pas
  // seulement au scan du QR (verifier() ci-dessus).
  async resoudreStatutActuel(documentType: string, documentRef: string): Promise<StatutActuelDocument | null> {
    if (documentType === "Facture de prestation") {
      const facture = await this.prisma.facture.findUnique({
        where: { id: documentRef },
        include: { lignes: { include: { bordereau: { include: { lettreCheque: true } } } } },
      });
      if (!facture) return null;
      const ligneAvecBordereau = facture.lignes.find((l) => l.bordereau);
      const bordereau = ligneAvecBordereau?.bordereau;
      const details: DetailStatutActuel[] = [];
      let statut = facture.statut;
      if (facture.statut === "Annulée") {
        statut = "Annulée";
        if (facture.motifAnnulation) details.push({ label: "Motif", valeur: facture.motifAnnulation });
      } else if (bordereau?.lettreCheque) {
        statut = "Payée";
        details.push({ label: "Référence du règlement", valeur: bordereau.lettreCheque.numero });
        details.push({ label: "Date de paiement", valeur: bordereau.datePaiement ?? bordereau.lettreCheque.dateEmission });
      } else if (bordereau) {
        statut = bordereau.statut; // Reçu | En validation | Validé | Payé | Rejeté
        details.push({ label: "Référence du bordereau", valeur: bordereau.numero });
      } else if (facture.statut === "Soumise") {
        statut = "Soumise — en attente de règlement";
      } else {
        statut = "En saisie";
      }
      return { reference: facture.referenceFacture, statut, details };
    }

    if (documentType === "Décompte de remboursement") {
      const [factureId, assureId] = documentRef.split("/");
      const facture = await this.prisma.facture.findUnique({
        where: { id: factureId },
        include: { lignes: { where: { assureId }, include: { bordereau: { include: { lettreCheque: true } } } } },
      });
      if (!facture) return null;
      const bordereau = facture.lignes.find((l) => l.bordereau)?.bordereau;
      const details: DetailStatutActuel[] = [];
      let statut = facture.statut;
      if (bordereau?.lettreCheque) {
        statut = "Payé";
        details.push({ label: "Référence du règlement", valeur: bordereau.lettreCheque.numero });
        details.push({ label: "Date de paiement", valeur: bordereau.datePaiement ?? bordereau.lettreCheque.dateEmission });
      } else if (bordereau) {
        statut = bordereau.statut;
        details.push({ label: "Référence du bordereau", valeur: bordereau.numero });
      } else {
        statut = "En attente de règlement";
      }
      return { reference: facture.referenceFacture, statut, details };
    }

    if (documentType === "Certificat de prise en charge") {
      const accord = await this.prisma.accordPrealable.findUnique({ where: { id: documentRef } });
      if (!accord) return null;
      const details: DetailStatutActuel[] = [];
      if (accord.montantAutorise != null) details.push({ label: "Montant autorisé", valeur: `${accord.montantAutorise.toString()} FCFA` });
      if (accord.dateDecision) details.push({ label: "Date de décision", valeur: accord.dateDecision });
      return { reference: accord.id, statut: accord.decision, details };
    }

    if (documentType === "Bordereau de règlement") {
      const bordereau = await this.prisma.bordereauReglement.findUnique({ where: { id: documentRef }, include: { lettreCheque: true } });
      if (!bordereau) return null;
      const details: DetailStatutActuel[] = [{ label: "Prestataire", valeur: bordereau.prestataireId }];
      let statut = bordereau.statut;
      if (bordereau.lettreCheque) {
        statut = "Payé";
        details.push({ label: "Référence du règlement", valeur: bordereau.lettreCheque.numero });
        details.push({ label: "Date de paiement", valeur: bordereau.datePaiement ?? bordereau.lettreCheque.dateEmission });
      }
      return { reference: bordereau.numero, statut, details };
    }

    if (documentType === "Relevé de facture prestataire") {
      const releve = await this.prisma.relevePrestataire.findUnique({
        where: { numero: documentRef },
        include: { factures: { include: { lignes: { include: { bordereau: { include: { lettreCheque: true } } } } } } },
      });
      if (!releve) return null;
      const bordereaux = releve.factures.flatMap((f) => f.lignes.map((l) => l.bordereau)).filter((b): b is NonNullable<typeof b> => b != null);
      const details: DetailStatutActuel[] = [{ label: "Nombre de factures", valeur: String(releve.nbFactures) }];
      let statut = "En attente de règlement";
      if (bordereaux.length > 0 && bordereaux.every((b) => b.lettreCheque)) {
        statut = "Payé";
        const references = [...new Set(bordereaux.map((b) => b.lettreCheque!.numero))];
        details.push({ label: "Référence(s) du règlement", valeur: references.join(", ") });
      } else if (bordereaux.length > 0) {
        statut = "En cours de traitement";
      }
      return { reference: releve.numero, statut, details };
    }

    return null;
  }
}
