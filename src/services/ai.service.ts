import { http } from "@/lib/http";
import { getLettrageClients, getLettrageFournisseurs } from "@/services/lettrage.service";
import { fmt } from "@/lib/format";
import type { LettrageClient, LettrageFournisseur } from "@/types/lettrage";

// Message d'accueil / suggestions (2026-09) — simple texte d'interface
// (aucune donnée métier), contrairement à l'ancienne réponse par défaut du
// chat (voir chatAssistant ci-dessous) qui affichait des CHIFFRES fabriqués
// ("ratio sinistres/primes <65%"...) identiques pour toute société — voir
// demande utilisateur : "les données qui soient là uniquement celles de
// LA RUCHE... réelles". Ce texte-ci reste générique par nature (un accueil),
// rien à brancher sur une API.
const IA_WELCOME_MESSAGE =
  "Bonjour ! Je suis l'assistant IA de MedAssur. Je peux vous aider à rédiger des courriers, expliquer des garanties, répondre à des questions de gestion santé/CIMA, ou faire le lettrage d'un compte. Comment puis-je vous aider ?";

const IA_SUGGESTIONS = [
  "Rédiger un courrier de relance impayé",
  "Vérifier la conformité CIMA d'une garantie",
  "Faire le lettrage de mes comptes clients",
  "Expliquer une clause de garantie à un assuré",
];

export function getIaWelcomeMessage(): string {
  return IA_WELCOME_MESSAGE;
}

export function getIaSuggestions(): string[] {
  return IA_SUGGESTIONS;
}

// Sans accents/ponctuation/casse, pour une détection d'intention robuste
// aux fautes de frappe usuelles.
function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function resumerCompte(nom: string, r: { soldeNonLettre: number; lettrageComplet: boolean; mouvements: { montant: number; lettre: string | null }[] }): string {
  if (r.lettrageComplet) return `**${nom}** — compte soldé, tout est lettré.`;
  const ouverts = r.mouvements.filter((m) => m.lettre === null);
  const detail = ouverts
    .slice(0, 6)
    .map((m) => `  • ${m.montant > 0 ? "Débit" : "Crédit"} ${fmt(Math.abs(m.montant))}`)
    .join("\n");
  return `**${nom}** — solde non lettré : ${fmt(r.soldeNonLettre)} (${ouverts.length} mouvement${ouverts.length > 1 ? "s" : ""} ouvert${ouverts.length > 1 ? "s" : ""})\n${detail}`;
}

function resumerListe<T extends { soldeNonLettre: number; lettrageComplet: boolean }>(
  libelleType: string, donnees: T[], getNom: (t: T) => string,
): string {
  if (donnees.length === 0) return `Aucun compte ${libelleType} à lettrer pour l'instant.`;
  const ouverts = donnees.filter((d) => !d.lettrageComplet).sort((a, b) => Math.abs(b.soldeNonLettre) - Math.abs(a.soldeNonLettre));
  const soldes = donnees.filter((d) => d.lettrageComplet);
  const total = donnees.reduce((s, d) => s + Math.abs(d.soldeNonLettre), 0);
  const entete = `Lettrage des comptes ${libelleType} : ${soldes.length}/${donnees.length} soldés, ${ouverts.length} avec un solde ouvert (total non lettré : ${fmt(total)}).`;
  if (ouverts.length === 0) return entete;
  const top = ouverts.slice(0, 5).map((d) => `  • ${getNom(d)} — ${fmt(d.soldeNonLettre)}`).join("\n");
  return `${entete}\n\nComptes les plus concernés :\n${top}${ouverts.length > 5 ? `\n  … et ${ouverts.length - 5} autre(s).` : ""}`;
}

// Lettrage de compte via l'Assistant IA (2026-09) — voir demande
// utilisateur : "il faut que l'outil IA puisse également faire un vrai
// lettrage de compte" + "Les deux" (écran dédié ET chat IA). Réutilise les
// MÊMES routes/moteur que l'écran Comptabilité (src/features/comptabilite),
// jamais une logique dupliquée. Seule cette intention est branchée sur des
// données réelles ; les autres capacités de l'assistant restent simulées
// (hors périmètre de cette demande).
async function tenterLettrage(message: string): Promise<string | null> {
  const m = normaliser(message);
  const evoqueLettrage = /lettrage|lettrer|lettre[ -]?(un|le|mon|ce)?\s*compte/.test(m);
  if (!evoqueLettrage) return null;

  const evoqueClient = /client|souscripteur|assure/.test(m);
  const evoqueFournisseur = /fournisseur|prestataire|clinique|hopital|pharmacie|laboratoire/.test(m);

  const [clients, fournisseurs] = await Promise.all([
    !evoqueFournisseur || evoqueClient ? getLettrageClients() : Promise.resolve<LettrageClient[]>([]),
    !evoqueClient || evoqueFournisseur ? getLettrageFournisseurs() : Promise.resolve<LettrageFournisseur[]>([]),
  ]);

  // Un nom précis est mentionné ? Réponse détaillée pour ce seul compte.
  const clientCible = clients.find((c) => m.includes(normaliser(c.clientNom)));
  if (clientCible) return resumerCompte(clientCible.clientNom, clientCible);
  const fournisseurCible = fournisseurs.find((f) => m.includes(normaliser(f.prestataireNom)));
  if (fournisseurCible) return resumerCompte(fournisseurCible.prestataireNom, fournisseurCible);

  // Sinon, une synthèse — clients, fournisseurs, ou les deux selon la
  // formulation de la question.
  const parties: string[] = [];
  if (clients.length > 0 || !evoqueFournisseur) parties.push(resumerListe("clients", clients, (c) => c.clientNom));
  if (fournisseurs.length > 0 || !evoqueClient) parties.push(resumerListe("fournisseurs", fournisseurs, (f) => f.prestataireNom));
  return parties.join("\n\n");
}

// historique (2026-09) — messages précédents de LA conversation en cours
// (jamais persistés côté serveur ici, juste renvoyés à chaque appel pour
// que Claude garde le contexte) — voir IaAssistantService.chat côté
// backend : aucun accès outillé à la base, chiffres précis explicitement
// interdits par le system prompt plutôt que fabriqués.
export async function chatAssistant(message: string, historique: { role: "user" | "assistant"; content: string }[] = []): Promise<string> {
  const reponseLettrage = await tenterLettrage(message).catch(() => null);
  if (reponseLettrage) return reponseLettrage;
  const { reponse } = await http.post<{ reponse: string }>("/ia-assistant/chat", { message, historique });
  return reponse;
}

