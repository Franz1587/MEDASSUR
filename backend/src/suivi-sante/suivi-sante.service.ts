import * as fs from "fs";
import * as path from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushNotificationsService } from "../notifications/push-notifications.service";
import { StorageService } from "../storage/storage.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import type { AjouterMesureDto, CreerRendezVousDto, RepondreRendezVousDto } from "./suivi-sante.dto";

const INCLUDE_RDV = {
  assure: { select: { id: true, nom: true, prenom: true, matricule: true, telephone: true, typeAssure: true } },
  medecin: { select: { id: true, nom: true, prenom: true, titre: true, specialite: true, telephone: true } },
  prestataire: { select: { id: true, nom: true, type: true, ville: true, adresse: true, telephone: true } },
} as const;

const nomComplet = (p: { nom: string; prenom?: string | null }) => `${p.prenom ?? ""} ${p.nom}`.trim();
const nomMedecin = (m: { nom: string; prenom?: string | null; titre?: string | null }) => `${m.titre === "Professeur" ? "Pr" : "Dr"} ${nomComplet(m)}`;
// Heure du Gabon (UTC+1), quel que soit le fuseau du serveur.
const quand = (d: Date) => `le ${d.toLocaleDateString("fr-FR", { timeZone: "Africa/Libreville" })} à ${d.toLocaleTimeString("fr-FR", { timeZone: "Africa/Libreville", hour: "2-digit", minute: "2-digit" })}`;

// Distance à vol d'oiseau en km (formule de haversine).
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Suivi de santé (2026-11) — voir demande utilisateur : "prise de rendez-vous
// en ligne, le suivi des rendez-vous et des contrôles de santé… géolocaliser
// les prestataires de tout type et les professionnels de santé à proximité…
// un patient doit pouvoir ouvrir l'accès à son dossier patient à un médecin
// et pouvoir fermer l'accès… dès qu'il donne accès au médecin, ce dernier
// reçoit une notification, de même lorsque le patient ferme l'accès."
@Injectable()
export class SuiviSanteService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private push: PushNotificationsService,
    private storage: StorageService,
  ) {}

  // ── Notifications (in-app + push mobile) ─────────────────────────────

  private async notifierUtilisateurs(userIds: string[], type: string, titre: string, message: string, data: Record<string, unknown>) {
    await Promise.all(userIds.map(async (id) => {
      await this.notifications.create(type, id, message).catch(() => undefined);
      await this.push.envoyerAUtilisateur(id, titre, message, data);
    }));
  }

  private async comptesMedecin(medecinId: string) {
    return (await this.prisma.user.findMany({ where: { medecinId }, select: { id: true } })).map((u) => u.id);
  }

  private async comptesPrestataire(prestataireId: string) {
    return (await this.prisma.user.findMany({ where: { prestataireId }, select: { id: true } })).map((u) => u.id);
  }

  // Compte de l'assuré, sinon celui de l'assuré principal de sa famille.
  private async comptesAssure(assureId: string) {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureId }, select: { familleId: true } });
    const ids = [assureId, assure?.familleId].filter((id): id is string => !!id);
    return (await this.prisma.user.findMany({ where: { assureSanteId: { in: ids } }, select: { id: true } })).map((u) => u.id);
  }

  // ── Rendez-vous ───────────────────────────────────────────────────────

  rendezVousAssure(idsFamille: string[]) {
    return this.prisma.rendezVous.findMany({ where: { assureId: { in: idsFamille } }, include: INCLUDE_RDV, orderBy: { dateHeure: "desc" }, take: 300 });
  }

  rendezVousMedecin(medecinId: string) {
    return this.prisma.rendezVous.findMany({ where: { medecinId }, include: INCLUDE_RDV, orderBy: { dateHeure: "asc" }, take: 500 });
  }

  rendezVousPrestataire(prestataireId: string) {
    return this.prisma.rendezVous.findMany({ where: { prestataireId }, include: INCLUDE_RDV, orderBy: { dateHeure: "asc" }, take: 500 });
  }

  async creerRendezVous(dto: CreerRendezVousDto, idsFamille: string[], userId: string) {
    if (!idsFamille.includes(dto.assureId)) throw new ForbiddenException("Ce bénéficiaire ne fait pas partie de votre famille.");
    if (!dto.medecinId && !dto.prestataireId) throw new BadRequestException("Choisissez un médecin ou un établissement.");
    const dateHeure = new Date(dto.dateHeure);
    if (dateHeure.getTime() < Date.now() + 15 * 60_000) throw new BadRequestException("Choisissez une date et une heure à venir.");
    if (dto.medecinId) {
      const medecin = await this.prisma.medecin.findUnique({ where: { id: dto.medecinId }, select: { actif: true } });
      if (!medecin?.actif) throw new NotFoundException("Médecin introuvable.");
      if (dto.prestataireId) {
        const lien = await this.prisma.medecinPrestataire.findUnique({ where: { medecinId_prestataireId: { medecinId: dto.medecinId, prestataireId: dto.prestataireId } } });
        if (!lien) throw new BadRequestException("Ce médecin n'exerce pas dans cet établissement.");
      }
    }
    if (dto.prestataireId && !(await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId }, select: { id: true } }))) {
      throw new NotFoundException("Établissement introuvable.");
    }
    const rdv = await this.prisma.rendezVous.create({
      data: {
        assureId: dto.assureId, medecinId: dto.medecinId ?? null, prestataireId: dto.prestataireId ?? null,
        type: dto.type, motif: dto.motif?.trim() || null, dateHeure, demandeParUserId: userId,
      },
      include: INCLUDE_RDV,
    });
    // Le médecin (et l'établissement) sont alertés avec la date et l'heure.
    const message = `Nouveau rendez-vous (${rdv.type}) : ${nomComplet(rdv.assure)} ${quand(rdv.dateHeure)}${rdv.motif ? ` — ${rdv.motif}` : ""}.`;
    const destinataires = [
      ...(rdv.medecinId ? await this.comptesMedecin(rdv.medecinId) : []),
      ...(rdv.prestataireId ? await this.comptesPrestataire(rdv.prestataireId) : []),
    ];
    await this.notifierUtilisateurs([...new Set(destinataires)], "RendezVous", "Nouveau rendez-vous", message, { type: "rendez-vous", id: rdv.id });
    return rdv;
  }

  async annulerRendezVous(id: string, idsFamille: string[]) {
    const rdv = await this.prisma.rendezVous.findUnique({ where: { id }, include: INCLUDE_RDV });
    if (!rdv || !idsFamille.includes(rdv.assureId)) throw new NotFoundException("Rendez-vous introuvable.");
    if (!["Demandé", "Confirmé"].includes(rdv.statut)) throw new BadRequestException(`Ce rendez-vous est déjà ${rdv.statut.toLowerCase()}.`);
    const maj = await this.prisma.rendezVous.update({ where: { id }, data: { statut: "Annulé" }, include: INCLUDE_RDV });
    const message = `${nomComplet(rdv.assure)} a annulé son rendez-vous du ${quand(rdv.dateHeure).replace(/^le /, "")}.`;
    const destinataires = [
      ...(rdv.medecinId ? await this.comptesMedecin(rdv.medecinId) : []),
      ...(rdv.prestataireId ? await this.comptesPrestataire(rdv.prestataireId) : []),
    ];
    await this.notifierUtilisateurs([...new Set(destinataires)], "RendezVous", "Rendez-vous annulé", message, { type: "rendez-vous", id });
    return maj;
  }

  // Réponse du médecin ou de l'établissement (vérifiée par l'appelant :
  // `perimetre` = son médecin ou son établissement).
  async repondreRendezVous(id: string, perimetre: { medecinId?: string; prestataireId?: string }, dto: RepondreRendezVousDto, auteur: string) {
    const rdv = await this.prisma.rendezVous.findUnique({ where: { id } });
    const autorise = rdv && ((perimetre.medecinId && rdv.medecinId === perimetre.medecinId) || (perimetre.prestataireId && rdv.prestataireId === perimetre.prestataireId));
    if (!rdv || !autorise) throw new NotFoundException("Rendez-vous introuvable.");
    if (rdv.statut === "Annulé") throw new BadRequestException("Le patient a annulé ce rendez-vous.");
    if (dto.statut === "Refusé" && !dto.reponse?.trim()) throw new BadRequestException("Indiquez le motif du refus au patient.");
    const nouvelleDate = dto.dateHeure ? new Date(dto.dateHeure) : null;
    const maj = await this.prisma.rendezVous.update({
      where: { id },
      data: {
        statut: dto.statut, reponse: dto.reponse?.trim() || rdv.reponse,
        ...(nouvelleDate ? { dateHeure: nouvelleDate } : {}), ...(dto.dureeMinutes ? { dureeMinutes: dto.dureeMinutes } : {}),
      },
      include: INCLUDE_RDV,
    });
    if (["Confirmé", "Refusé"].includes(dto.statut)) {
      const deplace = nouvelleDate && nouvelleDate.getTime() !== rdv.dateHeure.getTime();
      const message = dto.statut === "Confirmé"
        ? `${auteur} a confirmé votre rendez-vous ${quand(maj.dateHeure)}${deplace ? " (nouvel horaire)" : ""}${maj.reponse ? ` — ${maj.reponse}` : ""}.`
        : `${auteur} n'a pas pu accepter votre rendez-vous ${quand(rdv.dateHeure)} — ${maj.reponse}.`;
      await this.notifierUtilisateurs(await this.comptesAssure(rdv.assureId), "RendezVous", dto.statut === "Confirmé" ? "Rendez-vous confirmé" : "Rendez-vous refusé", message, { type: "rendez-vous", id });
    }
    return maj;
  }

  // ── Professionnels de santé ───────────────────────────────────────────

  // Médecins du réseau avec leurs établissements, triés par distance quand
  // la position de l'assuré est connue ; `prestataireId` = ceux d'une structure.
  async professionnels(params: { lat?: number; lng?: number; q?: string; specialite?: string; prestataireId?: string }) {
    const medecins = await this.prisma.medecin.findMany({
      where: {
        actif: true,
        ...(params.prestataireId ? { structures: { some: { prestataireId: params.prestataireId } } } : {}),
        ...(params.specialite ? { specialite: { contains: params.specialite, mode: "insensitive" } } : {}),
        ...(params.q ? { OR: [{ nom: { contains: params.q, mode: "insensitive" } }, { prenom: { contains: params.q, mode: "insensitive" } }, { specialite: { contains: params.q, mode: "insensitive" } }] } : {}),
      },
      select: {
        id: true, nom: true, prenom: true, titre: true, specialite: true, telephone: true,
        structures: { select: { prestataire: { select: { id: true, nom: true, type: true, ville: true, adresse: true, telephone: true, latitude: true, longitude: true } } } },
      },
      take: 500,
    });
    const position = params.lat !== undefined && params.lng !== undefined ? { lat: params.lat, lng: params.lng } : null;
    return medecins
      .map((m) => {
        const structures = m.structures.map((s) => ({
          ...s.prestataire,
          distanceKm: position && s.prestataire.latitude !== null && s.prestataire.longitude !== null
            ? Math.round(distanceKm(position, { lat: s.prestataire.latitude, lng: s.prestataire.longitude }) * 10) / 10 : null,
        })).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
        return { id: m.id, nom: m.nom, prenom: m.prenom, titre: m.titre, specialite: m.specialite, telephone: m.telephone, structures, distanceKm: structures[0]?.distanceKm ?? null };
      })
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.nom.localeCompare(b.nom));
  }

  // ── Accès au dossier médical ──────────────────────────────────────────

  accesAssure(idsFamille: string[]) {
    return this.prisma.accesDossierMedical.findMany({
      where: { assureId: { in: idsFamille } },
      include: { medecin: { select: { id: true, nom: true, prenom: true, titre: true, specialite: true } }, assure: { select: { id: true, nom: true, prenom: true } } },
      orderBy: [{ actif: "desc" }, { ouvertLe: "desc" }],
    });
  }

  async changerAcces(assureId: string, medecinId: string, ouvrir: boolean, idsFamille: string[]) {
    if (!idsFamille.includes(assureId)) throw new ForbiddenException("Ce bénéficiaire ne fait pas partie de votre famille.");
    const [medecin, assure] = await Promise.all([
      this.prisma.medecin.findUnique({ where: { id: medecinId }, select: { id: true, nom: true, prenom: true, titre: true } }),
      this.prisma.assureSante.findUnique({ where: { id: assureId }, select: { nom: true, prenom: true } }),
    ]);
    if (!medecin || !assure) throw new NotFoundException("Médecin ou bénéficiaire introuvable.");
    const acces = await this.prisma.accesDossierMedical.upsert({
      where: { assureId_medecinId: { assureId, medecinId } },
      create: { assureId, medecinId, actif: ouvrir, ...(ouvrir ? {} : { fermeLe: new Date() }) },
      update: ouvrir ? { actif: true, ouvertLe: new Date(), fermeLe: null } : { actif: false, fermeLe: new Date() },
    });
    const message = ouvrir
      ? `${nomComplet(assure)} vous a donné accès à son dossier médical.`
      : `${nomComplet(assure)} a fermé l'accès à son dossier médical.`;
    await this.notifierUtilisateurs(await this.comptesMedecin(medecinId), "AccesDossier", ouvrir ? "Accès au dossier ouvert" : "Accès au dossier fermé", message, { type: "acces-dossier", assureId });
    return acces;
  }

  // Patients dont le dossier est ouvert à ce médecin.
  async patientsPartages(medecinId: string) {
    const acces = await this.prisma.accesDossierMedical.findMany({
      where: { medecinId, actif: true },
      include: { assure: { select: { id: true, nom: true, prenom: true, matricule: true, dateNaissance: true, sexe: true } } },
      orderBy: { ouvertLe: "desc" },
    });
    return acces.map((a) => ({ ...a.assure, accesDepuis: a.ouvertLe }));
  }

  private async verifierAcces(medecinId: string, assureId: string) {
    const acces = await this.prisma.accesDossierMedical.findUnique({ where: { assureId_medecinId: { assureId, medecinId } } });
    if (!acces?.actif) throw new ForbiddenException("Le patient ne vous a pas donné accès à son dossier (ou l'a fermé).");
  }

  // Dossier médical consultable par le médecin tant que l'accès est ouvert :
  // informations médicales, consultations, ordonnances et bons (toutes
  // origines), documents du carnet, constantes et rendez-vous. Aucun montant.
  async dossierPatient(medecinId: string, assureId: string) {
    await this.verifierAcces(medecinId, assureId);
    const [assure, consultations, prescriptions, documents, mesures, rendezVous] = await Promise.all([
      this.prisma.assureSante.findUnique({
        where: { id: assureId },
        select: { id: true, nom: true, prenom: true, matricule: true, dateNaissance: true, sexe: true, groupeSanguin: true, allergies: true, antecedentsMedicaux: true, traitementsEnCours: true },
      }),
      this.prisma.priseEnCharge.findMany({
        where: { assureId, statut: { notIn: ["Rejeté", "Annulé"] } },
        select: { id: true, date: true, type: true, codeAffection: true, prestataire: true, prestataireRef: { select: { nom: true } }, acteMedical: { select: { libelle: true } } },
        orderBy: { createdAt: "desc" }, take: 300,
      }),
      this.prisma.prescription.findMany({
        where: { OR: [{ priseEnCharge: { assureId } }, { assureId }] },
        select: {
          id: true, origine: true, createdAt: true, dateOrdonnance: true, prescripteurNom: true, numeroBonExamen: true, numeroOrdonnance: true, codeAffection: true, motifsConsultation: true,
          medecin: { select: { nom: true, prenom: true, titre: true, specialite: true } },
          priseEnCharge: { select: { date: true, numeroFeuilleSoins: true } },
          lignes: { select: { type: true, libelle: true, quantite: true, posologie: true, statut: true } },
        },
        orderBy: { createdAt: "desc" }, take: 200,
      }),
      this.prisma.carnetSanteDocument.findMany({ where: { assureId }, select: { id: true, rubrique: true, libelle: true, dateAjout: true }, orderBy: { dateAjout: "desc" } }),
      this.prisma.mesureSante.findMany({ where: { assureId }, orderBy: { dateMesure: "desc" }, take: 300 }),
      this.prisma.rendezVous.findMany({ where: { assureId, medecinId }, include: INCLUDE_RDV, orderBy: { dateHeure: "desc" }, take: 50 }),
    ]);
    if (!assure) throw new NotFoundException("Patient introuvable.");
    return {
      assure, mesures, documents, rendezVous,
      consultations: consultations.map((c) => ({ id: c.id, date: c.date, type: c.type, codeAffection: c.codeAffection, structure: c.prestataireRef?.nom ?? c.prestataire, acte: c.acteMedical?.libelle ?? null })),
      prescriptions: prescriptions.map((p) => ({
        id: p.id, origine: p.origine, date: p.priseEnCharge?.date ?? p.dateOrdonnance ?? p.createdAt.toLocaleDateString("fr-FR"),
        prescripteur: p.medecin ? nomMedecin(p.medecin) : p.prescripteurNom ?? "Prescripteur (bon numérisé)",
        numeroOrdonnance: p.priseEnCharge?.numeroFeuilleSoins ?? p.numeroOrdonnance, numeroBonExamen: p.numeroBonExamen,
        codeAffection: p.codeAffection, motifs: p.motifsConsultation, lignes: p.lignes,
      })),
    };
  }

  async documentPatient(medecinId: string, assureId: string, documentId: string): Promise<Buffer> {
    await this.verifierAcces(medecinId, assureId);
    const doc = await this.prisma.carnetSanteDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.assureId !== assureId) throw new NotFoundException("Document introuvable.");
    const pdf = this.storage.actif
      ? await this.storage.download("carnet-sante", doc.fichier)
      : await fs.promises.readFile(path.join(UPLOADS_ROOT, "carnet-sante", doc.fichier)).catch(() => null);
    if (!pdf) throw new NotFoundException("Fichier introuvable sur le serveur.");
    return pdf;
  }

  // ── Contrôles de santé (constantes) ───────────────────────────────────

  mesures(idsAssures: string[]) {
    return this.prisma.mesureSante.findMany({ where: { assureId: { in: idsAssures } }, orderBy: { dateMesure: "desc" }, take: 500 });
  }

  async ajouterMesure(dto: AjouterMesureDto, autorises: string[], medecinId?: string) {
    if (!autorises.includes(dto.assureId)) throw new ForbiddenException("Bénéficiaire inaccessible.");
    if (medecinId) await this.verifierAcces(medecinId, dto.assureId);
    if (!dto.valeur.trim()) throw new BadRequestException("Indiquez la valeur mesurée.");
    return this.prisma.mesureSante.create({
      data: {
        assureId: dto.assureId, type: dto.type, valeur: dto.valeur.trim(), unite: dto.unite?.trim() || null,
        dateMesure: dto.dateMesure ? new Date(dto.dateMesure) : new Date(), note: dto.note?.trim() || null, medecinId: medecinId ?? null,
      },
    });
  }

  async supprimerMesure(id: string, idsFamille: string[]) {
    const mesure = await this.prisma.mesureSante.findUnique({ where: { id } });
    if (!mesure || !idsFamille.includes(mesure.assureId)) throw new NotFoundException("Mesure introuvable.");
    await this.prisma.mesureSante.delete({ where: { id } });
    return { ok: true };
  }
}
