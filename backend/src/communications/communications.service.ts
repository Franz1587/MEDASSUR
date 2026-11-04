import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MessagingService } from "../messaging/messaging.service";
import { EmailService } from "./email.service";
import { BrouillonCommunicationDto, EnvoyerCommunicationDto, MajCommunicationDto, SignatureDto } from "./dto/envoyer-communication.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { telephoneAvecIndicatif } from "../lib/telephone.util";

const UPLOADS_COMMUNICATIONS_DIR = path.join(UPLOADS_ROOT, "communications");

const ENVOYES = ["Envoyé", "Simulé", "Échec"];
const DOSSIERS: Record<string, Prisma.CommunicationWhereInput> = {
  tous: { supprime: false, statut: { not: "Brouillon" } },
  reception: { statut: "Reçu", archive: false, supprime: false },
  envoyes: { statut: { in: ENVOYES }, archive: false, supprime: false },
  brouillons: { statut: "Brouillon", supprime: false },
  archive: { archive: true, supprime: false },
  corbeille: { supprime: true },
  suivi: { suivi: true, supprime: false },
};

export function decouper(liste: string): string[] {
  return liste.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

const MIMES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", zip: "application/zip",
};
function mimeDe(nom: string): string {
  return MIMES[path.extname(nom).slice(1).toLowerCase()] ?? "application/octet-stream";
}

// Communications externes (2026-08/2026-10) — envoi réel via MessagingService
// (Zavu SDK) pour SMS et WhatsApp ; si ZAVU_API_KEY absente, statut "Simulé"
// (rétrocompat). Email non encore branché sur un fournisseur → toujours "Simulé".
@Injectable()
export class CommunicationsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService, private storage: StorageService, private messaging: MessagingService, private email: EmailService) {}

  config() { return { smsWhatsappActif: this.messaging.actif, emailActif: this.email.actif }; }

  findAll(filtres?: { canal?: string; destinataireType?: string; declencheur?: string; dossier?: string; q?: string }) {
    const q = filtres?.q?.trim();
    return this.prisma.communication.findMany({
      where: {
        canal: filtres?.canal || undefined,
        destinataireType: filtres?.destinataireType || undefined,
        declencheur: filtres?.declencheur || undefined,
        ...DOSSIERS[filtres?.dossier ?? ""] ?? DOSSIERS.tous,
        ...(q ? { OR: ["destinataireNom", "destinataireContact", "objet", "contenu"].map((champ) => ({ [champ]: { contains: q, mode: "insensitive" as const } })) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async compteurs() {
    const [reception, nonLus, envoyes, brouillons, archive, corbeille, suivi] = await Promise.all(
      [DOSSIERS.reception, { ...DOSSIERS.reception, lu: false }, DOSSIERS.envoyes, DOSSIERS.brouillons, DOSSIERS.archive, DOSSIERS.corbeille, DOSSIERS.suivi]
        .map((where) => this.prisma.communication.count({ where })),
    );
    return { reception, nonLus, envoyes, brouillons, archive, corbeille, suivi };
  }

  async findOne(id: string) {
    const c = await this.prisma.communication.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Communication ${id} introuvable`);
    return c;
  }

  async maj(id: string, dto: MajCommunicationDto) {
    await this.findOne(id);
    return this.prisma.communication.update({ where: { id }, data: dto });
  }

  // Suppression définitive — uniquement depuis la Corbeille ou pour un brouillon.
  async supprimerDefinitivement(id: string) {
    const c = await this.findOne(id);
    if (!c.supprime && c.statut !== "Brouillon") throw new BadRequestException("Placez d'abord le message dans la corbeille.");
    await this.prisma.communication.delete({ where: { id } });
    return { ok: true };
  }

  async signature(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { signatureEmail: true, signatureSms: true } });
  }

  async enregistrerSignature(userId: string, dto: SignatureDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: { signatureEmail: true, signatureSms: true } });
  }

  // Fichiers téléversés → uploads/communications/<6 hex>-<nom d'origine>.
  private async stockerFichiers(fichiers: Express.Multer.File[] = []): Promise<string[]> {
    if (!fichiers.length) return [];
    await fs.promises.mkdir(UPLOADS_COMMUNICATIONS_DIR, { recursive: true });
    return Promise.all(fichiers.map(async (f) => {
      const nom = `${randomUUID().slice(0, 6)}-${path.basename(Buffer.from(f.originalname, "latin1").toString("utf8")).replace(/[^\p{L}\p{N}._ -]/gu, "_")}`;
      await fs.promises.writeFile(path.join(UPLOADS_COMMUNICATIONS_DIR, nom), f.buffer);
      return nom;
    }));
  }

  private piecesExistantes(json?: string): string[] {
    if (!json) return [];
    try {
      const v = JSON.parse(json);
      // path.basename : un nom venant du client ne doit jamais sortir du dossier communications.
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => path.basename(x)) : [];
    } catch { return []; }
  }

  private async chargerPieces(noms: string[]) {
    const pieces = await Promise.all(noms.map(async (nom) => {
      const content = await fs.promises.readFile(path.join(UPLOADS_COMMUNICATIONS_DIR, nom)).catch(() => null);
      return content ? { filename: nom.replace(/^[0-9a-f]{6}-/, ""), content, contentType: mimeDe(nom) } : null;
    }));
    return pieces.filter((p): p is NonNullable<typeof p> => !!p);
  }

  // Envoi réel — Email via SMTP Hostinger, SMS/WhatsApp via Zavu.
  // "Envoyé" si le fournisseur a accepté, "Simulé" sinon (non configuré ou refus).
  private async envoyerReel(canal: string, contact: string | string[], objet: string | undefined, contenu: string, extra?: { html?: string; cc?: string; pieces?: string[] }): Promise<"Envoyé" | "Simulé"> {
    if (canal === "Email") {
      if (!this.email.actif) return "Simulé";
      const pieces = await this.chargerPieces(extra?.pieces ?? []);
      const cc = extra?.cc ? decouper(extra.cc) : undefined;
      const ok = await this.email.envoyer(contact, objet || "Message MEDASSUR+", contenu, "MEDASSUR+", pieces, cc, extra?.html);
      return ok ? "Envoyé" : "Simulé";
    }
    if (!this.messaging.actif) return "Simulé";
    // "auto" : Zavu tente WhatsApp puis retombe sur SMS — SMS pur échoue sur
    // Airtel Gabon (numéro US +14302830369 rejeté). Voir diagnostic 2026-11-03.
    const canalZavu = canal === "WhatsApp" ? "whatsapp" : "auto";
    const ok = await this.messaging.envoyer(String(contact), contenu, canalZavu as "auto" | "sms" | "whatsapp");
    return ok ? "Envoyé" : "Simulé";
  }

  async envoyer(dto: EnvoyerCommunicationDto, auteurId?: string, fichiers?: Express.Multer.File[]) {
    const pieces = [...this.piecesExistantes(dto.piecesJointesExistantes), ...await this.stockerFichiers(fichiers)];
    const commun = {
      canal: dto.canal, destinataireType: dto.destinataireType, destinataireId: dto.destinataireId,
      destinataireNom: dto.destinataireNom || dto.destinataireContact, objet: dto.objet,
      piecesJointes: pieces, pieceJointe: pieces[0] ?? null, declencheur: "Manuel", auteurId, lu: true,
    };
    if (dto.brouillonId) await this.prisma.communication.deleteMany({ where: { id: dto.brouillonId, statut: "Brouillon" } });

    if (dto.canal === "Email") {
      const destinataires = decouper(dto.destinataireContact);
      const statut = await this.envoyerReel("Email", destinataires, dto.objet, dto.contenu, { html: dto.contenuHtml, cc: dto.cc, pieces });
      return this.prisma.communication.create({
        data: { ...commun, id: randomUUID(), destinataireContact: destinataires.join("; "), cc: dto.cc || null, contenu: dto.contenu, contenuHtml: dto.contenuHtml, statut },
      });
    }

    // SMS/WhatsApp : pas de pièce jointe native → lien de téléchargement ajouté au texte.
    const base = process.env.APP_URL ?? "https://medassur.cloud";
    const contenu = pieces.length
      ? `${dto.contenu}\n\n${pieces.map((p) => `PJ ${p.replace(/^[0-9a-f]{6}-/, "")} : ${base}/uploads/communications/${encodeURIComponent(p)}`).join("\n")}`
      : dto.contenu;
    const numeros = decouper(dto.destinataireContact);
    const crees = [];
    for (const numero of numeros) {
      const destinataireContact = numeros.length === 1 ? await this.resoudreContact({ ...dto, destinataireContact: numero }) : numero;
      const statut = await this.envoyerReel(dto.canal, destinataireContact, undefined, contenu);
      crees.push(await this.prisma.communication.create({
        data: { ...commun, id: randomUUID(), destinataireContact, contenu, statut },
      }));
    }
    return crees[0];
  }

  async enregistrerBrouillon(dto: BrouillonCommunicationDto, auteurId?: string, fichiers?: Express.Multer.File[], id?: string) {
    const pieces = [...this.piecesExistantes(dto.piecesJointesExistantes), ...await this.stockerFichiers(fichiers)];
    const data = {
      canal: dto.canal ?? "Email", destinataireType: dto.destinataireType ?? "Libre", destinataireId: dto.destinataireId,
      destinataireNom: dto.destinataireNom ?? "", destinataireContact: dto.destinataireContact ?? "", cc: dto.cc || null,
      objet: dto.objet, contenu: dto.contenu ?? "", contenuHtml: dto.contenuHtml,
      piecesJointes: pieces, pieceJointe: pieces[0] ?? null, statut: "Brouillon", declencheur: "Manuel", auteurId, lu: true,
    };
    if (id) {
      await this.findOne(id);
      return this.prisma.communication.update({ where: { id }, data });
    }
    return this.prisma.communication.create({ data: { ...data, id: randomUUID() } });
  }

  // Indicatif pays (2026-08) — voir demande utilisateur : "peu importe que
  // le numéro soit écrit avec l'indicatif ou pas, l'application orientera
  // le flux de message vers le bon numéro avec le bon indicatif... pour le
  // routage des numéros et de l'indicatif cela doit être valable même pour
  // les assurés." Sans effet sur l'Email (pas de numéro) ni sur "Prospect"/
  // "Libre" (pas de contrat à consulter — le numéro saisi est déjà utilisé
  // tel quel). Le pays vient TOUJOURS d'une vraie donnée déjà en base
  // (Prestataire.pays, ou Contrat.paysSouscription pour un client/assuré —
  // "l'indicatif du pays du contrat"), jamais deviné.
  private async resoudreContact(dto: EnvoyerCommunicationDto): Promise<string> {
    const brut = dto.destinataireContact;
    if (dto.canal === "Email" || !dto.destinataireId) return brut;
    if (dto.destinataireType === "Prestataire") {
      const p = await this.prisma.prestataire.findUnique({ where: { id: dto.destinataireId }, select: { pays: true } });
      return telephoneAvecIndicatif(brut, p?.pays) ?? brut;
    }
    if (dto.destinataireType === "Client") {
      const contrat = await this.prisma.contrat.findFirst({ where: { clientId: dto.destinataireId }, orderBy: { createdAt: "desc" }, select: { paysSouscription: true } });
      return telephoneAvecIndicatif(brut, contrat?.paysSouscription) ?? brut;
    }
    if (dto.destinataireType === "AssureSante") {
      const assure = await this.prisma.assureSante.findUnique({ where: { id: dto.destinataireId }, select: { contrat: { select: { paysSouscription: true } } } });
      return telephoneAvecIndicatif(brut, assure?.contrat.paysSouscription) ?? brut;
    }
    return brut;
  }

  // Retour reçu (2026-08) — voir demande utilisateur : "recevoir des
  // retours sous forme de notification et message interne". Sans
  // fournisseur réel branché, un retour ne peut pas arriver automatiquement
  // (pas de webhook entrant) — enregistré manuellement par le
  // gestionnaire qui a reçu la réponse (par téléphone, sur WhatsApp
  // directement, etc.), ce qui déclenche la notification interne.
  async enregistrerRetour(id: string, retour: string) {
    const c = await this.findOne(id);
    const maj = await this.prisma.communication.update({ where: { id }, data: { retour, retourDate: new Date() } });
    if (c.auteurId) {
      await this.notifications.create("Gestionnaire", c.auteurId, `Retour de ${c.destinataireNom} (${c.canal}) : ${retour}`).catch(() => undefined);
    }
    return maj;
  }

  // Automatisation "nouveau contrat" (2026-08) — voir demande utilisateur :
  // "si un nouveau client est ajouté, l'application doit envoyer
  // l'information systématiquement à tous les prestataires avec la liste
  // des clients actualisée. Le fichier doit avoir les noms des clients, le
  // taux ambulatoire, le taux en hospitalisation et le plafond de chambre
  // par jour." Déclenchée à la création d'un CONTRAT (pas du Client seul) :
  // c'est le Contrat qui porte les taux/plafond, un Client tout juste créé
  // n'en a encore aucun — voir ContratsController.create. Un prestataire
  // sans téléphone enregistré ne peut recevoir aucun canal simulé ici (ni
  // Email — Prestataire n'a pas ce champ) : il est simplement ignoré, pas
  // en échec.
  async notifierPrestatairesNouveauContrat(contratId: string) {
    const contrats = await this.prisma.contrat.findMany({
      where: { branche: "Maladie", statut: "Actif" },
      include: { client: { select: { nom: true } } },
      orderBy: { client: { nom: "asc" } },
    });
    if (contrats.length === 0) return { fichier: null, notifies: 0 };

    const fichier = await this.genererListeClientsCsv(contrats);

    const prestataires = await this.prisma.prestataire.findMany({
      where: { statutConvention: "Conventionné", telephone: { not: null } },
      select: { id: true, nom: true, telephone: true, pays: true },
    });

    const contratDeclencheur = contrats.find((c) => c.id === contratId);
    const nomClientDeclencheur = contratDeclencheur?.client.nom ?? contratId;

    let notifies = 0;
    for (const p of prestataires) {
      const brut = p.telephone?.split("·")[0]?.trim();
      if (!brut) continue;
      // Indicatif pays (2026-08) — voir demande utilisateur : "peu importe
      // que le numéro soit écrit avec l'indicatif ou pas, l'application
      // orientera le flux de message vers le bon numéro avec le bon
      // indicatif" — dérivé du pays du prestataire (Prestataire.pays),
      // jamais deviné si le pays n'est pas reconnu (voir telephoneAvecIndicatif).
      const telephone = telephoneAvecIndicatif(brut, p.pays) ?? brut;
      const contenu = `Bonjour, un nouveau contrat vient d'être activé (${nomClientDeclencheur}). Veuillez trouver ci-joint la liste actualisée des clients MEDASSUR+ avec leurs taux de couverture et plafond de chambre.`;
      const statut = await this.envoyerReel("SMS", telephone, undefined, contenu);
      await this.prisma.communication.create({
        data: {
          id: randomUUID(), canal: "SMS", destinataireType: "Prestataire", destinataireId: p.id,
          destinataireNom: p.nom, destinataireContact: telephone,
          objet: "Mise à jour du réseau — liste des clients actualisée",
          contenu, pieceJointe: fichier, statut, declencheur: "NouveauContrat",
        },
      });
      notifies++;
    }
    return { fichier, notifies };
  }

  // Webhook entrant Zavu (2026-10) — messages reçus d'assurés/prestataires.
  // Cherche une communication sortante récente vers l'émetteur (même numéro,
  // dernières 72h) et y enregistre le retour automatiquement, déclenchant
  // ainsi une notification interne au gestionnaire auteur.
  async traiterWebhookEntrant(event: { type?: string; senderId?: string; data?: { from?: string; text?: string; channel?: string } }) {
    if (event.type !== "message.inbound" || !event.data?.from) return;
    const { from, text, channel } = event.data;
    if (!text) return;
    const limite = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const comm = await this.prisma.communication.findFirst({
      where: { destinataireContact: from, createdAt: { gte: limite }, statut: "Envoyé" },
      orderBy: { createdAt: "desc" },
    });
    if (!comm) {
      // Aucune communication sortante trouvée — on crée un log entrant
      await this.prisma.communication.create({
        data: {
          id: randomUUID(), canal: channel ?? "SMS", destinataireType: "Prospect",
          destinataireNom: from, destinataireContact: from,
          objet: "Message entrant (non sollicité)", contenu: text,
          statut: "Reçu", declencheur: "Webhook",
        },
      });
      return;
    }
    await this.enregistrerRetour(comm.id, text);
  }

  private async genererListeClientsCsv(
    contrats: { id: string; client: { nom: string }; tauxAmbulatoirePublique: string | null; tauxAmbulatoirePrivee: string | null; tauxHospitalisationPublique: string | null; tauxHospitalisationPrivee: string | null; plafondChambreJour: unknown }[],
  ): Promise<string> {
    const entetes = ["Client", "Taux Ambulatoire Public", "Taux Ambulatoire Privé", "Taux Hospitalisation Public", "Taux Hospitalisation Privé", "Plafond Chambre/Jour (FCFA)"];
    const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;
    // Les 4 champs de taux sont déjà des chaînes formatées avec leur "%"
    // (voir schema.prisma Contrat.tauxAmbulatoirePublique — String, pas un
    // Decimal) : ne jamais en rajouter un second, sous peine de "90%%".
    const lignes = contrats.map((c) => [
      c.client.nom,
      c.tauxAmbulatoirePublique ?? "—",
      c.tauxAmbulatoirePrivee ?? "—",
      c.tauxHospitalisationPublique ?? "—",
      c.tauxHospitalisationPrivee ?? "—",
      c.plafondChambreJour != null ? String(c.plafondChambreJour) : "—",
    ].map(String).map(echapper).join(";"));
    const csv = [entetes.map(echapper).join(";"), ...lignes].join("\r\n");

    const nomFichier = `Liste-Clients-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}.csv`;
    // BOM UTF-8 (2026-08) — sans lui, Excel ré-interprète les accents du
    // CSV en Latin-1 à l'ouverture (noms de clients affichés corrompus).
    const contenu = Buffer.from(`﻿${csv}`, "utf8");
    if (this.storage.actif) {
      await this.storage.upload("communications", nomFichier, contenu, "text/csv");
    } else {
      await fs.promises.mkdir(UPLOADS_COMMUNICATIONS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_COMMUNICATIONS_DIR, nomFichier), contenu);
    }
    return nomFichier;
  }
}
