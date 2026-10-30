import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";

// Lecture automatique GED (2026-09, reprise du chantier "en pause") — voir
// demande utilisateur d'origine : "mode OCR grâce à l'agent IA...
// enregistrement automatique du document avec un résumé et en créant
// l'objet en lisant le contenu... suivi et comparaison des factures
// enregistrées par la GED et celles traitées et saisies". Même principe que
// PrescriptionsService.suggererPosologie/AgentIaService (vision native de
// Claude, pas de bibliothèque OCR séparée) — jamais bloquant : renvoie un
// résultat "Échec" plutôt que de faire planter l'import si la clé API est
// absente ou le format illisible.
const MEDIA_TYPES_IMAGE: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

// Rubriques alignées sur le besoin d'origine (factures/courriers
// prestataires en priorité) — "Autre" en repli pour tout document qui ne
// rentre dans aucune des catégories métier suivies.
export const TYPES_GED = ["Facture prestataire", "Courrier", "Contrat", "Avenant", "Pièce d'identité", "Autre"] as const;

export interface AnalyseGedResultat {
  statutOcr: "Analysé" | "Échec";
  type: string | null;
  objet: string | null;
  resume: string | null;
  referenceExtraite: string | null;
  montantExtrait: number | null;
  dateCachet: string | null;
  nomEmetteurExtrait: string | null;
}

const RESULTAT_ECHEC: AnalyseGedResultat = {
  statutOcr: "Échec", type: null, objet: null, resume: null,
  referenceExtraite: null, montantExtrait: null, dateCachet: null, nomEmetteurExtrait: null,
};

@Injectable()
export class GedAnalyseService {
  private readonly logger = new Logger(GedAnalyseService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  private blocVision(buffer: Buffer, nomFichier: string): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam | null {
    const ext = nomFichier.slice(nomFichier.lastIndexOf(".")).toLowerCase();
    const mediaTypeImage = MEDIA_TYPES_IMAGE[ext];
    if (mediaTypeImage) {
      return { type: "image", source: { type: "base64", media_type: mediaTypeImage, data: buffer.toString("base64") } };
    }
    if (ext === ".pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } };
    }
    return null;
  }

  // Lecture réelle du contenu (2026-09) — jamais de valeur devinée si l'IA
  // n'a pas pu lire le fichier (voir demande utilisateur, schema.prisma
  // GedDocument.objet/resume) : `statutOcr: "Échec"` avec tous les champs
  // extraits à `null` dans ce cas, jamais un résultat fabriqué.
  // `contexte.prestatairesConnus` : liste des prestataires déjà en base —
  // ARIANA s'en sert pour résoudre le nom exact quand l'OCR est approximatif.
  async analyser(
    buffer: Buffer,
    nomFichier: string,
    contexte?: { prestatairesConnus?: { id: string; nom: string }[] },
  ): Promise<AnalyseGedResultat> {
    const bloc = this.blocVision(buffer, nomFichier);
    if (!bloc) return RESULTAT_ECHEC;

    const client = this.getClient();
    if (!client) return RESULTAT_ECHEC;

    const listePrestataires = contexte?.prestatairesConnus?.length
      ? `\nPrestataires médicaux enregistrés dans la base : ${contexte.prestatairesConnus.map((p) => p.nom).join(" | ")}. ` +
        "Si le nom de l'émetteur sur le document correspond (même approximativement) à l'un de ces noms, " +
        "renvoie EXACTEMENT le nom tel qu'il apparaît dans cette liste."
      : "";

    try {
      const reponse = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        thinking: { type: "disabled" },
        system:
          "Tu es ARIANA, l'agent d'analyse documentaire IA de MEDASSUR+, un assureur santé gabonais. " +
          "Lis VRAIMENT le contenu du fichier joint (facture, courrier, contrat…) et réponds UNIQUEMENT " +
          "avec un objet JSON strict, sans texte autour, sans balise markdown, au format exact suivant :\n" +
          `{"type": "<une valeur EXACTE parmi ${TYPES_GED.map((t) => `\\"${t}\\"`).join(", ")}>", ` +
          "\"objet\": \"<objet court du document, une ligne>\", " +
          "\"resume\": \"<résumé factuel en 2-4 phrases : nature du document, montants clés, parties impliquées>\", " +
          "\"referenceFacture\": <le numéro de facture/référence EXACT écrit sur le document si le type est " +
          "\"Facture prestataire\", sinon null>, " +
          "\"montant\": <le montant total TTC écrit sur le document si le type est \"Facture prestataire\", " +
          "en chiffres uniquement sans devise ni séparateur, sinon null>, " +
          "\"dateCachet\": <la date lue sur le cachet, tampon ou mention \"Courrier arrivé\" / \"Reçu le\" / " +
          "\"Arrivée le\" visible sur le document, au format JJ/MM/AAAA, sinon null>, " +
          "\"nomEmetteur\": <le nom de l'établissement médical (clinique, hôpital, cabinet, pharmacie…) " +
          "qui FACTURE ou SOUMET ce document — c'est-à-dire le prestataire de soins qui réclame le paiement. " +
          "Pour un relevé de facturation ou de règlement, cherche dans le CORPS DU TEXTE (pas l'en-tête " +
          "seule) les mentions explicites : 'Prestataire :', 'Établissement :', 'Structure :', " +
          "'factures de [NOM]', ou la phrase décrivant l'émetteur réel des soins. " +
          "Si l'en-tête et le corps désignent des entités différentes, PRIORITÉ au corps (la structure qui soigne). " +
          "Null si aucune structure médicale identifiable.>}\n" +
          listePrestataires +
          "\nSi le document est flou, coupé ou réellement illisible, réponds quand même le JSON avec objet/resume " +
          "expliquant que le contenu n'est pas lisible, jamais d'invention de contenu absent.",
        messages: [{ role: "user", content: [bloc, { type: "text", text: "Lis ce document et renvoie le JSON demandé." }] }],
      });
      const blocTexte = reponse.content.find((b) => b.type === "text");
      const texte = blocTexte && blocTexte.type === "text" ? blocTexte.text.trim() : "";
      const json = texte.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(json) as {
        type?: string; objet?: string; resume?: string;
        referenceFacture?: string | null; montant?: number | string | null;
        dateCachet?: string | null; nomEmetteur?: string | null;
      };
      const montant = parsed.montant != null && parsed.montant !== "" ? Number(parsed.montant) : null;
      return {
        statutOcr: "Analysé",
        type: parsed.type && (TYPES_GED as readonly string[]).includes(parsed.type) ? parsed.type : "Autre",
        objet: parsed.objet?.trim() || null,
        resume: parsed.resume?.trim() || null,
        referenceExtraite: parsed.referenceFacture?.trim() || null,
        montantExtrait: montant != null && !Number.isNaN(montant) ? montant : null,
        dateCachet: parsed.dateCachet?.trim() || null,
        nomEmetteurExtrait: parsed.nomEmetteur?.trim() || null,
      };
    } catch (err) {
      this.logger.warn(`Lecture GED de "${nomFichier}" échouée : ${err instanceof Error ? err.message : err}`);
      return RESULTAT_ECHEC;
    }
  }
}
