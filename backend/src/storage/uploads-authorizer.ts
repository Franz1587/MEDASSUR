import { EXTERNAL_ROLE_IDS } from "../auth/global-access.guard";
import type { PrismaService } from "../prisma/prisma.service";
import type { UploadsAuthUser } from "./uploads-access.middleware";

// Autorisation des fichiers uploadés par catégorie : retrouve la ligne qui
// référence le fichier (nom stocké) et vérifie société + propriétaire.
//  - super_admin : tout ;
//  - utilisateur rattaché à une société : la ligne propriétaire doit porter
//    la même société (une ligne sans société reste invisible, comme dans le
//    filtrage Prisma multi-tenant — voir prisma.service.ts) ;
//  - comptes externes : uniquement leurs propres fichiers (assuré → sa
//    famille, client → ses contrats, prestataire → ses dossiers, médecin →
//    dossiers ouverts, messagerie → ses conversations).
// Les catégories sans propriétaire exploitable (logos, modèles de carte,
// règles...) exigent seulement une authentification valide.

const estExterne = (roleId: string) => (EXTERNAL_ROLE_IDS as readonly string[]).includes(roleId);

function societeOk(user: UploadsAuthUser, societeId: string | null | undefined): boolean {
  if (user.roleId === "super_admin" || !user.societeId) return true;
  return !!societeId && societeId === user.societeId;
}

type Autorisation = (user: UploadsAuthUser, categorie: string, fichier: string, segments: string[]) => Promise<boolean>;

export function creerAutorisationUploads(prisma: PrismaService): Autorisation {
  const racineFamille = (a: { id: string; familleId: string | null }) => a.familleId ?? a.id;

  async function accesAssure(user: UploadsAuthUser, assureId: string, medical: boolean): Promise<boolean> {
    const a = await prisma.assureSante.findUnique({
      where: { id: assureId },
      select: { id: true, societeId: true, familleId: true, contrat: { select: { clientId: true } } },
    });
    if (!a || !societeOk(user, a.societeId)) return false;
    if (!estExterne(user.roleId)) return true;
    switch (user.roleId) {
      case "assure_principal": {
        if (!user.assureSanteId) return false;
        const moi = await prisma.assureSante.findUnique({ where: { id: user.assureSanteId }, select: { id: true, familleId: true } });
        return !!moi && racineFamille(moi) === racineFamille(a);
      }
      case "client_particulier":
      case "client_entreprise":
        return !medical && !!user.clientId && a.contrat?.clientId === user.clientId;
      case "prestataire_sante":
        return !medical;
      case "medecin_prescripteur": {
        if (!user.medecinId) return false;
        const acces = await prisma.accesDossierMedical.findFirst({ where: { assureId, medecinId: user.medecinId, actif: true }, select: { id: true } });
        return !!acces;
      }
      default:
        return false;
    }
  }

  async function dossierAssureOuPrestataire(user: UploadsAuthUser, d: { societeId: string | null; assureId: string; prestataireId: string | null }): Promise<boolean> {
    if (!societeOk(user, d.societeId)) return false;
    if (!estExterne(user.roleId)) return true;
    if (user.roleId === "prestataire_sante") return !!user.prestataireId && d.prestataireId === user.prestataireId;
    return accesAssure(user, d.assureId, true);
  }

  return async (user, categorie, fichier, segments) => {
    if (user.roleId === "super_admin") return true;
    const interne = !estExterne(user.roleId);
    const plat = segments.length === 2;

    switch (categorie) {
      case "carnet-sante": {
        if (!plat) return false;
        const base = fichier.replace(/(-cachet)?\.(pdf|jpg|png)$/i, "");
        const doc = await prisma.carnetSanteDocument.findFirst({ where: { fichier: `${base}.pdf` }, select: { assureId: true } });
        return !!doc && accesAssure(user, doc.assureId, true);
      }
      case "photos": {
        if (!plat) return false;
        const a = await prisma.assureSante.findFirst({ where: { photo: fichier }, select: { id: true } });
        if (a) return accesAssure(user, a.id, false);
        const b = await prisma.demandeClientBeneficiaire.findFirst({
          where: { photo: fichier },
          select: { demandeClient: { select: { societeId: true, clientId: true } } },
        });
        if (!b) return false;
        if (!societeOk(user, b.demandeClient.societeId)) return false;
        return interne || (!!user.clientId && b.demandeClient.clientId === user.clientId);
      }
      case "accords-prealables": {
        if (!plat) return false;
        const ap = await prisma.accordPrealable.findFirst({
          where: { OR: [{ ordonnanceFichier: fichier }, { devisFichier: fichier }, { documentNumerise: fichier }] },
          select: { societeId: true, assureId: true, prestataireId: true },
        });
        return !!ap && dossierAssureOuPrestataire(user, ap);
      }
      case "remboursements": {
        if (!plat) return false;
        const pec = await prisma.priseEnCharge.findFirst({
          where: { OR: [{ prescriptionFichier: fichier }, { factureFichier: fichier }, { quittanceFichier: fichier }, { autreFichier: fichier }] },
          select: { societeId: true, assureId: true, prestataireId: true },
        });
        return !!pec && dossierAssureOuPrestataire(user, pec);
      }
      case "messagerie": {
        if (!plat) return false;
        const m = await prisma.message.findFirst({
          where: { pieceJointe: fichier },
          select: { conversation: { select: { societeId: true, demandeurId: true, assigneAId: true } } },
        });
        if (!m) return false;
        if (!societeOk(user, m.conversation.societeId)) return false;
        return interne || m.conversation.demandeurId === user.userId;
      }
      case "ged": {
        if (!plat || !interne) return false;
        const g = await prisma.gedDocument.findFirst({ where: { fichier }, select: { societeId: true } });
        return !!g && societeOk(user, g.societeId);
      }
      case "communications": {
        if (!plat || !interne) return false;
        const c = await prisma.communication.findFirst({
          where: { OR: [{ pieceJointe: fichier }, { piecesJointes: { has: fichier } }] },
          select: { societeId: true },
        });
        return !!c && societeOk(user, c.societeId);
      }
      case "appel-offres": {
        if (!plat || !interne) return false;
        const d = await prisma.appelOffresDocument.findFirst({ where: { fichier }, select: { appelOffres: { select: { societeId: true } } } });
        return !!d && societeOk(user, d.appelOffres.societeId);
      }
      case "offres-sante": {
        if (!plat || !interne) return false;
        const o = await prisma.offreGeneree.findFirst({ where: { fichier }, select: { societeId: true } });
        return !!o && societeOk(user, o.societeId);
      }
      case "photos-users": {
        if (!plat) return false;
        const u = await prisma.user.findFirst({ where: { photo: fichier }, select: { societeId: true } });
        return !!u && societeOk(user, u.societeId);
      }
      case "signatures": {
        if (!plat) return false;
        const u = await prisma.user.findFirst({ where: { signature: fichier }, select: { id: true, societeId: true } });
        return !!u && societeOk(user, u.societeId) && (interne || u.id === user.userId);
      }
      case "logos": {
        const c = await prisma.compagnie.findFirst({ where: { logo: fichier }, select: { societeId: true } });
        return !c || societeOk(user, c.societeId);
      }
      case "logos-clients": {
        const c = await prisma.client.findFirst({ where: { logo: fichier }, select: { societeId: true } });
        return !c || societeOk(user, c.societeId);
      }
      case "logos-prospects": {
        if (!interne) return false;
        const p = await prisma.prospect.findFirst({ where: { logo: fichier }, select: { societeId: true } });
        return !p || societeOk(user, p.societeId);
      }
      case "logos-cotations": {
        if (!interne) return false;
        const c = await prisma.cotation.findFirst({ where: { logo: fichier }, select: { societeId: true } });
        return !c || societeOk(user, c.societeId);
      }
      case "logos-entreprises":
      case "pages-garde-statistiques":
      case "modeles-carte":
        return true;
      case "regles-consignes":
        return interne;
      default:
        // Catégorie inconnue : jamais servie à un compte externe.
        return interne;
    }
  };
}
