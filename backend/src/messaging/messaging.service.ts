import { Injectable, Logger } from "@nestjs/common";
import Zavudev from "@zavudev/sdk";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

// SMS + WhatsApp réels (2026-09) — voir demande utilisateur : "connecter
// l'application avec un vrai serveur de sms afin que les informations
// soient envoyées en réel sur les numéros des assurés et des prestataires.
// Mais aussi par whatsapp." Un seul fournisseur (Zavu, docs.zavu.dev) gère
// les deux canaux via le même appel — canal explicite ("sms"/"whatsapp")
// ou "auto" (Zavu route intelligemment, avec repli SMS si WhatsApp échoue,
// voir fallbackEnabled par défaut à true côté API). Numéro/clé absents ou
// mal formés (voir normaliserNumeroGabon) → échec silencieux journalisé,
// jamais bloquant pour le workflow métier appelant (une décision d'accord
// préalable, un règlement... doit aboutir même si l'envoi SMS échoue).
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private client: Zavudev | null = null;

  constructor(private parametresEntreprise: ParametresEntrepriseService) {}

  get actif(): boolean {
    return !!process.env.ZAVU_API_KEY;
  }

  private getClient(): Zavudev | null {
    const apiKey = process.env.ZAVU_API_KEY;
    if (!apiKey) return null;
    if (!this.client) this.client = new Zavudev({ apiKey });
    return this.client;
  }

  // Numéros saisis localement (2026-08, ex. "066123456" ou "06 12 34 56")
  // — Zavu exige le format E.164. Gabon = indicatif +241,8 chiffres locaux.
  // Un numéro déjà international (commence par "+") est laissé tel quel.
  private normaliserNumeroGabon(numero: string): string | null {
    const brut = numero.trim();
    if (brut.startsWith("+")) return brut.replace(/[\s.-]/g, "");
    const chiffres = brut.replace(/\D/g, "");
    if (chiffres.length === 8) return `+241${chiffres}`;
    if (chiffres.length === 9 && chiffres.startsWith("0")) return `+241${chiffres.slice(1)}`;
    return null;
  }

  // Signature par société (2026-09) — voir demande utilisateur : "si c'est
  // le client LA RUCHE EXCELLENCE, que ce soit signé au nom de LA RUCHE
  // EXCELLENCE. Si c'est un autre courtier, une compagnie, une mutuelle, il
  // faut que ce soit au nom de ce dernier." L'expéditeur technique Zavu
  // (numéro/compte réellement utilisé pour l'envoi) reste unique et partagé
  // par la plateforme — enregistrer un sender opérateur distinct par
  // société est un chantier télécom séparé (KYC par expéditeur) — mais le
  // TEXTE du message, lui, porte toujours le nom réel de la société
  // appelante (ParametresEntreprise.nom, résolu par TenantContext, jamais
  // codé en dur "MedAssur") : c'est ce que le destinataire lit et retient.
  // Centralisé ICI plutôt que dans chaque appelant pour que tout futur
  // point d'envoi hérite automatiquement de la bonne signature.
  private async signer(texte: string): Promise<string> {
    const p = await this.parametresEntreprise.findOne();
    return `${p.nom} : ${texte}`;
  }

  // Exposé publiquement (2026-09) — voir PrestatairesService.
  // envoyerIdentifiants : `envoyer()` ci-dessous ne lève JAMAIS d'exception
  // (best-effort volontaire pour ses appelants historiques, voir en-tête du
  // fichier), donc un appelant qui doit RÉELLEMENT savoir si un envoi a une
  // chance d'aboutir (pour l'afficher à l'écran, ex. "identifiants envoyés
  // par SMS") ne peut pas se fier à la résolution de la promesse — il doit
  // valider le numéro AVANT d'appeler envoyer().
  numeroValide(numero: string | null | undefined): boolean {
    return !!numero && this.normaliserNumeroGabon(numero) !== null;
  }

  // canal "auto" par défaut (2026-09) — Zavu tente WhatsApp puis retombe
  // sur SMS automatiquement (fallbackEnabled), le choix le plus fiable pour
  // joindre réellement le destinataire sans configuration par appelant.
  async envoyer(numero: string | null | undefined, texte: string, canal: "auto" | "sms" | "whatsapp" = "auto"): Promise<void> {
    if (!numero) return;
    const client = this.getClient();
    if (!client) {
      this.logger.debug("ZAVU_API_KEY non configurée — envoi SMS/WhatsApp ignoré.");
      return;
    }
    const to = this.normaliserNumeroGabon(numero);
    if (!to) {
      this.logger.warn(`Numéro invalide, envoi ignoré : "${numero}"`);
      return;
    }
    const senderId = process.env.ZAVU_SENDER_ID;
    try {
      const texteSigne = await this.signer(texte);
      await client.messages.send({ to, text: texteSigne, channel: canal, ...(senderId ? { "Zavu-Sender": senderId } : {}) });
    } catch (err) {
      // Jamais bloquant pour le workflow appelant (voir en-tête du fichier).
      this.logger.error(`Échec envoi message à ${to}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
