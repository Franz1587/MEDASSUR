import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";
import { ChatDto } from "./dto/chat.dto";

// Assistant IA interne (2026-09) — voir demande utilisateur : "je vois des
// données codées en dur ou des mockdata dans l'écran de LA RUCHE EXCELLENCE...
// les données doivent être uniquement celles de LA RUCHE, réelles." L'écran
// "CIS IA" (src/features/ia) répondait jusqu'ici TOUJOURS le même texte
// (ratio sinistres/primes, contrats à échéance...) codé en dur dans
// src/data/mock/ia.mock.ts, identique pour n'importe quelle société —
// exactement le symptôme signalé. Remplacé par un vrai appel Claude (même
// SDK/clé que MessagerieAgentIaService), mais SANS accès outillé à la base
// (contrairement à l'agent de messagerie, qui a de vrais tools Prisma) :
// le system prompt interdit donc explicitement d'inventer un chiffre précis
// non fourni — l'assistant redirige vers les vrais écrans (Statistiques,
// Comptabilité, Rapports) pour toute donnée chiffrée qu'il ne peut pas
// vérifier, plutôt que de fabriquer une réponse plausible mais fausse.
@Injectable()
export class IaAssistantService {
  private readonly logger = new Logger(IaAssistantService.name);
  private client: Anthropic | null = null;

  constructor(private parametresEntreprise: ParametresEntrepriseService) {}

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  async chat(dto: ChatDto): Promise<{ reponse: string }> {
    const client = this.getClient();
    if (!client) {
      throw new ServiceUnavailableException("Assistant IA indisponible pour le moment (clé non configurée).");
    }

    const p = await this.parametresEntreprise.findOne();
    const systemPrompt = `Tu es l'assistant IA interne de l'application MedAssur, pour la société "${p.nom}" (courtier/mutuelle/compagnie d'assurance santé au Gabon). Tu aides les gestionnaires internes (production, sinistres, comptabilité, direction) dans leur travail quotidien : rédaction de courriers, explication de garanties, aide à l'analyse de dossiers, conseils métier assurance santé (réglementation CIMA, bonnes pratiques de gestion).

RÈGLE ABSOLUE : tu n'as PAS d'accès direct à la base de données de "${p.nom}" dans cette conversation — tu ne connais AUCUN chiffre réel (nombre de contrats, ratio sinistres/primes, montants, échéances, effectifs...). N'invente JAMAIS un chiffre, un pourcentage, une date ou un nom de client précis : si la question porte sur une donnée chiffrée réelle, réponds que tu n'y as pas accès depuis ce chat et oriente vers le bon écran de l'application (Statistiques, Comptabilité, Rapports, Contrats...) où cette donnée est disponible en temps réel. Tu peux en revanche aider librement sur tout ce qui ne nécessite pas de données réelles : méthodologie, rédaction, explications, conseils.

Réponds en français, de façon concise et professionnelle.`;

    const messages: Anthropic.MessageParam[] = [
      ...(dto.historique ?? []).map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
      { role: "user", content: dto.message },
    ];

    try {
      const res = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });
      const texte = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
      return { reponse: texte || "Je n'ai pas pu formuler de réponse — reformulez votre question." };
    } catch (err) {
      this.logger.error("Erreur appel Claude (assistant IA)", err instanceof Error ? err.stack : String(err));
      throw new ServiceUnavailableException("Assistant IA temporairement indisponible, réessayez dans un instant.");
    }
  }
}
