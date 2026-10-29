import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MessagingService } from "../messaging/messaging.service";
import { EnvoyerCommunicationDto } from "./dto/envoyer-communication.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { telephoneAvecIndicatif } from "../lib/telephone.util";

const UPLOADS_COMMUNICATIONS_DIR = path.join(UPLOADS_ROOT, "communications");

// Communications externes (2026-08/2026-10) — envoi réel via MessagingService
// (Zavu SDK) pour SMS et WhatsApp ; si ZAVU_API_KEY absente, statut "Simulé"
// (rétrocompat). Email non encore branché sur un fournisseur → toujours "Simulé".
@Injectable()
export class CommunicationsService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService, private storage: StorageService, private messaging: MessagingService) {}

  findAll(filtres?: { canal?: string; destinataireType?: string; declencheur?: string }) {
    return this.prisma.communication.findMany({
      where: { canal: filtres?.canal, destinataireType: filtres?.destinataireType, declencheur: filtres?.declencheur },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.communication.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Communication ${id} introuvable`);
    return c;
  }

  // Envoi réel (2026-10) — SMS/WhatsApp via MessagingService (Zavu) si
  // ZAVU_API_KEY configurée ; Email toujours simulé (fournisseur email non
  // encore branché). Statut retourné : "Envoyé" si l'appel Zavu a abouti,
  // "Simulé" sinon (clé absente, numéro invalide, ou canal Email).
  private async envoyerReel(canal: string, contact: string, contenu: string): Promise<"Envoyé" | "Simulé"> {
    if (canal === "Email") return "Simulé";
    if (!this.messaging.actif) return "Simulé";
    const canalZavu = canal === "WhatsApp" ? "whatsapp" : canal === "SMS" ? "sms" : "auto";
    await this.messaging.envoyer(contact, contenu, canalZavu as "auto" | "sms" | "whatsapp");
    return "Envoyé";
  }

  async envoyer(dto: EnvoyerCommunicationDto, auteurId?: string) {
    const destinataireContact = await this.resoudreContact(dto);
    const statut = await this.envoyerReel(dto.canal, destinataireContact, dto.contenu);
    return this.prisma.communication.create({
      data: {
        id: randomUUID(), canal: dto.canal, destinataireType: dto.destinataireType, destinataireId: dto.destinataireId,
        destinataireNom: dto.destinataireNom, destinataireContact,
        objet: dto.objet, contenu: dto.contenu, statut, declencheur: "Manuel", auteurId,
      },
    });
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
      const statut = await this.envoyerReel("SMS", telephone, contenu);
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
