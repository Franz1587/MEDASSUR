import * as bcrypt from "bcryptjs";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MessagingService } from "../messaging/messaging.service";
import { GenererComptesMobileDto } from "./dto/generer-comptes-mobile.dto";
import { construireMessageAcces } from "./envoi.util";
import { ROLE_MODULES } from "../auth/role-modules";

// Alphabet sans caractères ambigus (0/O, 1/l/I) — un mot de passe temporaire
// doit rester lisible/retapable depuis un SMS.
const ALPHABET_MOT_DE_PASSE = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function genererMotDePasseTemporaire(longueur = 9): string {
  let mdp = "";
  for (let i = 0; i < longueur; i++) {
    mdp += ALPHABET_MOT_DE_PASSE[Math.floor(Math.random() * ALPHABET_MOT_DE_PASSE.length)];
  }
  return mdp;
}

// Canal demandé côté écran ("WhatsApp+SMS" par défaut) → canal Zavu réel
// (voir MessagingService.envoyer) : "auto" fait tenter WhatsApp puis
// retombe sur SMS automatiquement (fallbackEnabled côté Zavu), donc c'est
// la bonne correspondance pour "WhatsApp+SMS" ET pour le cas où l'agent
// n'a pas d'avis tranché.
function canalZavu(canal: "WhatsApp" | "SMS" | "WhatsApp+SMS"): "auto" | "sms" | "whatsapp" {
  if (canal === "SMS") return "sms";
  if (canal === "WhatsApp") return "whatsapp";
  return "auto";
}

export interface ResultatGenerationCompte {
  assureId: string;
  nom: string;
  matricule: string;
  identifiant: string;
  telephone: string | null;
  canal: string;
  statutEnvoi: string;
  messageSimule: string;
}

// Génération des accès au portail assuré (2026-08, refonte) — crée
// désormais un VRAI compte User connectable (roleId: assure_principal,
// User.assureSanteId, voir schema.prisma), au lieu de la table
// CompteAssureMobile d'origine qui ne branchait jamais rien de connectable.
// Toujours réservée aux assurés PRINCIPAUX actifs (voir
// GenerationComptesMobileModal.tsx côté frontend, qui ne propose que
// ceux-là ; revalidé ici côté serveur, seule source de vérité). Un assuré
// qui a déjà un compte se voit juste régénérer son mot de passe (perte de
// mot de passe).
//
// Envoi réel (2026-09) — voir demande utilisateur : un compte créé pour un
// vrai assuré de LA RUCHE EXCELLENCE n'a jamais reçu ses identifiants par
// SMS, parce que ce flux ne branchait encore que `simulerEnvoi()` (texte
// affiché à l'écran pour relais manuel — voir historique d'envoi.util.ts),
// alors que MessagingService (Zavu, SMS/WhatsApp réels) existe et est déjà
// utilisé ailleurs (décisions de prise en charge, prescriptions...) depuis
// cette même session. Branché ici pour de vrai : le texte reste quand même
// affiché/copiable à l'écran (utile en cas de numéro absent/invalide, ou
// pour double vérification), mais part désormais réellement par SMS/WhatsApp
// quand le numéro est valide et Zavu configuré.
@Injectable()
export class ComptesMobileService {
  constructor(private prisma: PrismaService, private messaging: MessagingService) {}

  async generer(dto: GenererComptesMobileDto): Promise<ResultatGenerationCompte[]> {
    const candidats = await this.prisma.assureSante.findMany({
      where: { id: { in: dto.assureIds }, contratId: dto.contratId, typeAssure: "AS", statut: "Actif" },
      include: { compteUtilisateur: true },
    });

    const resultats: ResultatGenerationCompte[] = [];
    for (const a of candidats) {
      const motDePasse = genererMotDePasseTemporaire();
      const motDePasseHash = await bcrypt.hash(motDePasse, 10);
      const messageBase = construireMessageAcces(a.matricule, motDePasse);

      if (a.compteUtilisateur) {
        await this.prisma.user.update({ where: { id: a.compteUtilisateur.id }, data: { passwordHash: motDePasseHash, doitChangerMotDePasse: true } });
      } else {
        const identifiant = `${a.matricule}-${a.id.slice(-6)}@assure.medassur.local`;
        await this.prisma.user.create({
          data: {
            nom: `${a.nom} ${a.prenom ?? ""}`.trim(),
            email: identifiant,
            initiales: `${a.nom[0] ?? ""}${a.prenom?.[0] ?? ""}`.toUpperCase(),
            passwordHash: motDePasseHash,
            roleId: "assure_principal",
            modules: ROLE_MODULES.assure_principal,
            assureSanteId: a.id,
            doitChangerMotDePasse: true,
          },
        });
      }

      let statutEnvoi: string;
      if (!this.messaging.numeroValide(a.telephone)) {
        statutEnvoi = "Numéro invalide ou manquant — relais manuel requis";
      } else if (!this.messaging.actif) {
        statutEnvoi = "Fournisseur SMS non configuré — relais manuel requis";
      } else {
        await this.messaging.envoyer(a.telephone, messageBase, canalZavu(dto.canal));
        statutEnvoi = "Envoyé";
      }

      const message = `${messageBase}\nPortail : /portal/membre`;
      resultats.push({
        assureId: a.id, nom: `${a.nom} ${a.prenom ?? ""}`.trim(), matricule: a.matricule, identifiant: a.matricule,
        telephone: a.telephone, canal: dto.canal, statutEnvoi, messageSimule: message,
      });
    }
    return resultats;
  }
}
