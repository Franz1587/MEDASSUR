import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { genererMotDePasseTemporaire, slugifier } from "../shared/mot-de-passe.util";
import { ROLE_MODULES } from "../auth/role-modules";

export interface InfoPrescripteur {
  prescripteurNom: string;
  titrePrescripteur?: string;
  specialitePrescripteur?: string;
  codePraticien: string;
  structureNom: string;
  codeEtablissement: string;
}

// Trouve ou crée automatiquement le médecin prescripteur et sa structure
// médicale à partir des informations lues sur un formulaire papier (FS/FE)
// par ARIANA, puis maintient le lien MedecinPrestataire.
// Appelé depuis creerNumerise() (bon numérisé) et GedService.upload()
// (analyse GED) — aucun import circulaire car c'est une fonction, pas un
// service injecté.
export async function resoudreOuCreerPrescripteur(
  prisma: PrismaService,
  info: InfoPrescripteur,
): Promise<{ medecinId: string | null; prestataireId: string | null }> {
  const nom = info.prescripteurNom.trim();
  const code = info.codePraticien.trim() || null;
  const nomStructure = info.structureNom.trim() || null;
  const codeStructure = info.codeEtablissement.trim() || null;

  if (!nom && !code) return { medecinId: null, prestataireId: null };

  // ── Médecin ──────────────────────────────────────────────────────────
  // Priorité : code praticien exact → nom contient le premier mot → création
  let medecin = code ? await prisma.medecin.findFirst({ where: { codePraticien: code } }) : null;
  if (!medecin && nom) {
    medecin = await prisma.medecin.findFirst({
      where: { nom: { contains: nom.split(/\s+/)[0], mode: "insensitive" } },
    });
  }
  if (!medecin) {
    // Retirer le titre en tête du nom si ARIANA l'a inclus malgré la consigne
    // (ex. "Dr OBIANG Walter" → "OBIANG Walter" quand titrePrescripteur="Dr")
    const TITRES_RE = /^(Dr\.?|Pr\.?|Docteur|Professeur|D[Rr]\.?)\s+/i;
    const nomSansTitre = nom.replace(TITRES_RE, "").trim();
    const [nomSeul, ...restPrenom] = (nomSansTitre || "Prescripteur").split(/\s+/);
    const prenomSeul = restPrenom.join(" ") || null;
    medecin = await prisma.medecin.create({
      data: {
        nom: nomSeul, prenom: prenomSeul, codePraticien: code,
        titre: info.titrePrescripteur?.trim() || null,
        specialite: info.specialitePrescripteur?.trim() || null,
      },
    });

    // Compte medassur.cloud automatique pour tout nouveau médecin (2026-11)
    // Idempotent : si un compte existe déjà pour ce medecinId, on ne recrée pas.
    const compteExistant = await prisma.user.findFirst({ where: { medecinId: medecin.id }, select: { id: true } });
    if (!compteExistant && prenomSeul && nomSeul) {
      const baseEmail = `${slugifier(prenomSeul)}.${slugifier(nomSeul)}`;
      let email = `${baseEmail}@medassur.cloud`;
      for (let i = 2; i <= 99; i++) {
        const pris = await prisma.user.findFirst({ where: { email }, select: { id: true } });
        if (!pris) break;
        email = `${baseEmail}${i}@medassur.cloud`;
      }
      const mdp = genererMotDePasseTemporaire();
      await prisma.user.create({
        data: {
          nom: `${prenomSeul} ${nomSeul}`, email,
          initiales: `${prenomSeul[0]}${nomSeul[0]}`.toUpperCase(),
          passwordHash: await bcrypt.hash(mdp, 10),
          roleId: "medecin_prescripteur", medecinId: medecin.id,
          modules: ROLE_MODULES["medecin_prescripteur"],
          societeId: TenantContext.getSocieteId() ?? null,
          doitChangerMotDePasse: true,
        },
      });
    }
  } else {
    // Enrichir le code praticien et le titre s'ils étaient manquants
    const updates: Record<string, string | null> = {};
    if (code && !medecin.codePraticien) updates.codePraticien = code;
    if (info.titrePrescripteur?.trim() && !medecin.titre) updates.titre = info.titrePrescripteur.trim();
    if (info.specialitePrescripteur?.trim() && !medecin.specialite) updates.specialite = info.specialitePrescripteur.trim();
    if (Object.keys(updates).length)
      medecin = await prisma.medecin.update({ where: { id: medecin.id }, data: updates });
  }

  // ── Prestataire (structure médicale) ─────────────────────────────────
  // Priorité : code établissement exact → nom contient → création
  let prestataire: { id: string } | null = null;
  // Les 3 appels ci-dessous utilisent `as any` car codeEtablissement n'est
  // connu du client Prisma local qu'après `prisma generate` (bloqué par
  // EPERM Windows tant que le backend tourne) ; le VPS le génère en build.
  if (codeStructure) {
    prestataire = await (prisma.prestataire.findFirst as any)({ where: { codeEtablissement: codeStructure } });
  }
  if (!prestataire && nomStructure) {
    prestataire = await prisma.prestataire.findFirst({
      where: { nom: { contains: nomStructure, mode: "insensitive" } },
    });
    if (prestataire && codeStructure && !(prestataire as any).codeEtablissement) {
      await (prisma.prestataire.update as any)({ where: { id: prestataire.id }, data: { codeEtablissement: codeStructure } });
    }
  }
  if (!prestataire && nomStructure) {
    prestataire = await (prisma.prestataire.create as any)({
      data: { id: randomUUID(), nom: nomStructure, codeEtablissement: codeStructure },
    });
  }

  // ── Lien Médecin ↔ Prestataire ────────────────────────────────────────
  if (prestataire) {
    await prisma.medecinPrestataire.upsert({
      where: { medecinId_prestataireId: { medecinId: medecin.id, prestataireId: prestataire.id } },
      create: { medecinId: medecin.id, prestataireId: prestataire.id },
      update: {},
    });
  }

  return { medecinId: medecin.id, prestataireId: prestataire?.id ?? null };
}
