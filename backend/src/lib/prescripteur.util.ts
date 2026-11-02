import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface InfoPrescripteur {
  prescripteurNom: string;
  titrePrescripteur?: string;
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
    const [nomSeul, ...restPrenom] = (nom || "Prescripteur").split(/\s+/);
    medecin = await prisma.medecin.create({
      data: { nom: nomSeul, prenom: restPrenom.join(" ") || null, codePraticien: code, titre: info.titrePrescripteur?.trim() || null },
    });
  } else {
    // Enrichir le code praticien et le titre s'ils étaient manquants
    const updates: Record<string, string | null> = {};
    if (code && !medecin.codePraticien) updates.codePraticien = code;
    if (info.titrePrescripteur?.trim() && !medecin.titre) updates.titre = info.titrePrescripteur.trim();
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
