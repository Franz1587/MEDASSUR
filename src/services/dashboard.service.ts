import { http } from "@/lib/http";
import { openDocument } from "@/services/documents.service";
import type { PilotageAssurance } from "@/types/dashboard";

// Tableau de bord "Pilotage Assurance" (2026-08) — voir demande
// utilisateur : "le tableau de bord ne doit pas être codé en dur mais
// interactif et réel." Remplace l'ancien service qui ne faisait que
// renvoyer src/data/mock/dashboard.mock.ts sans jamais appeler le backend.
export function getPilotageAssurance(annee?: number): Promise<PilotageAssurance> {
  return http.get<PilotageAssurance>(`/dashboard/pilotage${annee ? `?annee=${annee}` : ""}`);
}

// "Rapport PDF" (2026-08) — génère un vrai document (voir
// DashboardService.genererRapportPdf), ouvert dans la visionneuse intégrée
// (impression/téléchargement déjà proposés par la visionneuse).
export function openRapportPilotage(annee?: number): Promise<void> {
  return openDocument(`/dashboard/pilotage/rapport${annee ? `?annee=${annee}` : ""}`);
}
