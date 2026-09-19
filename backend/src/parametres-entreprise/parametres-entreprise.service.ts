import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SocieteAssurance } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { UpdateParametresEntrepriseDto } from "./dto/update-parametres-entreprise.dto";

const ID_DEFAUT = "default";
const UPLOADS_LOGOS_ENTREPRISES_DIR = path.join(UPLOADS_ROOT, "logos-entreprises");
const UPLOADS_PAGES_GARDE_STATISTIQUES_DIR = path.join(UPLOADS_ROOT, "pages-garde-statistiques");
const CAT_LOGOS_ENTREPRISES = "logos-entreprises";
const CAT_PAGES_GARDE_STATISTIQUES = "pages-garde-statistiques";

// Voir demande utilisateur : "les données de la société utilisatrice
// doivent normalement remonter puisque le super Admin l'a déjà renseignée
// au moment de la création." — pas de mot "Compagnie/Mutuelle" plus
// spécifique en base (SocieteAssurance.type se limite à Courtier|Mutuelle|
// Compagnie), ce sous-titre reste donc un libellé d'affichage dérivé.
const SOUS_TITRE_PAR_TYPE: Record<string, string> = {
  Courtier: "Courtier d'Assurances",
  Mutuelle: "Mutuelle",
  Compagnie: "Compagnie d'Assurance",
};

// Extrait en fonction PURE (2026-09) — réutilisée à la fois par
// findOne() ci-dessous (création paresseuse, premier accès) ET par
// SocietesService.create() (création immédiate, dans la MÊME transaction
// que la société elle-même, voir demande utilisateur : "dans l'onglet ou
// le formulaire de création... on doit pouvoir mettre le logo/le modèle de
// carte/le préfixe matricule"). Ne dépend d'aucun client Prisma précis
// (l'appelant peut être `this.prisma` ou un `tx` de transaction).
export function donneesParametresDepuisSociete(
  societe: SocieteAssurance,
  extra?: { modeleCarteId?: string; prefixeMatricule?: string },
): Omit<Prisma.ParametresEntrepriseCreateInput, "id"> {
  return {
    nom: societe.nom,
    sousTitre: SOUS_TITRE_PAR_TYPE[societe.type] ?? SOUS_TITRE_PAR_TYPE.Courtier,
    ville: societe.ville ?? undefined,
    pays: societe.pays,
    telephone: societe.telephone ?? undefined,
    email: societe.email ?? undefined,
    // Ni boîte postale ni site web ne sont saisis à la création d'une
    // société — jamais ceux de MedAssur par défaut pour autant
    // (contrairement aux couleurs/code agence, un simple point de départ
    // neutre, ceux-ci désigneraient une entité précise qui n'est pas la
    // bonne).
    boitePostale: "",
    siteWeb: "",
    prefixeMatricule: extra?.prefixeMatricule?.trim() || undefined,
    modeleCarte: extra?.modeleCarteId ? { connect: { id: extra.modeleCarteId } } : undefined,
  };
}

@Injectable()
export class ParametresEntrepriseService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  // Cloisonnement par clé plutôt que par colonne societeId (2026-09, Phase 2
  // multi-tenant) — ParametresEntreprise est une ligne UNIQUE par société
  // (pas une liste), donc `id` sert directement de clé de société : chaque
  // société obtient sa propre ligne d'habillage (logo, couleurs, en-tête...)
  // sous id = societeId, avec un repli sur la ligne historique "default"
  // pour un contexte hors société (super_admin, scripts). Voir migration
  // 20260906130000_societe_scoping qui duplique la ligne "default" vers
  // "societe-bootstrap" pour que la société bootstrap garde son habillage.
  private id(): string {
    return TenantContext.getSocieteId() ?? ID_DEFAUT;
  }

  // Ligne unique — créée au premier appel si elle n'existe pas encore
  // (filet de sécurité pour une société créée AVANT ce mécanisme, ou tout
  // contexte hors du flux normal de SocietesService.create() qui crée
  // maintenant la ligne immédiatement, voir ce service). Pré-remplie
  // depuis les VRAIES coordonnées déjà saisies par le Super Admin à la
  // création de la société (SocieteAssurance.nom/email/telephone/ville/
  // pays) plutôt que les valeurs par défaut du schéma (2026-09) — ces
  // défauts sont l'identité RÉELLE de MedAssur (contact@medassur.ga,
  // www.medassur.ga...), correcte pour la société bootstrap elle-même mais
  // jamais pour une AUTRE société. `id === "default"` (hors contexte
  // société — super_admin/scripts) garde les défauts du schéma tels quels.
  async findOne() {
    const id = this.id();
    const existante = await this.prisma.parametresEntreprise.findUnique({ where: { id } });
    if (existante) return existante;

    const societeId = TenantContext.getSocieteId();
    const societe = societeId ? await this.prisma.societeAssurance.findUnique({ where: { id: societeId } }) : null;
    const data: Prisma.ParametresEntrepriseCreateInput = societe ? { id, ...donneesParametresDepuisSociete(societe) } : { id };
    try {
      return await this.prisma.parametresEntreprise.create({ data });
    } catch (err) {
      // Course entre deux premières ouvertures simultanées (rare, l'id est
      // la clé primaire) — la ligne existe déjà, on la relit simplement.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.parametresEntreprise.findUniqueOrThrow({ where: { id } });
      }
      throw err;
    }
  }

  update(dto: UpdateParametresEntrepriseDto) {
    const id = this.id();
    return this.prisma.parametresEntreprise.upsert({
      where: { id },
      update: dto,
      create: { id, ...dto },
    });
  }

  // Logo réel de la société (2026-09) — voir demande utilisateur : "on
  // doit pouvoir mettre le logo de l'entreprise. C'est ce logo qui remonte
  // sur les quittances, les courriers, les prises en charge, les
  // factures, les règlements, les cartes." `id` passé EXPLICITEMENT (pas
  // seulement this.id()) pour être appelable aussi bien par l'écran
  // interne (société connectée) que par le Super Admin agissant sur UNE
  // AUTRE société (voir SocietesController) — même patron que
  // CompagniesService.uploadLogo/deleteLogo.
  async uploadLogo(id: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    // Supabase Storage si configuré (production), sinon disque local
    // (dev — voir StorageService, comportement inchangé quand
    // SUPABASE_URL/SUPABASE_SERVICE_KEY sont absents).
    if (this.storage.actif) {
      await this.storage.upload(CAT_LOGOS_ENTREPRISES, filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_LOGOS_ENTREPRISES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_LOGOS_ENTREPRISES_DIR, filename), file.buffer);
    }
    return this.prisma.parametresEntreprise.upsert({
      where: { id },
      update: { logo: filename },
      create: { id, logo: filename },
    });
  }

  // Wrappers pour l'écran interne (société connectée, TenantContext) — le
  // contrôleur Super Admin (voir SocietesController) appelle directement
  // uploadLogo/deleteLogo avec l'id explicite de la société ciblée.
  uploadLogoCourant(file: Express.Multer.File) {
    return this.uploadLogo(this.id(), file);
  }

  deleteLogoCourant() {
    return this.deleteLogo(this.id());
  }

  async deleteLogo(id: string) {
    const p = await this.prisma.parametresEntreprise.findUnique({ where: { id } });
    if (p?.logo) {
      if (this.storage.actif) await this.storage.delete(CAT_LOGOS_ENTREPRISES, p.logo);
      else await fs.promises.unlink(path.join(UPLOADS_LOGOS_ENTREPRISES_DIR, p.logo)).catch(() => undefined);
    }
    await this.prisma.parametresEntreprise.upsert({
      where: { id },
      update: { logo: null },
      create: { id },
    });
    return this.prisma.parametresEntreprise.findUniqueOrThrow({ where: { id } });
  }

  // Page de garde du rapport Statistiques, personnalisable par société
  // (2026-09) — voir demande utilisateur : "le fichier statistique... doit
  // être exactement comme celui de MedAssur. Il faut seulement rendre
  // possible la personnalisation de la page de garde par client (compagnie,
  // courtier, mutuelle)." Même patron que uploadLogo/deleteLogo ci-dessus
  // (id explicite, réutilisable par le Super Admin sur une autre société).
  async uploadPageGardeStatistiques(id: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload(CAT_PAGES_GARDE_STATISTIQUES, filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_PAGES_GARDE_STATISTIQUES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_PAGES_GARDE_STATISTIQUES_DIR, filename), file.buffer);
    }
    return this.prisma.parametresEntreprise.upsert({
      where: { id },
      update: { statistiquesPageGarde: filename },
      create: { id, statistiquesPageGarde: filename },
    });
  }

  uploadPageGardeStatistiquesCourante(file: Express.Multer.File) {
    return this.uploadPageGardeStatistiques(this.id(), file);
  }

  deletePageGardeStatistiquesCourante() {
    return this.deletePageGardeStatistiques(this.id());
  }

  async deletePageGardeStatistiques(id: string) {
    const p = await this.prisma.parametresEntreprise.findUnique({ where: { id } });
    if (p?.statistiquesPageGarde) {
      if (this.storage.actif) await this.storage.delete(CAT_PAGES_GARDE_STATISTIQUES, p.statistiquesPageGarde);
      else await fs.promises.unlink(path.join(UPLOADS_PAGES_GARDE_STATISTIQUES_DIR, p.statistiquesPageGarde)).catch(() => undefined);
    }
    await this.prisma.parametresEntreprise.upsert({
      where: { id },
      update: { statistiquesPageGarde: null },
      create: { id },
    });
    return this.prisma.parametresEntreprise.findUniqueOrThrow({ where: { id } });
  }
}
