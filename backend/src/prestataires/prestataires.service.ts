import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MessagingService } from "../messaging/messaging.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { slugifier } from "../shared/mot-de-passe.util";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";

// Mot de passe par défaut des comptes portail prestataire (2026-09) — voir
// demande utilisateur : "pour tous les comptes des utilisateurs des
// structures médicales, il faut mettre par défaut 'passe' comme mot de
// passe pour tous." Volontairement FIXE (pas de génération aléatoire) —
// ce sont des comptes génériques partagés par un desk (accueil,
// facturation…), pas des comptes individuels ; un mot de passe unique et
// simple à communiquer prime ici sur l'aléatoire.
const MOT_DE_PASSE_PORTAIL_PRESTATAIRE = "passe";

const INCLUDE_GRILLES = { grillesTarifaires: true } as const;

// Champs sûrs pour le "Réseau de soins" (2026-08) — voir demande
// utilisateur : rubrique ouverte au portail client. Exclut délibérément
// les champs de gestion interne (scoreQualite, motifSuspension,
// delaiPaiementMoyen, bloc TPS) — sans rapport avec ce qu'un souscripteur a
// besoin de voir pour choisir un prestataire.
const SELECT_RESEAU = {
  id: true, nom: true, type: true, secteur: true, titre: true, specialite: true,
  pays: true, ville: true, telephone: true, adresse: true, statutConvention: true,
  latitude: true, longitude: true,
} as const;

function parseDateFr(s: string): number {
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d).getTime() : 0;
}

@Injectable()
export class PrestatairesService {
  constructor(private prisma: PrismaService, private messaging: MessagingService) {}

  findAll() {
    return this.prisma.prestataire.findMany({ include: INCLUDE_GRILLES });
  }

  async findOne(id: string) {
    const prestataire = await this.prisma.prestataire.findUnique({
      where: { id },
      include: { grillesTarifaires: true, prisesEnCharge: true },
    });
    if (!prestataire) throw new NotFoundException(`Prestataire ${id} introuvable`);
    return prestataire;
  }

  create(dto: CreatePrestataireDto) {
    return this.prisma.prestataire.create({ data: { id: randomUUID(), ...dto }, include: INCLUDE_GRILLES });
  }

  async update(id: string, dto: UpdatePrestataireDto) {
    await this.findOne(id);
    return this.prisma.prestataire.update({ where: { id }, data: dto, include: INCLUDE_GRILLES });
  }

  /** Suspension d'un prestataire (fraude, surtarification, non-respect des délais). */
  async suspendre(id: string, motif: string) {
    await this.findOne(id);
    return this.prisma.prestataire.update({
      where: { id },
      data: { statutConvention: "Suspendu", motifSuspension: motif },
      include: INCLUDE_GRILLES,
    });
  }

  /** Réhabilitation — remet le prestataire "Conventionné" et efface le motif de suspension. */
  async rehabiliter(id: string) {
    await this.findOne(id);
    return this.prisma.prestataire.update({
      where: { id },
      data: { statutConvention: "Conventionné", motifSuspension: null },
      include: INCLUDE_GRILLES,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.prestataire.delete({ where: { id } });
    return { id };
  }

  // Comptes portail génériques par poste (2026-09) — voir demande
  // utilisateur : "pour chaque prestataire... il faut créer des comptes
  // utilisateurs génériques pour chaque structure médicale. Sers-toi des
  // données du prestataire (nom) pour créer les comptes" puis, précisé
  // ensuite : "Service Accueil... Service Facturation... Médecin... pour
  // les pharmacies et dépôt pharmacien il faut simplement remplacer
  // service.accueil par vendeur et medecin par pharmacien". PAS un compte
  // par membre du personnel — 3 comptes PARTAGÉS par la structure, un par
  // poste, tous rôle "prestataire_sante" (même portail, mêmes droits).
  // User.prestataireId n'est plus @unique (voir migration
  // 20260912090000_prestataire_multi_comptes) : plusieurs comptes peuvent
  // désormais pointer vers le même établissement — le "poste" d'un compte
  // se déduit du préfixe de son email (aucune colonne dédiée), voir
  // POSTES_COMPTE_PORTAIL ci-dessous.
  private postesPourType(type: string | null): { id: string; label: string; prefixe: string }[] {
    const pharmacie = type === "Pharmacie" || type === "Dépôt pharmaceutique";
    return [
      { id: "accueil", label: pharmacie ? "Vendeur" : "Service Accueil", prefixe: pharmacie ? "vendeur" : "service.accueil" },
      { id: "facturation", label: "Service Facturation", prefixe: "service.facturation" },
      { id: "medecin", label: pharmacie ? "Pharmacien" : "Médecin", prefixe: pharmacie ? "pharmacien" : "medecin" },
    ];
  }

  private domainePrestataire(nom: string): string {
    return slugifier(nom).replace(/-/g, "") || "prestataire";
  }

  async comptesPortail(id: string) {
    const prestataire = await this.findOne(id);
    const comptes = await this.prisma.user.findMany({
      where: { prestataireId: id },
      select: { id: true, email: true, createdAt: true },
    });
    return this.postesPourType(prestataire.type).map((poste) => {
      const compte = comptes.find((c) => c.email.startsWith(`${poste.prefixe}@`));
      return {
        poste: poste.id, label: poste.label,
        existe: !!compte, email: compte?.email ?? null, dateCreation: compte?.createdAt ?? null,
      };
    });
  }

  // ".ga" par défaut (2026-09) — voir demande utilisateur : "il faut
  // remplacer toute extension des comptes utilisateur des portails
  // externes des utilisateurs des prestataires de '.com' en '.ga'" (le
  // domaine national du Gabon, cohérent avec le reste de l'application —
  // voir Gabon-only tropicalization).
  private async emailDisponible(nomComplet: string, prefixe: string, id: string): Promise<string> {
    const base = this.domainePrestataire(nomComplet);
    const candidats = [`${prefixe}@${base}.ga`, `${prefixe}@${base}-${id.slice(-4)}.ga`];
    for (const email of candidats) {
      const existe = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!existe) return email;
    }
    return `${prefixe}@${base}-${randomUUID().slice(0, 4)}.ga`;
  }

  // Modules "prestataire_sante" — modèle de rôle (édité depuis Administration
  // → Rôles) si présent, sinon repli sur la constante du code. Mis en cache
  // le temps d'un appel (utile pour creerComptesPortailManquants, qui crée
  // potentiellement des dizaines de comptes en une fois).
  private async modulesPrestataireSante(): Promise<string[]> {
    const template = await this.prisma.roleModuleTemplate.findUnique({ where: { roleId: "prestataire_sante" } });
    return template?.modules ?? ROLE_MODULES.prestataire_sante ?? [];
  }

  private async creerUnCompte(
    prestataire: { id: string; nom: string; telephone: string | null; societeId: string | null },
    poste: { id: string; label: string; prefixe: string },
    modules: string[],
    envoyerSms: boolean,
  ) {
    const email = await this.emailDisponible(prestataire.nom, poste.prefixe, prestataire.id);
    const motDePasse = MOT_DE_PASSE_PORTAIL_PRESTATAIRE;
    const passwordHash = await bcrypt.hash(motDePasse, 10);
    const mots = prestataire.nom.trim().split(/\s+/);
    const initiales = ((mots[0]?.[0] ?? "") + (mots[1]?.[0] ?? mots[0]?.[1] ?? "")).toUpperCase();

    await this.prisma.user.create({
      data: {
        nom: `${prestataire.nom} — ${poste.label}`, email, initiales, passwordHash, roleId: "prestataire_sante",
        modules, prestataireId: prestataire.id, societeId: prestataire.societeId,
        doitChangerMotDePasse: true,
      },
    });

    const smsEnvoye = envoyerSms ? await this.envoyerIdentifiants(prestataire.telephone, poste.label, email, motDePasse) : false;
    return { email, motDePasse, smsEnvoye };
  }

  async creerComptePortail(id: string, posteId: string) {
    const prestataire = await this.findOne(id);
    const poste = this.postesPourType(prestataire.type).find((p) => p.id === posteId);
    if (!poste) throw new BadRequestException(`Poste "${posteId}" invalide.`);

    const comptesExistants = await this.prisma.user.findMany({ where: { prestataireId: id }, select: { email: true } });
    if (comptesExistants.some((c) => c.email.startsWith(`${poste.prefixe}@`))) {
      throw new ConflictException(`Un compte "${poste.label}" existe déjà pour ce prestataire.`);
    }

    const modules = await this.modulesPrestataireSante();
    return this.creerUnCompte(prestataire, poste, modules, true);
  }

  // Bouton "Créer les comptes portail manquants" (2026-09) — voir demande
  // utilisateur : "il faut créer dans le compte de l'admin société un
  // bouton qui permet de lancer automatiquement la création des comptes
  // utilisateurs pour les nouveaux prestataires créés." Volontairement
  // scopé à LA société courante (TenantContext, jamais un id passé en
  // dur) — réutilisable par n'importe quelle société, pas seulement LA
  // RUCHE EXCELLENCE (dont la reprise initiale, elle, a été faite une fois
  // par script). Idempotent : ne recrée jamais un compte déjà existant.
  // SANS SMS (même raison que la reprise initiale — un admin qui relance
  // ce bouton après avoir ajouté 40 prestataires ne doit jamais déclencher
  // 120 SMS d'un coup sans le vouloir explicitement) ; le SMS reste
  // disponible au cas par cas via le bouton "Créer" de l'onglet Portail.
  async creerComptesPortailManquants() {
    const prestataires = await this.prisma.prestataire.findMany({ select: { id: true, nom: true, type: true, telephone: true, societeId: true } });
    const modules = await this.modulesPrestataireSante();

    let comptesCrees = 0, prestatairesCompletes = 0, prestatairesTraites = 0;
    for (const prestataire of prestataires) {
      const comptesExistants = await this.prisma.user.findMany({ where: { prestataireId: prestataire.id }, select: { email: true } });
      const postes = this.postesPourType(prestataire.type);
      const manquants = postes.filter((poste) => !comptesExistants.some((c) => c.email.startsWith(`${poste.prefixe}@`)));
      if (manquants.length === 0) { prestatairesCompletes++; continue; }
      prestatairesTraites++;
      for (const poste of manquants) {
        await this.creerUnCompte(prestataire, poste, modules, false);
        comptesCrees++;
      }
    }
    return { comptesCrees, prestatairesTraites, prestatairesCompletes, prestatairesTotal: prestataires.length };
  }

  async reinitialiserMotDePassePortail(id: string, posteId: string) {
    const prestataire = await this.findOne(id);
    const poste = this.postesPourType(prestataire.type).find((p) => p.id === posteId);
    if (!poste) throw new BadRequestException(`Poste "${posteId}" invalide.`);

    const comptes = await this.prisma.user.findMany({ where: { prestataireId: id }, select: { id: true, email: true } });
    const compte = comptes.find((c) => c.email.startsWith(`${poste.prefixe}@`));
    if (!compte) throw new NotFoundException(`Aucun compte "${poste.label}" pour ce prestataire.`);

    const motDePasse = MOT_DE_PASSE_PORTAIL_PRESTATAIRE;
    const passwordHash = await bcrypt.hash(motDePasse, 10);
    await this.prisma.user.update({ where: { id: compte.id }, data: { passwordHash, doitChangerMotDePasse: true } });

    const smsEnvoye = await this.envoyerIdentifiants(prestataire.telephone, poste.label, compte.email, motDePasse);
    return { email: compte.email, motDePasse, smsEnvoye };
  }

  // `smsEnvoye` = un numéro exploitable existait ET l'envoi a été tenté —
  // PAS une confirmation de livraison (MessagingService.envoyer() est
  // volontairement best-effort/silencieux, voir son en-tête) ; c'est le
  // signal le plus honnête accessible sans changer ce contrat partagé.
  private async envoyerIdentifiants(telephone: string | null, posteLabel: string, email: string, motDePasse: string): Promise<boolean> {
    if (!this.messaging.numeroValide(telephone)) return false;
    await this.messaging.envoyer(telephone, `Portail prestataire MedAssur — compte "${posteLabel}" — identifiant : ${email} / mot de passe : ${motDePasse}`);
    return true;
  }

  // Reporting d'activité (2026-08) — écran de fiche prestataire : combien
  // d'ententes préalables ont été transformées en facture, combien de
  // factures sont réglées vs en attente, le détail par exercice (année de
  // dateReception) des montants déclarés/payés/en attente/rejetés, ET le
  // détail ligne par ligne (qui a consommé, date de soin, frais réel,
  // montant remboursé) — dans ce métier, "Facture" ne doit jamais rester
  // un simple total agrégé, voir feedback utilisateur. Toutes les lignes
  // d'une Facture partagent le même bordereau (une facture est liée à un
  // règlement en bloc, voir FacturesService.findEligiblesReglement) — le
  // statut de règlement d'une facture se lit donc sur sa première ligne.
  async statistiques(id: string) {
    await this.findOne(id);

    const [accords, factures] = await Promise.all([
      this.prisma.accordPrealable.findMany({
        where: { prestataireId: id },
        include: { prisesEnCharge: { select: { factureId: true } } },
      }),
      this.prisma.facture.findMany({
        where: { prestataireId: id },
        include: { lignes: { include: { bordereau: true, assure: true } } },
        orderBy: { dateReception: "desc" },
      }),
    ]);

    const ententesPrealables = {
      total: accords.length,
      accordees: accords.filter((a) => a.decision === "Accordé").length,
      refusees: accords.filter((a) => a.decision === "Refusé").length,
      enAttente: accords.filter((a) => a.decision === "En attente").length,
      transformeesEnFacture: accords.filter((a) => a.prisesEnCharge.some((l) => l.factureId)).length,
    };

    const facturesStats = { total: factures.length, enSaisie: 0, soumises: 0, annulees: 0, reglees: 0, enAttenteReglement: 0 };
    const exercicesMap = new Map<string, {
      annee: string; nbFactures: number; nbLignes: number;
      montantDeclare: number; montantPaye: number; montantEnAttente: number; montantRejete: number;
    }>();
    // Détail ligne par ligne — qui a consommé, date de soin, frais réel,
    // montant remboursé : jamais seulement un total agrégé (voir
    // commentaire de la méthode).
    const lignesDetail: {
      factureId: string; factureReference: string; assureNom: string; date: string;
      montant: number; montantRembourse: number; statutLigne: string; statutReglement: string;
    }[] = [];

    for (const f of factures) {
      if (f.statut === "En saisie") facturesStats.enSaisie += 1;
      else if (f.statut === "Soumise") facturesStats.soumises += 1;
      else if (f.statut === "Annulée") facturesStats.annulees += 1;

      const bordereau = f.lignes.find((l) => l.bordereau)?.bordereau;
      const statutReglement = f.statut === "Annulée" ? "Annulée" : bordereau?.statut ?? "Non réglée";
      if (f.statut !== "Annulée") {
        if (bordereau?.statut === "Payé") facturesStats.reglees += 1;
        else facturesStats.enAttenteReglement += 1;
      }

      const annee = f.dateReception.split("/")[2] ?? "—";
      const e = exercicesMap.get(annee) ?? { annee, nbFactures: 0, nbLignes: 0, montantDeclare: 0, montantPaye: 0, montantEnAttente: 0, montantRejete: 0 };
      e.nbFactures += 1;
      for (const l of f.lignes) {
        e.nbLignes += 1;
        const montant = Number(l.montant);
        const montantRembourse = l.baseRemboursement != null ? Number(l.baseRemboursement) : 0;
        lignesDetail.push({
          factureId: f.id, factureReference: f.referenceFacture,
          assureNom: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(), date: l.date,
          montant, montantRembourse, statutLigne: l.statut, statutReglement,
        });
        if (l.statut === "Rejeté") { e.montantRejete += montant; continue; }
        e.montantDeclare += montant;
        if (l.bordereau?.statut === "Payé") e.montantPaye += montantRembourse;
        else e.montantEnAttente += l.baseRemboursement != null ? montantRembourse : montant;
      }
      exercicesMap.set(annee, e);
    }

    return {
      ententesPrealables,
      factures: facturesStats,
      exercices: [...exercicesMap.values()].sort((a, b) => b.annee.localeCompare(a.annee)),
      lignes: lignesDetail.sort((a, b) => parseDateFr(b.date) - parseDateFr(a.date)),
    };
  }

  // ── Réseau de soins (2026-08) — voir demande utilisateur : "liste des
  // prestataires réseau rangée par type et par ville... en cliquant sur le
  // prestataire, on doit avoir ses coordonnées, la liste des médecins selon
  // les spécialités qui interviennent chez eux". Ouvert au portail client
  // (données non sensibles, réseau partagé — pas de cloisonnement par
  // Client), voir PrestatairesController.

  findAllReseau(filtres: { type?: string; ville?: string; q?: string }) {
    const where: Record<string, unknown> = {
      // Seuls les établissements/praticiens conventionnés ont vocation à
      // apparaître dans le réseau vu par le client — un prestataire suspendu
      // ou en négociation n'est pas encore/plus utilisable.
      statutConvention: "Conventionné",
    };
    if (filtres.type) where.type = filtres.type;
    if (filtres.ville) where.ville = filtres.ville;
    if (filtres.q) {
      const q = filtres.q.trim();
      if (q) where.OR = [{ nom: { contains: q, mode: "insensitive" } }, { specialite: { contains: q, mode: "insensitive" } }];
    }
    return this.prisma.prestataire.findMany({ where, select: SELECT_RESEAU, orderBy: [{ type: "asc" }, { ville: "asc" }, { nom: "asc" }] });
  }

  // Médecins de l'établissement (2026-08) — voir demande utilisateur :
  // "en cliquant sur le prestataire, on doit avoir... la liste des
  // médecins selon les spécialités qui interviennent chez eux". Source
  // désormais le vrai modèle Medecin via la relation plusieurs-à-plusieurs
  // MedecinPrestataire (voir schema.prisma, remplace l'ancienne
  // auto-relation Prestataire.etablissementId) — reformaté dans la même
  // forme PrestataireReseau pour ne rien casser côté frontend
  // (src/services/reseauSoins.service.ts, PrestataireReseauDetail.medecins).
  async findOneReseau(id: string) {
    const p = await this.prisma.prestataire.findUnique({ where: { id }, select: SELECT_RESEAU });
    if (!p) throw new NotFoundException(`Prestataire ${id} introuvable`);
    const liens = await this.prisma.medecinPrestataire.findMany({
      where: { prestataireId: id, medecin: { actif: true } },
      include: { medecin: true },
      orderBy: { medecin: { nom: "asc" } },
    });
    const medecins = liens
      .map((l) => l.medecin)
      .sort((a, b) => (a.specialite ?? "").localeCompare(b.specialite ?? "") || a.nom.localeCompare(b.nom))
      .map((m) => ({
        id: m.id, nom: `${m.titre ? `${m.titre} ` : ""}${m.nom}${m.prenom ? ` ${m.prenom}` : ""}`,
        type: "Médecin", secteur: null, titre: m.titre, specialite: m.specialite,
        pays: p.pays, ville: p.ville, telephone: m.telephone, adresse: null,
        statutConvention: "Conventionné", latitude: null, longitude: null,
      }));
    return { ...p, medecins };
  }

  // Géocodage (2026-08) — API Nominatim/OpenStreetMap, gratuite et sans
  // clé, mais avec politique d'usage stricte (1 requête/seconde max, en-tête
  // User-Agent identifiant l'appli) : voir demande utilisateur : "aller sur
  // Google Maps ou n'importe quelle solution récupérer les coordonnées
  // géographiques réelles et authentiques de chaque prestataire" — Google
  // Maps exige une clé API payante non disponible ici ; Nominatim s'est
  // avéré donner de très bons résultats sur le réseau gabonais, y compris
  // en cherchant directement le NOM de l'établissement (ex. "Pharmacie
  // Nkembo, Libreville, Gabon" retrouve le point exact). On tente d'abord
  // l'adresse saisie (plus précise quand elle décrit un repère réel), puis
  // le nom de l'établissement en repli.
  private dernierAppelNominatim = 0;

  private async attendreLimiteNominatim() {
    const attente = this.dernierAppelNominatim + 1500 - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    this.dernierAppelNominatim = Date.now();
  }

  // Résultat d'une requête Nominatim — distingue "introuvable" (adresse
  // réellement sans résultat, ne sera pas retenté automatiquement) de
  // "erreur" (429/réseau, transitoire — ne doit JAMAIS marquer l'échec
  // définitif, sous peine de rayer des adresses parfaitement valides juste
  // parce que la limite de débit a été atteinte, comme observé en pratique
  // lors du premier lot en masse). `ville` vient d'addressdetails=1 — la
  // localité réelle telle que connue par OpenStreetMap, voir
  // geocoderPrestataire pour son usage en correction de ville.
  private async geocoderUneRequete(
    q: string, tentative = 0,
  ): Promise<{ statut: "trouve"; lat: number; lon: number; ville: string | null } | { statut: "introuvable" } | { statut: "erreur" }> {
    await this.attendreLimiteNominatim();
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "MedAssur/1.0 (contact: contact@medassur.ga)" } });
    if (res.status === 429) {
      if (tentative >= 3) return { statut: "erreur" };
      await new Promise((r) => setTimeout(r, 3000 * (tentative + 1)));
      return this.geocoderUneRequete(q, tentative + 1);
    }
    if (!res.ok) return { statut: "erreur" };
    const resultats = (await res.json()) as Array<{ lat: string; lon: string; address?: Record<string, string> }>;
    if (resultats.length === 0) return { statut: "introuvable" };
    const a = resultats[0].address ?? {};
    // Ordre de préférence "niveau ville" — jamais state/county/region (trop
    // large, écraserait la ville par une province comme "Estuaire").
    const ville = a.city ?? a.town ?? a.municipality ?? a.village ?? a.suburb ?? null;
    return { statut: "trouve", lat: Number(resultats[0].lat), lon: Number(resultats[0].lon), ville };
  }

  private async geocoderPrestataire(
    p: { nom: string; adresse: string | null; ville: string | null; pays: string | null },
  ): Promise<{ trouve: { lat: number; lon: number; ville: string | null } | null; erreur: boolean }> {
    const requetes = [p.adresse, p.nom].filter((s): s is string => !!s?.trim()).map((s) => [s, p.ville, p.pays].filter(Boolean).join(", "));
    let erreurRencontree = false;
    for (const q of requetes) {
      const r = await this.geocoderUneRequete(q);
      if (r.statut === "trouve") return { trouve: r, erreur: false };
      if (r.statut === "erreur") erreurRencontree = true;
    }
    return { trouve: null, erreur: erreurRencontree };
  }

  // Ville corrigée depuis le géocodage (2026-08) — voir demande
  // utilisateur : "tu peux également utiliser le géocodage pour corriger
  // les adresses (villes) des prestataires". N'écrase que si Nominatim
  // renvoie une localité différente et non vide — jamais de correction
  // fantaisiste au-delà de ce que l'API retourne réellement.
  private villeCorrigee(actuelle: string | null, trouveeParGeocodage: string | null): string | undefined {
    const v = trouveeParGeocodage?.trim();
    return v && v !== actuelle ? v : undefined;
  }

  // Déclenché manuellement (bouton "Localiser" d'une fiche) — retente
  // toujours, même si un lot précédent avait déjà marqué l'adresse
  // introuvable (l'utilisateur a pu corriger l'adresse entre-temps).
  async geolocaliser(id: string) {
    const p = await this.findOne(id);
    const { trouve, erreur } = await this.geocoderPrestataire(p);
    if (!trouve) {
      if (!erreur) await this.prisma.prestataire.update({ where: { id }, data: { geolocalisationEchec: true } });
      throw new BadRequestException(erreur ? "Service de géolocalisation temporairement indisponible — réessayez dans un instant." : `Aucune coordonnée trouvée pour "${p.nom}".`);
    }
    const ville = this.villeCorrigee(p.ville, trouve.ville);
    return this.prisma.prestataire.update({
      where: { id },
      data: { latitude: trouve.lat, longitude: trouve.lon, geolocalisationEchec: false, ...(ville ? { ville } : {}) },
      include: INCLUDE_GRILLES,
    });
  }

  // Géolocalisation en masse, par lot (2026-08) — voir demande utilisateur :
  // "grâce à la liste présente... récupérer les coordonnées géographiques
  // de chaque prestataire" puis "tu peux également utiliser le géocodage
  // pour corriger les adresses (villes) des prestataires". Découpée en lots
  // (plutôt qu'une seule requête sur les 350+ prestataires) pour rester
  // sous les délais d'une requête HTTP normale — le frontend rappelle cet
  // endpoint en boucle jusqu'à `restants === 0`. Les prestataires déjà
  // marqués en échec DÉFINITIF (adresse réellement introuvable) ne sont pas
  // retentés automatiquement ; une erreur transitoire (429/réseau) ne
  // marque jamais l'échec, le prestataire reste candidat au lot suivant.
  async geolocaliserLot(taille: number) {
    const cibles = await this.prisma.prestataire.findMany({
      where: { latitude: null, geolocalisationEchec: false },
      orderBy: { id: "asc" },
      take: taille,
    });
    let trouves = 0;
    let villesCorrigees = 0;
    for (const p of cibles) {
      const { trouve, erreur } = await this.geocoderPrestataire(p);
      if (trouve) {
        const ville = this.villeCorrigee(p.ville, trouve.ville);
        if (ville) villesCorrigees++;
        await this.prisma.prestataire.update({
          where: { id: p.id },
          data: { latitude: trouve.lat, longitude: trouve.lon, geolocalisationEchec: false, ...(ville ? { ville } : {}) },
        });
        trouves++;
      } else if (!erreur) {
        await this.prisma.prestataire.update({ where: { id: p.id }, data: { geolocalisationEchec: true } });
      }
      // Sur erreur transitoire : ne rien écrire, le prestataire reste dans
      // le pool "latitude null / geolocalisationEchec false" et sera
      // repris par le lot suivant.
    }
    const [restants, echecs, geolocalises, total] = await Promise.all([
      this.prisma.prestataire.count({ where: { latitude: null, geolocalisationEchec: false } }),
      this.prisma.prestataire.count({ where: { geolocalisationEchec: true } }),
      this.prisma.prestataire.count({ where: { latitude: { not: null } } }),
      this.prisma.prestataire.count(),
    ]);
    return { traites: cibles.length, trouves, villesCorrigees, restants, echecs, geolocalises, total };
  }
}
