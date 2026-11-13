import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { AuditLogService } from "../audit/audit-log.service";
import { FactureAbonnementService } from "./facture-abonnement.service";
import { donneesParametresDepuisSociete } from "../parametres-entreprise/parametres-entreprise.service";
import { MessagingService } from "../messaging/messaging.service";
import { CreateSocieteDto } from "./dto/create-societe.dto";
import { UpdateSocieteDto } from "./dto/update-societe.dto";
import { SuspendreSocieteDto } from "./dto/suspendre-societe.dto";

// Même mot de passe initial que la création d'un utilisateur interne (voir
// UsersService) — pas de flux d'envoi d'email/réinitialisation dans cette
// version, le Super Admin le communique lui-même au responsable de la
// société créée.
const MOT_DE_PASSE_INITIAL = "medassur2024";

const SELECT_SOCIETE = {
  id: true, nom: true, email: true, telephone: true, ville: true, pays: true,
  statut: true, motifSuspension: true, createdAt: true,
  type: true, compagnieInterneId: true,
  planAbonnementId: true, modules: true,
  planAbonnement: { select: { id: true, nom: true, prixMensuel: true } },
  cycleFacturation: true, prixAbonnement: true, fraisInstallation: true,
  _count: { select: { users: true } },
};

@Injectable()
export class SocietesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private auditLog: AuditLogService,
    private factureAbonnement: FactureAbonnementService,
    private messaging: MessagingService,
  ) {}

  findAll() {
    return this.prisma.societeAssurance.findMany({ select: SELECT_SOCIETE, orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const societe = await this.prisma.societeAssurance.findUnique({
      where: { id },
      select: {
        ...SELECT_SOCIETE,
        users: { select: { id: true, nom: true, email: true, roleId: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!societe) throw new NotFoundException(`Société ${id} introuvable`);
    return societe;
  }

  // Résout les modules effectifs d'un abonnement : `modules` explicite en
  // priorité (abonnement "sur mesure") sinon le contenu du plan choisi,
  // sinon aucun module (société créée sans abonnement — bloquée en
  // pratique tant que le Super Admin n'en choisit pas un, voir demande
  // utilisateur : c'est à LUI de donner accès, jamais un défaut permissif).
  private async resoudreModules(planAbonnementId?: string | null, modules?: string[]): Promise<string[]> {
    if (modules) return modules;
    if (!planAbonnementId) return [];
    const plan = await this.prisma.planAbonnement.findUnique({ where: { id: planAbonnementId } });
    if (!plan) throw new NotFoundException(`Plan d'abonnement ${planAbonnementId} introuvable`);
    return plan.modules;
  }

  // Crée la société ET son premier compte administrateur ensemble (voir
  // CreateSocieteDto) — une transaction : soit les deux existent, soit
  // aucun (un Super Admin ne doit jamais se retrouver avec une société
  // orpheline de tout accès). Les modules de l'admin sont plafonnés à
  // l'abonnement choisi dès la création (voir demande utilisateur : "il
  // revient au super Admin de donner accès à ces modules là en fonction du
  // type d'abonnement souscrit") — jamais tous les modules par défaut.
  async create(dto: CreateSocieteDto) {
    const emailExistant = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (emailExistant) throw new ConflictException(`L'email "${dto.adminEmail}" est déjà utilisé par un autre utilisateur.`);

    const modules = await this.resoudreModules(dto.planAbonnementId, dto.modules);
    const passwordHash = await bcrypt.hash(MOT_DE_PASSE_INITIAL, 10);
    const initiales = dto.adminNom.trim().split(/\s+/).map((m) => m[0]?.toUpperCase() ?? "").join("").slice(0, 3) || "AD";

    const type = dto.type ?? "Courtier";

    const [societe, admin] = await this.prisma.$transaction(async (tx) => {
      let societe = await tx.societeAssurance.create({
        data: {
          nom: dto.nom.trim(), email: dto.email, telephone: dto.telephone, ville: dto.ville, pays: dto.pays ?? "Gabon",
          type,
          planAbonnementId: dto.planAbonnementId, modules,
          cycleFacturation: dto.cycleFacturation ?? "Mensuel", prixAbonnement: dto.prixAbonnement, fraisInstallation: dto.fraisInstallation,
        },
      });
      const admin = await tx.user.create({
        data: {
          nom: dto.adminNom.trim(), email: dto.adminEmail, initiales, passwordHash,
          roleId: "administrateur",
          // Plafonné à l'abonnement, jamais ROLE_MODULES.administrateur brut.
          modules: ROLE_MODULES.administrateur.filter((m) => modules.includes(m)),
          societeId: societe.id,
          doitChangerMotDePasse: true,
        },
        select: { id: true, nom: true, email: true, roleId: true },
      });
      // Compagnie interne auto-provisionnée (2026-09) — voir SocieteAssurance.
      // compagnieInterneId. Une société Mutuelle/Compagnie n'a pas de vrai
      // assureur externe, mais Contrat.compagnieId reste une colonne
      // obligatoire : cette ligne en tient lieu, masquée du sélecteur du
      // formulaire Contrat (voir ContratsService.create et le frontend).
      if (type !== "Courtier") {
        const compagnieInterne = await tx.compagnie.create({
          data: { id: `CMP-${randomUUID().slice(0, 6).toUpperCase()}`, nom: dto.nom.trim(), pays: dto.pays ?? "Gabon", societeId: societe.id },
        });
        societe = await tx.societeAssurance.update({ where: { id: societe.id }, data: { compagnieInterneId: compagnieInterne.id } });
      }
      // Paramètres d'entreprise créés immédiatement (2026-09) — voir
      // demande utilisateur : "dans le formulaire de création... on doit
      // pouvoir mettre le logo/le modèle de carte/le préfixe matricule."
      // Remplace la seule création paresseuse (au premier accès à l'écran
      // Paramètres) par une création tout de suite, pré-remplie avec les
      // vraies coordonnées + le modèle de carte/préfixe choisis ici — le
      // logo reste un upload séparé (fichier, voir SocietesController),
      // enchaîné juste après par le frontend une fois societe.id connu.
      await tx.parametresEntreprise.create({
        data: { id: societe.id, ...donneesParametresDepuisSociete(societe, { modeleCarteId: dto.modeleCarteId, prefixeMatricule: dto.prefixeMatricule }) },
      });
      return [societe, admin];
    });

    // Facture d'installation automatique (2026-09) — voir demande
    // utilisateur : "gérer... les frais d'installation" — générée dès la
    // création si un montant est renseigné, pour que le Super Admin n'ait
    // pas à y penser séparément (reste modifiable/annulable ensuite depuis
    // l'écran Facturation).
    if (dto.fraisInstallation) {
      await this.factureAbonnement.genererInstallationAuto(societe.id, dto.fraisInstallation).catch(() => undefined);
    }

    // Envoi réel des identifiants (2026-09) — voir demande utilisateur : "je
    // ne reçois toujours pas de sms... pour le compte de la ruche
    // excellence le courtier et la société". Même correctif que
    // ComptesMobileService.generer : le mot de passe initial reste affiché
    // à l'écran pour relais manuel (motDePasseInitial ci-dessous), mais
    // part désormais réellement par SMS/WhatsApp si un numéro exploitable a
    // été renseigné pour la société.
    const smsEnvoye = this.messaging.numeroValide(dto.telephone);
    if (smsEnvoye) {
      await this.messaging.envoyer(
        dto.telephone,
        `Vos accès administrateur MedAssur pour ${dto.nom.trim()}\nIdentifiant : ${dto.adminEmail}\nMot de passe temporaire : ${MOT_DE_PASSE_INITIAL}\nCe mot de passe vous sera demandé de changer dès la première connexion.`,
      );
    }

    return { societe: await this.findOne(societe.id), admin, motDePasseInitial: MOT_DE_PASSE_INITIAL, smsEnvoye };
  }

  // Voir demande utilisateur : "il revient au super Admin de donner accès à
  // ces modules là en fonction du type d'abonnement souscrit" — changer le
  // plan (ou la liste `modules` directement) résout les modules effectifs
  // ET plafonne RÉTROACTIVEMENT les utilisateurs déjà créés dans cette
  // société (un downgrade retire vraiment l'accès, il ne se contente pas
  // d'empêcher l'octroi de NOUVEAUX droits, voir plafonnerUtilisateurs).
  async update(id: string, dto: UpdateSocieteDto) {
    await this.findOne(id);
    const { planAbonnementId, modules: modulesExplicites, ...reste } = dto;
    const data: Prisma.SocieteAssuranceUpdateInput = { ...reste };
    let nouveauxModules: string[] | undefined;
    // planAbonnementId absent du corps de la requête : on ne touche PAS au
    // plan relié — seule `modules` (personnalisation libre) change. Présent
    // (y compris `null`, "sur mesure" détaché de tout plan) : on relie/
    // détache le plan ET on résout `modules` depuis lui, sauf si `modules`
    // est explicitement fourni dans la même requête (qui l'emporte).
    if (planAbonnementId !== undefined) {
      data.planAbonnement = planAbonnementId ? { connect: { id: planAbonnementId } } : { disconnect: true };
      nouveauxModules = await this.resoudreModules(planAbonnementId, modulesExplicites);
      data.modules = nouveauxModules;
    } else if (modulesExplicites !== undefined) {
      nouveauxModules = modulesExplicites;
      data.modules = nouveauxModules;
    }
    try {
      await this.prisma.societeAssurance.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException(`Société ${id} introuvable`);
      }
      throw err;
    }
    if (nouveauxModules) await this.plafonnerUtilisateurs(id, nouveauxModules);
    return this.findOne(id);
  }

  // Retire à chaque utilisateur de la société tout module qui ne fait plus
  // partie de son abonnement (dashboard toujours conservé — page d'accueil
  // obligatoire, voir UsersService.updateModules).
  private async plafonnerUtilisateurs(societeId: string, modulesAutorises: string[]) {
    const utilisateurs = await this.prisma.user.findMany({ where: { societeId }, select: { id: true, modules: true } });
    const ensemble = new Set(modulesAutorises);
    await Promise.all(
      utilisateurs
        .map((u) => ({ id: u.id, modulesPlafonnes: u.modules.filter((m) => m === "dashboard" || ensemble.has(m)) }))
        .filter((u, i) => u.modulesPlafonnes.length !== utilisateurs[i].modules.length)
        .map((u) => this.prisma.user.update({ where: { id: u.id }, data: { modules: u.modulesPlafonnes } })),
    );
  }

  // Suspension (2026-09) — bloque la connexion de TOUS les comptes de la
  // société d'un coup (voir AuthService.login), sans les supprimer ni
  // toucher à leurs données — réversible via reactiver() ci-dessous.
  async suspendre(id: string, dto: SuspendreSocieteDto) {
    await this.findOne(id);
    await this.prisma.societeAssurance.update({ where: { id }, data: { statut: "Suspendu", motifSuspension: dto.motif } });
    return this.findOne(id);
  }

  async reactiver(id: string) {
    await this.findOne(id);
    await this.prisma.societeAssurance.update({ where: { id }, data: { statut: "Actif", motifSuspension: null } });
    return this.findOne(id);
  }

  // Mode assistance (2026-09) — voir demande utilisateur : "il a la main
  // sur toutes les fonctionnalités de l'outil et peut y accéder en
  // assistance et cela peu import le portail de l'utilisateur... le Super
  // Admin doit pouvoir accéder dans chaque interface dédiée aux sociétés en
  // mode assistance." Émet un VRAI token de connexion (même forme que
  // AuthService.login) rattaché au plus ancien compte administrateur de la
  // société — jamais un compte fictif : préserve toutes les relations
  // (gestionnaireId, auteurId...) qu'un identifiant synthétique casserait.
  // `modules` est étendu à l'abonnement COMPLET de la société (pas les
  // droits propres de cet administrateur précis) : en assistance, le Super
  // Admin voit tout ce que la société a souscrit, sans être limité par les
  // choix internes d'attribution de droits — cohérent avec "il a la main
  // sur toutes les fonctionnalités". Journalisé (AuditLog) pour la
  // traçabilité — qui a assisté quelle société, quand.
  async assistance(id: string, superAdminId: string, superAdminEmail: string) {
    const societe = await this.findOne(id);
    if (societe.statut === "Suspendu") {
      throw new BadRequestException(`Impossible de démarrer l'assistance — société suspendue${societe.motifSuspension ? ` (${societe.motifSuspension})` : ""}. Réactivez-la d'abord.`);
    }
    const admin = await this.prisma.user.findFirst({
      where: { societeId: id, roleId: "administrateur" },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new BadRequestException(`Aucun compte administrateur dans "${societe.nom}" pour démarrer l'assistance.`);

    const payload = {
      sub: admin.id, email: admin.email, nom: admin.nom, roleId: admin.roleId,
      clientId: admin.clientId, assureSanteId: admin.assureSanteId, prestataireId: admin.prestataireId,
      medecinId: admin.medecinId, societeId: admin.societeId,
    };
    this.auditLog.log("societes", id, "Assistance", superAdminEmail, `Démarrage de l'assistance sur "${societe.nom}" (compte ${admin.email}) — super admin ${superAdminId}`).catch(() => undefined);
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: admin.id, nom: `Assistance — ${societe.nom}`, email: admin.email, roleId: admin.roleId, initiales: admin.initiales,
        modules: societe.modules, clientId: admin.clientId, assureSanteId: admin.assureSanteId, prestataireId: admin.prestataireId,
        medecinId: admin.medecinId, societeId: admin.societeId,
      },
      societeNom: societe.nom,
    };
  }

  // Un Super Admin ne doit jamais pouvoir effacer une société qui a encore
  // des comptes — même esprit que les gardes-fous de suppression ailleurs
  // dans l'app (voir demande utilisateur de sessions précédentes sur
  // Prestataires/Compagnies) : suspendre() est le geste réversible, remove()
  // reste réservé à une société créée par erreur, encore vide.
  async remove(id: string) {
    const societe = await this.findOne(id);
    if (societe._count.users > 0) {
      throw new BadRequestException(`Impossible de supprimer "${societe.nom}" — ${societe._count.users} compte(s) y sont encore rattachés. Suspendez la société plutôt que de la supprimer.`);
    }
    await this.prisma.societeAssurance.delete({ where: { id } });
    return { id };
  }
}
