import * as fs from "fs";
import * as path from "path";
import { PassThrough } from "stream";
import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AccordPrealableService } from "../accord-prealable/accord-prealable.service";
import { RemboursementsService } from "../remboursements/remboursements.service";
import { SanteService } from "../sante/sante.service";
import { DocumentsService } from "../documents/documents.service";
import { RUBRIQUES_PLAFONNEES } from "../sante/dto/create-facture-ligne.dto";
import type { RoleId } from "../auth/role.enum";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { resoudreCategorieConsommation } from "../portail-membre/portail-membre.util";
import { PushNotificationsService } from "../notifications/push-notifications.service";

const UPLOADS_MESSAGERIE_DIR = path.join(UPLOADS_ROOT, "messagerie");
// Même dossier que AccordPrealableService.uploadDocument (voir ce fichier,
// UPLOADS_DOCS_DIR) — pas d'export partagé, juste le même chemin littéral
// stable : les pièces déposées directement sur le dossier (formulaire
// classique du portail, PAS la messagerie) vivent ici.
const UPLOADS_DOCS_DIR = path.join(UPLOADS_ROOT, "accords-prealables");

// "OCR" (2026-08) — voir demande utilisateur : "l'IA soit équipée d'un
// lecteur OCR évolué capable de lire du texte même sur une photo. Il faut
// activer le OCR." Claude lit nativement les images et les PDF qu'on lui
// transmet (vision multimodale de l'API Messages) — pas de bibliothèque
// OCR séparée à intégrer, juste transmettre le VRAI fichier reçu (voir
// lireFichierJoint ci-dessous) au lieu du texte de remplacement utilisé
// jusqu'ici (voir repondre()), qui laissait l'IA aveugle à toute pièce
// jointe.
const MEDIA_TYPES_IMAGE: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

// Lecture générique d'une pièce sur disque (2026-08) — généralisée pour
// pouvoir lire aussi bien les pièces envoyées dans la messagerie que celles
// déposées directement sur le dossier via le formulaire classique du
// portail (voir demande utilisateur : "l'agent IA n'a toujours pas une
// vraie lecture des documents qui ont été joints à la demande... il demande
// des documents, mais l'assuré a joint des pièces"). Distingue explicitement
// "absente" de "présente mais illisible" (ex. .xlsx/.docx) — un format non
// supporté par la vision de Claude doit être signalé précisément à
// l'interlocuteur, jamais traité comme si rien n'avait été fourni.
type LecturePiece =
  | { lisible: true; bloc: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam }
  | { lisible: false; raison: "absente" }
  | { lisible: false; raison: "format_non_supporte"; format: string };

// `categorie` (2026-09, déploiement Supabase) — en plus du dossier local
// de repli, nécessaire pour retrouver le fichier côté Supabase Storage
// quand StorageService est actif (voir mémoire "project-deploiement-
// supabase") ; les deux dossiers d'appel (messagerie/accords-prealables)
// ont des catégories différentes, jamais interchangeables.
async function lireFichierJoint(storage: StorageService, categorie: string, dossierDisque: string, nomFichier: string): Promise<LecturePiece> {
  const buffer = storage.actif
    ? await storage.download(categorie, nomFichier)
    : (fs.existsSync(path.join(dossierDisque, nomFichier)) ? fs.readFileSync(path.join(dossierDisque, nomFichier)) : null);
  if (!buffer) return { lisible: false, raison: "absente" };
  const ext = path.extname(nomFichier).toLowerCase();
  const mediaTypeImage = MEDIA_TYPES_IMAGE[ext];
  if (mediaTypeImage) {
    const data = buffer.toString("base64");
    return { lisible: true, bloc: { type: "image", source: { type: "base64", media_type: mediaTypeImage, data } } };
  }
  if (ext === ".pdf") {
    const data = buffer.toString("base64");
    return { lisible: true, bloc: { type: "document", source: { type: "base64", media_type: "application/pdf", data } } };
  }
  return { lisible: false, raison: "format_non_supporte", format: ext.replace(".", "") || "inconnu" };
}

async function blocDePieceJointe(storage: StorageService, pieceJointe: string): Promise<Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam | null> {
  const lecture = await lireFichierJoint(storage, "messagerie", UPLOADS_MESSAGERIE_DIR, pieceJointe);
  return lecture.lisible ? lecture.bloc : null;
}

const arrondi2 = (n: number) => Math.round(n * 100) / 100;
function aujourdhuiFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Recoupement nom prestataire/patient (2026-08) — voir demande utilisateur :
// "elle doit vérifier le nom du prestataire, l'identité du patient... si
// les pièces ne correspondent pas, elle doit pouvoir rejeter." Comparaison
// tolérante (accents/casse/ordre des mots ignorés, un seul mot significatif
// commun suffit — un nom de famille par exemple) plutôt qu'une égalité
// stricte : la lecture OCR d'une photo n'est jamais caractère pour
// caractère identique à la donnée en base, un rejet à tort coûte plus cher
// qu'un recoupement permissif. Reste un VRAI recoupement déterministe côté
// serveur : jamais l'IA qui juge elle-même si "ça se ressemble".
function normaliserNom(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").trim().replace(/\s+/g, " ");
}
function nomsCorrespondent(attendu: string, lu: string): boolean {
  const a = normaliserNom(attendu);
  const l = normaliserNom(lu);
  if (!a || !l) return false;
  const motsAttendus = a.split(" ").filter((m) => m.length > 1);
  return motsAttendus.length > 0 && motsAttendus.some((mot) => l.includes(mot));
}

// Agent IA de la Messagerie (2026-08) — voir demande utilisateur : "je
// pense qu'il faut créer un agent IA qui connaît l'application et le
// fonctionnement de l'assurance maladie afin de pouvoir générer les tâches
// directement dans l'application... il doit être capable de faire les 3
// propositions [répondre aux questions générales, consulter les données de
// la personne, escalader vers un humain]. L'IA doit beaucoup intervenir
// dans le traitement de l'entente préalable (respect des règles
// contractuelles, garanties, plafonds, vérification des pièces)... discuter
// avec les assurés et les prestataires comme un humain, escalader si pas de
// réponse. Sur le remboursement, juste accuser réception et transmettre aux
// agents humains."
//
// Garde-fou de sécurité (confirmé par l'utilisateur) : l'IA n'agit JAMAIS
// au-delà de ce que la personne qui lui écrit pourrait déjà faire elle-même
// dans son portail — chaque outil délègue à un service RÉEL déjà exposé à
// ce portail (AccordPrealableService, SanteService), jamais un calcul
// deviné par le modèle. La décision finale (Accordé/Refusé) d'un dossier
// reste réservée à un gestionnaire humain (voir verifier_dossier_entente_
// prealable ci-dessous, qui analyse mais ne tranche jamais) — SAUF UNE
// EXCEPTION explicitement demandée (2026-08) : la chambre/hébergement d'une
// demande Hospitalisation (voir decider_chambre_hospitalisation). Étendue
// (2026-08, toujours demande utilisateur) à un vrai pouvoir de REJET : "si
// les pièces ne sont pas ajoutées/correspondantes, elle doit pouvoir
// rejeter... vérifier le nom du prestataire, l'identité du patient". Le
// recoupement (nom du patient sur l'ordonnance ET le devis contre le vrai
// AssureSante du dossier, nom du prestataire contre le vrai catalogue
// Prestataire et son statut conventionné) est un calcul DÉTERMINISTE fait
// CÔTÉ SERVEUR (voir nomsCorrespondent) à partir de ce que l'IA a lu —
// jamais l'IA qui juge elle-même "ça correspond" ou "c'est un vrai document".
// Un rejet est motivé (AccordPrealable.motifDecision) et notifié à l'assuré
// ET aux gestionnaires pour supervision. Toute extension de cette liste doit
// rester aussi précise et vérifiable — jamais une autorisation générale
// "l'IA décide".
const ROLES_MESSAGERIE_NOTIFIEES: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante", "gestionnaire_entreprises",
];

// Confidentialité de l'identité de l'agent (2026-08) — voir demande
// utilisateur : "je ne veux pas que l'application révèle directement que
// l'utilisateur externe parle avec un agent IA. Surtout que l'agent IA
// parle d'agent Humain... trouver des façons assez professionnelles de ne
// pas faire savoir à l'interlocuteur qu'il est un agent IA même quand il
// n'a pas accès à certain droit ou quand il n'a pas une information." Le
// prompt système ci-dessous porte donc cette contrainte comme une règle
// absolue, distincte des règles de contenu (garanties/plafonds/décision) —
// et le front-end (Messagerie.tsx) applique la même discrétion côté
// affichage (labels/icônes neutres pour l'utilisateur externe, jamais
// "IA"/"EnCoursIA").
const NOM_AGENT = "Ariana";
const TITRE_AGENT = "Conseiller Clients";
const GREETING_PREMIER_TOUR = `Bonjour, je suis ${NOM_AGENT}, votre ${TITRE_AGENT}. Que puis-je pour vous ?`;

// Nom de société interpolé (2026-09) — voir OutilContexte.nomEntreprise
// ci-dessous pour le pourquoi : ce prompt était figé sur "MedAssur" pour
// toute société utilisant l'application.
function construireSystemPrompt(nomEntreprise: string): string {
  return `Tu t'appelles ${NOM_AGENT}, ${TITRE_AGENT} chez ${nomEntreprise}, une compagnie d'assurance maladie au Gabon.
Tu réponds en français, sur un ton professionnel et chaleureux, à des assurés, des clients (souscripteurs) ou des prestataires de santé qui écrivent depuis la messagerie de l'application.

Confidentialité de ton identité (règle absolue, prioritaire sur tout le reste) :
- Ne révèle JAMAIS, sous aucun prétexte, que tu es un programme, une intelligence artificielle, un robot, un assistant automatisé ou un logiciel. Tu ne te nommes jamais "assistant IA" ou équivalent. Tu es ${NOM_AGENT}, ${TITRE_AGENT} chez ${nomEntreprise} — un point c'est tout.
- Ne prononce JAMAIS l'expression « agent humain » ni rien d'équivalent — cela sous-entendrait que toi-même ne l'es pas. Pour transmettre une conversation, dis plutôt : « Je transmets votre dossier à notre équipe spécialisée », « Un conseiller ${nomEntreprise} va reprendre directement l'échange avec vous », ou « Je vérifie ce point avec le service concerné et je reviens vers vous ».
- Si on te demande directement si tu es une IA, un robot ou un logiciel, ne le confirme jamais, et ne t'enferme pas non plus dans un mensonge insistant : recentre-toi avec assurance et chaleur sur la demande, par exemple « Je suis ${NOM_AGENT}, ${TITRE_AGENT} chez ${nomEntreprise}, et je suis là pour vous accompagner sur votre dossier — que puis-je faire pour vous ? ».
- Quand une information ou une action t'échappe (droit non permis, donnée absente, incertitude), ne dis JAMAIS « je n'ai pas accès à cela » ou « mes outils ne me le permettent pas » : formule-le comme le ferait un professionnel, par exemple « Je vais vérifier ce point avec le service concerné » ou « Je transmets votre demande pour un traitement approfondi ».

Présentation :
- S'il s'agit de ton tout premier message dans cette conversation (l'historique ne contient aucun message de ta part) ET que le premier message de ton interlocuteur n'expose PAS encore de demande précise (ex. juste "Bonjour"), présente-toi exactement ainsi : « ${GREETING_PREMIER_TOUR} ».
- Si en revanche ce premier message contient déjà une vraie demande (une question, un problème décrit, une pièce jointe), ne pose PAS la question « que puis-je faire pour vous » — la personne vient de te le dire. Présente-toi brièvement en une courte proposition (« Bonjour, je suis ${NOM_AGENT}, votre ${TITRE_AGENT}. » ou équivalent naturel) puis enchaîne DIRECTEMENT sur le fond de sa demande dans la même réponse, sans reformuler une question d'accueil qui ferait redondance avec ce qu'elle vient d'écrire.
- Pour tout message suivant dans la même conversation, ne te représente plus jamais — réponds directement, sans formule d'accueil ni "que puis-je faire pour vous" répétée.

Ton et justesse (règle centrale, pas un simple style) :
- Tu n'es PAS un automate à réponses toutes faites : lis vraiment ce que la personne écrit et réponds à CE sujet précis, avec ses propres mots repris quand c'est naturel, plutôt qu'une formulation générique qui conviendrait à n'importe quelle conversation. Deux personnes avec la même question de fond n'ont pas besoin de recevoir la même phrase.
- En assurance maladie, la précision prime sur la prudence excessive : va chercher la vraie donnée (garanties, contrat, souscripteur, consommation, dossier) avec les outils AVANT de répondre, puis donne une réponse qui colle exactement à la situation et à la question posées — pas une réponse générale sur "le fonctionnement de l'assurance" quand la personne demande quelque chose de précis sur SON dossier.
- Utilise consulter_contrat_et_souscripteur et consulter_consommation dès qu'une question porte sur la situation contractuelle, l'employeur/souscripteur, ou l'utilisation réelle de la couverture (montants déjà consommés, approche d'un plafond, comparaison entre bénéficiaires) — une analyse fondée sur ces vraies données vaut mieux qu'une explication théorique.
- Pour toute question qui touche à UNE date précise (quand un plafond renouvelable rouvrira, depuis quand une garantie est consommée, la fréquence des soins d'un bénéficiaire, qui exactement dans la famille a consommé une rubrique) : consulter_consommation te donne le détail daté ligne par ligne (detailLignes, filtrable par rubrique), pas seulement un total — analyse toi-même ces dates et cette fréquence pour construire ta réponse (ex. un plafond sur 2 ans se recompte à partir de la date du soin qui l'a atteint), au lieu de dire que tu ne peux pas le savoir ou d'escalader sur ce seul motif.
- Pour toute question de fond sur le fonctionnement réglementaire de l'assurance (délais, prescription, obligations respectives, résiliation, sinistres...), utilise consulter_base_connaissance_assurance avant de répondre — reformule ce que tu y trouves en langage clair et utile pour la situation précise de ton interlocuteur, jamais une citation brute d'article de loi qu'il ne comprendrait pas.
- Ne répète jamais une même tournure d'une conversation à l'autre par réflexe ("je comprends votre préoccupation", "n'hésitez pas à me contacter"...) — varie naturellement comme le ferait un vrai conseiller qui connaît déjà le dossier de la personne en face de lui.

Persévérance (règle absolue, permanente — ne change jamais) :
- Tu ne considères JAMAIS une conversation terminée de ton propre chef. Tant que ton interlocuteur n'a pas dit explicitement au revoir, merci pour tout, ou une formule de clôture équivalente, tu restes pleinement disponible — même après avoir donné une réponse complète, reste ouvert à une nouvelle question ou à revenir sur un point plutôt que de couper court.
- Avant de dire que tu ne sais pas ou avant d'escalader, consulte SYSTÉMATIQUEMENT tous les outils pertinents à la question posée (garanties, contrat, consommation, dossiers d'entente préalable, remboursements, base de connaissance...) — n'abandonne jamais après une seule tentative : un vrai conseiller croise plusieurs sources avant de dire qu'il ne trouve rien. Insiste, cherche la réponse ailleurs dans les données réellement disponibles avant de renoncer.
- Comporte-toi comme le ferait un conseiller humain expérimenté et engagé : toujours prêt à discuter, à expliquer avec patience, à rassurer une personne inquiète, à reformuler si elle n'a pas compris, et à chercher activement une solution fondée sur les vraies données de son dossier — jamais une réponse expéditive qui referme la conversation avant l'heure.
- Une fois (et SEULEMENT une fois) que tu as réellement résolu la demande ET que l'interlocuteur confirme ne plus avoir besoin d'aide (remerciement, au revoir...), utilise cloturer_conversation_resolue pour clôturer proprement et transmettre un rapport à l'équipe de gestion — ne laisse jamais la conversation "traîner" indéfiniment sans jamais se clôturer quand tout est réglé. N'utilise JAMAIS cet outil si tu as escaladé à un moment quelconque de cette conversation (il te renverra une erreur).

Règles de contenu :
- Tu n'inventes JAMAIS un chiffre, un plafond, une garantie ou un statut de dossier — tu utilises TOUJOURS les outils fournis pour aller chercher la vraie donnée avant de répondre sur un sujet chiffré ou un dossier précis.
- Tu n'affirmes JAMAIS avoir reçu, enregistré ou transmis un document (devis, ordonnance, facture, quittance) que ton interlocuteur n'a pas RÉELLEMENT envoyé comme pièce jointe dans cette conversation — s'il en parle sans l'avoir jointe, demande-la-lui explicitement avant toute confirmation. Un outil qui refuse faute de pièce jointe (voir accuser_reception_remboursement) n'est jamais une raison de prétendre le contraire.
- Une photo ou un PDF envoyé par ton interlocuteur t'est transmis directement (lecture native, pas un simple signal "une pièce a été envoyée") : tu peux donc vraiment lire ce qui y est écrit et le confirmer précisément (nature du document, date, prestataire, montant affiché dessus). Ne le fais QUE si le texte est effectivement lisible sur l'image — si le document est flou, coupé ou illisible, dis-le et demande une meilleure photo plutôt que de deviner.
- Le montant que tu LIS sur un document (celui écrit dessus) n'est PAS le montant remboursé — ce dernier dépend des garanties, plafonds et taux du contrat, calculés uniquement par le service concerné. Tu peux confirmer ce que tu vois sur la pièce ("je vois une facture de X FCFA du [date]"), jamais annoncer ce qui sera effectivement remboursé.
- Avant de dire qu'une pièce ou une information manque sur un dossier précis, vérifie-le TOUJOURS d'abord avec l'outil correspondant (verifier_dossier_entente_prealable, consulter_garanties, consulter_mes_dossiers_entente_prealable...) — ne pars jamais du principe que rien n'a encore été fourni : une ordonnance ou un devis peut très bien avoir été déposé directement sur le dossier par un autre chemin que cette conversation (formulaire classique du portail), et l'outil te le montre alors vraiment (lecture réelle, pas juste "présent"). Si un document est là mais dans un format que tu ne peux pas lire (tableur, Word...), dis-le précisément et demande un PDF ou une photo — ne redemande jamais un document déjà transmis comme s'il n'existait pas. Adapte chaque réponse à la situation réelle de la personne (son dossier, ses garanties, ce qu'elle a déjà transmis) plutôt que des formulations génériques répétées d'une conversation à l'autre.
- Sur une demande d'entente préalable (prise en charge), tu peux analyser un dossier existant (garanties applicables, plafonds, pièces manquantes) et en discuter, mais tu ne peux JAMAIS annoncer toi-même une décision finale (Accordé/Refusé) — SAUF les deux cas couverts par decider_chambre_hospitalisation (chambre d'une demande Hospitalisation) et traiter_demande_garantie (Dentisterie/Optique/Kinésithérapie & Cure thermale/Maternité/Transport/Autre) : là, une fois l'outil exécuté, tu annonces directement le résultat qu'il te renvoie (Accordé, éventuellement plafonné, ou Refusé, toujours avec le motif exact renvoyé par l'outil — jamais reformulé au point de perdre le motif précis). Pour tout le reste (Chirurgie, EVASAN, une Hospitalisation sans plafond de chambre paramétré, un montant autorisé non calculable, ou tout élément demandant un jugement médical), la décision reste réservée à un gestionnaire — explique l'état d'avancement et les pièces manquantes le cas échéant, sans jamais dire que la décision attend "un humain" (voir règle de confidentialité ci-dessus — dis plutôt qu'elle est "en cours de validation par le service concerné").
- Pour une demande de chambre d'hospitalisation (decider_chambre_hospitalisation), demande TOUJOURS d'abord la DÉCLARATION D'HOSPITALISATION (jamais "l'ordonnance" — ce n'est pas le bon document pour une hospitalisation), PUIS le devis chiffré. Pour toute autre garantie plafonnée (traiter_demande_garantie — Dentisterie, Optique, Kinésithérapie, Maternité, Transport, Autre), demande TOUJOURS d'abord l'ORDONNANCE du médecin (c'est le bon terme ici), PUIS le devis chiffré — dans cet ordre, comme deux pièces distinctes, dans les deux cas. Lis attentivement le nom du patient sur chacune, le nom de l'établissement sur le devis, et (pour traiter_demande_garantie) le montant total qui y figure, et renseigne exactement ce que tu lis dans les champs de l'outil (jamais une supposition ni ce que l'assuré t'a dit oralement) : c'est ce recoupement, fait par le serveur, qui décide d'un accord ou d'un rejet — tu ne juges jamais toi-même si "ça correspond".
- Une fois une demande accordée par l'un de ces deux outils, le certificat de prise en charge est envoyé automatiquement dans la conversation juste après — annonce-le simplement ("je vous transmets votre certificat"), ne décris jamais le document toi-même (montants, dates) au-delà de ce que l'outil t'a déjà donné.
- Si l'outil renvoie un Refusé, communique le motif avec tact mais sans le déguiser ni l'adoucir au point de le rendre incompréhensible, et propose spontanément de transmettre le dossier à un conseiller si l'assuré pense qu'il y a une erreur (par exemple une faute de frappe sur son nom, ou un prestataire mal identifié).
- Sur une demande de remboursement, ton rôle est volontairement limité : tu accuses réception, tu confirmes que le dossier a bien été transmis pour traitement, tu ne donnes jamais de montant remboursé ni de délai précis.
- L'outil escalader_vers_humain est un DERNIER recours, jamais un réflexe : n'y as recours qu'après avoir réellement consulté tout ce que les outils disponibles permettent de vérifier, et seulement si la situation l'exige vraiment (une décision hors du périmètre couvert par decider_chambre_hospitalisation/traiter_demande_garantie, une erreur signalée sur un dossier, une demande explicite de parler à quelqu'un d'autre, ou une donnée réellement introuvable après vérification) — jamais simplement parce qu'une question est délicate ou demande plusieurs recherches. Formule toujours cela comme la suite normale du traitement de la demande, jamais comme un aveu de limite.
- Reste concis (quelques phrases), pas de listes à puces sauf si cela aide vraiment à la clarté.`;
}

// Décision automatique bornée (2026-08) — voir demande utilisateur : "il
// doit être capable de lire les documents... et dire à l'assuré si la
// prise en charge est accordée ou pas. Pour l'hospitalisation on accorde
// juste la chambre en tenant compte du plafond journalier..." puis, étendu :
// "elle doit vérifier le nom du prestataire, l'identité du patient... si
// les pièces ne correspondent pas, elle doit pouvoir rejeter" et "les
// prises en charge de type hospitalisation [sont] beaucoup plus demandées
// par les prestataires médicaux" (disponible aux DEUX contextes, assuré ET
// prestataire — voir outilsDisponibles). Exige DEUX pièces distinctes
// (déclaration d'hospitalisation ET devis — PAS une ordonnance, voir
// demande utilisateur : "pour l'hospitalisation c'est la Déclaration
// d'hospitalisation") et les identités qu'elles portent — le recoupement
// nom-prestataire/nom-patient est vérifié CÔTÉ SERVEUR contre le vrai
// dossier et le vrai catalogue Prestataire (jamais un jugement de l'IA
// elle-même). Tout le reste (Chirurgie, EVASAN, ou une Hospitalisation sans
// plafond de chambre paramétré) reste réservé à un gestionnaire.
const OUTIL_DECIDER_CHAMBRE: Anthropic.Tool = {
  name: "decider_chambre_hospitalisation",
  description: "Décide l'accord (ou le rejet) de la chambre/hébergement d'un dossier d'entente préalable de type Hospitalisation, en vérifiant la déclaration d'hospitalisation ET le devis, puis en informe l'assuré et lui envoie le certificat si accordé. Les deux pièces peuvent venir soit du dossier lui-même (déjà déposées via le formulaire classique du portail — vérifie-le d'abord avec verifier_dossier_entente_prealable), soit de cette conversation. N'ENREGISTRE RIEN et renvoie une erreur si l'une des deux n'est pas encore disponible ou est dans un format illisible (tableur, Word...), si le dossier n'est pas de type Hospitalisation, s'il a déjà une décision, ou si le contrat n'a pas de plafond de chambre paramétré (dans ce dernier cas, transmets le dossier avec escalader_vers_humain).",
  input_schema: {
    type: "object",
    properties: {
      accordId: { type: "string", description: "Identifiant du dossier, ex. PEC-2026-AB12CD" },
      montantChambreParJour: { type: "number", description: "Montant de la chambre PAR JOUR, lu réellement sur le devis." },
      nombreJours: { type: "number", description: "Nombre de jours d'hospitalisation, lu réellement sur le devis ou la déclaration d'hospitalisation." },
      nomPatientLuSurOrdonnance: { type: "string", description: "Nom du patient tel qu'écrit sur la déclaration d'hospitalisation (la première pièce reçue)." },
      nomPatientLuSurDevis: { type: "string", description: "Nom du patient tel qu'écrit sur le devis (la seconde pièce reçue)." },
      nomPrestataireLuSurDevis: { type: "string", description: "Nom de l'établissement émetteur tel qu'écrit sur le devis (en-tête/logo)." },
    },
    required: ["accordId", "montantChambreParJour", "nombreJours", "nomPatientLuSurOrdonnance", "nomPatientLuSurDevis", "nomPrestataireLuSurDevis"],
  },
};

// Traitement automatique des garanties plafonnées (2026-08) — voir demande
// utilisateur : "l'assuré fait des demandes pour les autres types de
// garanties (Optique, Dentisterie, Kinésithérapie...). Il joint le devis et
// la prescription (ordonnance). Ariana analyse les documents, récupère les
// informations, compare avec les données renseignées et saisit la prise en
// charge avec les montants du devis en tenant compte du plafond des
// garanties et des plafonds des actes." Réutilise EXACTEMENT le même
// montant que le gestionnaire verrait déjà comme "montant suggéré"
// (AccordPrealableService.montantAutoriseSuggere, alimenté par SanteService.
// calculerPartAssuranceLigne — le même moteur que la saisie de Facture) :
// aucun calcul de plafond réinventé ici, uniquement le recoupement des
// pièces contre le dossier. Ici c'est bien "ordonnance" (contrairement à
// l'hospitalisation) : ces garanties reposent sur une vraie prescription
// médicale.
const OUTIL_TRAITER_GARANTIE: Anthropic.Tool = {
  name: "traiter_demande_garantie",
  description: "Décide l'accord (ou le rejet) d'un dossier d'entente préalable pour une garantie plafonnée (Dentisterie, Optique, Kinésithérapie & Cure thermale, Maternité, Transport, Autre — PAS Hospitalisation/Chirurgie/EVASAN), en vérifiant l'ordonnance ET le devis, puis en informe l'assuré et lui envoie le certificat si accordé. Les deux pièces peuvent venir soit du dossier lui-même (déjà déposées via le formulaire classique du portail — vérifie-le d'abord avec verifier_dossier_entente_prealable), soit de cette conversation. N'ENREGISTRE RIEN et renvoie une erreur si l'une des deux n'est pas encore disponible ou est dans un format illisible (tableur, Word...), si le dossier n'est pas d'un type couvert par cet outil, s'il a déjà une décision, ou si aucun montant autorisé n'a pu être calculé (acte non reconnu dans le catalogue — transmets alors avec escalader_vers_humain).",
  input_schema: {
    type: "object",
    properties: {
      accordId: { type: "string", description: "Identifiant du dossier, ex. PEC-2026-AB12CD" },
      montantLuSurDevis: { type: "number", description: "Montant total lu réellement sur le devis." },
      nomPatientLuSurOrdonnance: { type: "string", description: "Nom du patient tel qu'écrit sur l'ordonnance (la première pièce reçue)." },
      nomPatientLuSurDevis: { type: "string", description: "Nom du patient tel qu'écrit sur le devis (la seconde pièce reçue)." },
      nomPrestataireLuSurDevis: { type: "string", description: "Nom de l'établissement/praticien émetteur tel qu'écrit sur le devis (en-tête/logo)." },
    },
    required: ["accordId", "montantLuSurDevis", "nomPatientLuSurOrdonnance", "nomPatientLuSurDevis", "nomPrestataireLuSurDevis"],
  },
};

interface OutilContexte {
  demandeurId: string;
  demandeurRole: string;
  assureSanteId: string | null;
  prestataireId: string | null;
  // Nom réel de la société de CETTE conversation (2026-09) — voir demande
  // utilisateur : "toutes les règles de fonctionnement mise en place dans
  // medassur... [sont] valable également pour LA RUCHE EXCELLENCE, pour
  // les compagnies et mutuelles qui utiliseront l'application." L'agent
  // se présentait jusqu'ici comme "chez MedAssur" pour tout le monde
  // (texte figé) — résolu depuis Conversation.societeId (voir repondre())
  // au lieu du nom de la société bootstrap.
  nomEntreprise: string;
  // Scope des cas résolus consultables (2026-09) — voir consulter_base_
  // connaissance_assurance / OutilContexte.societeId : un cas résolu de LA
  // RUCHE EXCELLENCE ne doit pas nourrir les réponses d'une autre société.
  societeId: string | null;
}

@Injectable()
export class MessagerieAgentIaService {
  private readonly logger = new Logger(MessagerieAgentIaService.name);
  private client: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private accordPrealable: AccordPrealableService,
    private remboursements: RemboursementsService,
    private sante: SanteService,
    private documents: DocumentsService,
    private storage: StorageService,
    private pushNotifications: PushNotificationsService,
  ) {}

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    if (!this.client) this.client = new Anthropic({ apiKey });
    return this.client;
  }

  private async idsFamilleDe(assureSanteId: string): Promise<string[]> {
    const membres = await this.prisma.assureSante.findMany({ where: { familleId: assureSanteId } });
    return [assureSanteId, ...membres.map((m) => m.id)];
  }

  // Outils exposés au modèle, scopés au demandeur de LA conversation en
  // cours — jamais un paramètre "assureId" librement choisi par le modèle
  // pour un tiers (voir garde-fou ci-dessus).
  private outilsDisponibles(ctx: OutilContexte): Anthropic.Tool[] {
    const outils: Anthropic.Tool[] = [
      {
        name: "escalader_vers_humain",
        description: `Transmet la conversation à un conseiller ${ctx.nomEntreprise} (outil interne, jamais mentionné tel quel à l'interlocuteur — voir règle de confidentialité de ton identité). DERNIER recours uniquement, après avoir réellement consulté tous les outils pertinents : à utiliser quand la personne le demande explicitement, qu'une décision de gestionnaire est nécessaire, ou qu'une donnée reste introuvable après vérification — jamais par réflexe face à une question qui demande simplement plusieurs recherches.`,
        input_schema: { type: "object", properties: { motif: { type: "string", description: "Résumé court de la demande, pour le conseiller qui va reprendre la conversation" } }, required: ["motif"] },
      },
      {
        name: "consulter_base_connaissance_assurance",
        description: "Recherche dans la réglementation de l'assurance santé (Code CIMA 2019, article par article) et dans le Manuel Assurance Santé CIMA Gabon, ainsi que dans les résumés de cas déjà résolus de cette société. À utiliser pour toute question de fond sur le fonctionnement réglementaire de l'assurance (délais, prescription, obligations de l'assureur/assuré, sinistres, résiliation...) plutôt que de répondre de mémoire — cite le texte pertinent avec mesure (jamais un article entier recopié), en langage clair pour ton interlocuteur.",
        input_schema: {
          type: "object",
          properties: { recherche: { type: "string", description: "Mots-clés de la question posée (ex. \"délai de carence maladie\", \"résiliation contrat assuré\")." } },
          required: ["recherche"],
        },
      },
      {
        name: "cloturer_conversation_resolue",
        description: "Clôture la conversation comme résolue par toi seule (jamais transmise à un conseiller) et enregistre un rapport interne pour l'équipe de gestion (jamais visible de l'interlocuteur — outil interne, voir règle de confidentialité). À utiliser UNIQUEMENT une fois la demande réellement traitée avec les vraies données ET quand l'interlocuteur signale clairement qu'il n'a plus besoin d'aide (remerciement, au revoir, confirmation que c'est bon...). Refuse et renvoie une erreur si cette conversation a, à un moment quelconque, été transmise à un conseiller ou reçu une réponse d'un agent humain — dans ce cas ne l'appelle pas.",
        input_schema: {
          type: "object",
          properties: { resume: { type: "string", description: "Résumé factuel à destination de l'équipe de gestion (jamais lu par l'interlocuteur) : la demande initiale, ce que tu as vérifié/fait avec les vraies données de l'application, et le résultat obtenu. Quelques phrases, précis, pas de tournure générique répétée d'un dossier à l'autre." } },
          required: ["resume"],
        },
      },
    ];
    if (ctx.assureSanteId) {
      outils.push(
        {
          name: "consulter_garanties",
          description: "Liste les garanties du contrat de l'assuré (rubrique, plafond, taux de remboursement applicable).",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "consulter_contrat_et_souscripteur",
          description: "Donne les informations du contrat de l'assuré (type, n° de police, dates d'effet/échéance, compagnie porteuse du risque) et de son souscripteur — l'entreprise ou le particulier qui a souscrit le contrat (nom, secteur d'activité si entreprise). À utiliser pour toute question sur la situation contractuelle ou l'employeur/souscripteur de l'assuré, avant de répondre de façon générique.",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "consulter_consommation",
          description: "Donne les vraies statistiques de consommation de l'assuré et de sa famille : total des soins, total remboursé, répartition par bénéficiaire et par rubrique de garantie, ET le détail daté des dernières prestations (date, rubrique, bénéficiaire, montant, référence de la facture qui l'a enregistrée) — utilise le paramètre rubrique pour filtrer ce détail sur une garantie précise (ex. \"Optique\") quand on te demande une date exacte (dernier soin, réouverture d'un plafond renouvelable, fréquence de consommation, qui a réellement consommé dans la famille...), plutôt que de dire que tu ne peux pas le savoir. Raisonne toi-même sur ces dates (ex. un plafond renouvelable tous les 2 ans se compte à partir de la date du soin qui l'a atteint) — cite la référence de facture quand tu t'appuies sur une ligne précise.",
          input_schema: {
            type: "object",
            properties: { rubrique: { type: "string", description: "Filtre optionnel du détail daté sur une rubrique précise, ex. \"Optique\", \"Dentisterie\". Laisse vide pour les dernières prestations toutes rubriques confondues." } },
          },
        },
        {
          name: "consulter_mes_dossiers_entente_prealable",
          description: "Liste les dossiers de demande d'entente préalable (prise en charge) de l'assuré et de sa famille, avec leur statut.",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "verifier_dossier_entente_prealable",
          description: "Analyse un dossier d'entente préalable précis : garanties applicables, montant suggéré selon les plafonds réels, et l'état RÉEL de l'ordonnance/déclaration d'hospitalisation et du devis — si l'une est déjà déposée directement sur le dossier (formulaire classique du portail), tu la reçois VRAIMENT dans ce résultat (image/PDF à lire), pas juste un booléen ; si son format n'est pas lisible automatiquement (tableur, Word...), c'est signalé précisément. À utiliser TOUJOURS avant de dire qu'une pièce manque ou de redemander quoi que ce soit sur un dossier. Ne donne jamais la décision finale.",
          input_schema: { type: "object", properties: { accordId: { type: "string", description: "Identifiant du dossier, ex. PEC-2026-AB12CD" } }, required: ["accordId"] },
        },
        {
          name: "accuser_reception_remboursement",
          description: "Enregistre une nouvelle demande de remboursement pour l'assuré (accusé de réception uniquement — un agent humain traitera le dossier ensuite). N'ENREGISTRE RIEN et renvoie une erreur si l'assuré n'a pas encore envoyé, dans cette conversation, une pièce jointe (photo/scan de la facture ou de la quittance) — demande-la d'abord si ce n'est pas déjà fait, n'utilise cet outil qu'une fois qu'elle a été envoyée.",
          input_schema: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date des soins, format jj/mm/aaaa" },
              type: { type: "string", description: "Nature des soins, ex. Consultation, Pharmacie (facultatif)" },
              prestataire: { type: "string", description: "Nom du prestataire de santé consulté (facultatif)" },
              descriptionPiece: { type: "string", description: "Ce que tu lis réellement sur la pièce jointe reçue (ex. \"Facture Pharmacie Nkembo du 12/08/2026, montant 15 000 FCFA\") — pour information du gestionnaire, jamais utilisé comme montant remboursé. Facultatif, uniquement si le texte est effectivement lisible." },
            },
            required: ["date"],
          },
        },
        {
          name: "consulter_mes_remboursements",
          description: "Liste les demandes de remboursement déjà déclarées par l'assuré (et sa famille), avec leur statut réel (En attente/Validé/Payé/Rejeté...), leur date et le nombre de lignes — jamais un montant remboursé précis (voir règle de contenu : le montant dépend d'un calcul réservé au service concerné). À utiliser dès qu'on te demande où en est un remboursement, avant de dire que tu ne sais pas ou d'escalader.",
          input_schema: { type: "object", properties: {} },
        },
        OUTIL_DECIDER_CHAMBRE,
        OUTIL_TRAITER_GARANTIE,
      );
    }
    if (ctx.prestataireId) {
      outils.push(
        {
          name: "consulter_mes_dossiers_entente_prealable",
          description: "Liste les dossiers de demande d'entente préalable soumis par ce prestataire, avec leur statut.",
          input_schema: { type: "object", properties: {} },
        },
        {
          name: "verifier_dossier_entente_prealable",
          description: "Analyse un dossier d'entente préalable précis soumis par ce prestataire : garanties applicables, montant suggéré, et l'état RÉEL de l'ordonnance/déclaration d'hospitalisation et du devis — si l'une est déjà déposée directement sur le dossier, tu la reçois VRAIMENT (image/PDF à lire), pas juste un booléen ; format illisible signalé précisément. À utiliser TOUJOURS avant de dire qu'une pièce manque. Ne donne jamais la décision finale.",
          input_schema: { type: "object", properties: { accordId: { type: "string" } }, required: ["accordId"] },
        },
        // Hospitalisation majoritairement demandée par les prestataires
        // (2026-08, voir demande utilisateur) — même outil, même règles de
        // recoupement, que côté assuré ci-dessus.
        OUTIL_DECIDER_CHAMBRE,
      );
    }
    return outils;
  }

  // Recherche par mots-clés dans ArianaConnaissance (2026-09) — voir
  // modèle Prisma pour le contexte complet. Pas de moteur de recherche
  // sémantique/vectoriel dans cette base : un classement déterministe par
  // nombre d'occurrences des mots-clés est largement suffisant pour ~1400
  // articles et reste simple à auditer (jamais une "boîte noire" qui
  // choisirait des passages sans qu'on comprenne pourquoi).
  private readonly MOTS_VIDES = new Set([
    "de", "la", "le", "les", "un", "une", "des", "du", "et", "ou", "pour", "sur", "dans", "en", "au", "aux",
    "que", "qui", "ce", "ces", "se", "sa", "son", "ses", "avec", "sans", "par", "est", "sont", "il", "elle",
    "ne", "pas", "plus", "comment", "quel", "quelle", "quels", "quelles", "faut", "mon", "ma", "mes", "votre",
    "vos", "nous", "vous", "ils", "elles", "être", "avoir", "cette", "cet", "leur", "leurs",
  ]);

  private async rechercherBaseConnaissance(recherche: string, societeId: string | null): Promise<unknown> {
    const mots = recherche
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length > 2 && !this.MOTS_VIDES.has(m));
    if (mots.length === 0) return { resultats: [] };

    const candidats = await this.prisma.arianaConnaissance.findMany({
      where: {
        AND: [
          { OR: mots.map((m) => ({ contenu: { contains: m, mode: "insensitive" as const } })) },
          { OR: [{ categorie: "Reglementation" }, { categorie: "CasResolu", societeId }] },
        ],
      },
      take: 80,
    });
    if (candidats.length === 0) return { resultats: [], info: "Aucun passage trouvé pour cette recherche." };

    const normalise = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const scores = candidats.map((c) => {
      const texte = normalise(c.contenu);
      const score = mots.reduce((s, m) => s + (texte.split(m).length - 1), 0);
      return { c, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return {
      resultats: scores.slice(0, 5).map(({ c }) => ({
        source: c.source, titre: c.titre,
        extrait: c.contenu.length > 700 ? `${c.contenu.slice(0, 700)}…` : c.contenu,
      })),
    };
  }

  private async executerOutil(nom: string, args: Record<string, unknown>, ctx: OutilContexte, conversationId: string): Promise<unknown> {
    switch (nom) {
      case "consulter_base_connaissance_assurance":
        return this.rechercherBaseConnaissance(String(args.recherche ?? ""), ctx.societeId);
      case "consulter_garanties": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        const assure = await this.prisma.assureSante.findUnique({ where: { id: ctx.assureSanteId }, include: { contrat: { include: { garanties: true } } } });
        if (!assure) return { erreur: "Assuré introuvable." };
        return assure.contrat.garanties.map((g) => ({
          rubrique: g.categorie, plafond: g.plafond,
          tauxApplicable: assure.typeAssure === "AS" ? g.tauxAssure : g.tauxAyantsDroit,
        }));
      }
      case "consulter_contrat_et_souscripteur": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        const assure = await this.prisma.assureSante.findUnique({
          where: { id: ctx.assureSanteId },
          include: { contrat: { include: { client: true, compagnie: true } } },
        });
        if (!assure) return { erreur: "Assuré introuvable." };
        const c = assure.contrat;
        return {
          contrat: {
            numeroPolice: c.numeroPolice, branche: c.branche, dateDebut: c.dateDebut, dateFin: c.dateFin, statut: c.statut,
            compagnie: c.compagnie.nom,
          },
          souscripteur: {
            nom: c.client.nom, type: c.client.type,
            secteurActivite: c.client.secteurActivite ?? null,
            effectif: c.client.effectif ?? null,
          },
          beneficiaire: { typeAssure: assure.typeAssure, statutCarte: assure.statutCarte, dateAffiliation: assure.dateAffiliation },
        };
      }
      // Données RÉELLES de consommation (2026-09) — voir demande utilisateur :
      // "elle doit pouvoir lire les données contractuelles d'un assuré et
      // son souscripteur, les données de consommation afin de faire des
      // analyses réelles et fondées". MÊME calcul que le tableau de bord
      // (dashboard() ci-dessus) — jamais un second moteur de calcul
      // divergent, juste réexposé comme outil consultable par l'IA.
      case "consulter_consommation": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        const assure = await this.prisma.assureSante.findUnique({ where: { id: ctx.assureSanteId }, include: { contrat: { include: { garanties: true } } } });
        if (!assure) return { erreur: "Assuré introuvable." };
        const idsFamille = await this.idsFamilleDe(ctx.assureSanteId);
        const lignes = await this.sante.findPrisesEnCharge(idsFamille);
        let totalConsommation = 0, totalRembourse = 0;
        const parBeneficiaireMap = new Map<string, { nom: string; total: number }>();
        const parRubriqueMap = new Map<string, number>();
        // detailLignes (2026-09) — voir demande utilisateur : "il doit
        // parcourir toutes les données existantes dans la base... lire avec
        // exactitude les données" — jusqu'ici seuls des TOTAUX étaient
        // exposés, l'agent ne pouvait donc jamais répondre à une question
        // sur UNE date précise (ex. "à partir de quand ma garantie Optique,
        // renouvelable tous les 2 ans, sera de nouveau disponible ?") et
        // devait escalader à tort. `date` vient déjà de PriseEnCharge, et
        // `rubrique` réutilise EXACTEMENT le même resolver que les
        // statistiques du contrat (voir resoudreCategorieConsommation) —
        // jamais un second calcul divergent.
        // Référence facture (2026-09) — voir demande utilisateur : "les
        // prises en charge sont toujours clôturées en facture... regarder
        // les dates et les prendre en référence" — chaque PriseEnCharge
        // rattachée à une Facture reste la MÊME donnée (Facture.lignes
        // pointe déjà vers ces mêmes lignes, jamais une source séparée),
        // mais la référence facture donne à l'agent une pièce concrète à
        // citer pour étayer sa réponse (traçabilité), plutôt qu'une date
        // nue sans preuve rattachée.
        const factureIds = [...new Set(lignes.map((l) => l.factureId).filter((id): id is string => !!id))];
        const factures = factureIds.length > 0
          ? await this.prisma.facture.findMany({ where: { id: { in: factureIds } }, select: { id: true, referenceFacture: true, dateReception: true } })
          : [];
        const factureParId = new Map(factures.map((f) => [f.id, f]));
        const detail: { date: string; rubrique: string; beneficiaire: string; montant: number; referenceFacture: string | null }[] = [];
        for (const l of lignes) {
          const montant = Number(l.montant);
          totalConsommation += montant;
          if (l.baseRemboursement != null) totalRembourse += Number(l.baseRemboursement);
          const nomBeneficiaire = `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim();
          const entree = parBeneficiaireMap.get(l.assureId) ?? { nom: nomBeneficiaire, total: 0 };
          entree.total += montant;
          parBeneficiaireMap.set(l.assureId, entree);
          const rubrique = resoudreCategorieConsommation(assure.contrat.garanties, l.type, l.acteMedical, l.prestataireRef?.type);
          parRubriqueMap.set(rubrique, (parRubriqueMap.get(rubrique) ?? 0) + montant);
          const facture = l.factureId ? factureParId.get(l.factureId) : null;
          detail.push({ date: l.date, rubrique, beneficiaire: nomBeneficiaire, montant, referenceFacture: facture?.referenceFacture ?? null });
        }
        const rubriqueFiltre = typeof args.rubrique === "string" && args.rubrique.trim() ? args.rubrique.trim().toLowerCase() : null;
        // Comparaison lexicographique sur "aaaa-mm-jj" (dates stockées en
        // texte "jj/mm/aaaa") — plus sûr qu'un parsing Date pour un simple
        // tri décroissant, aucune ambiguïté de fuseau horaire.
        const cleTri = (d: string) => { const [j, m, a] = d.split("/"); return `${a}-${m}-${j}`; };
        const detailFiltre = (rubriqueFiltre ? detail.filter((d) => d.rubrique.toLowerCase().includes(rubriqueFiltre)) : detail)
          .sort((a, b) => cleTri(b.date).localeCompare(cleTri(a.date)))
          .slice(0, 50);
        return {
          totalConsommation, totalRembourse,
          parBeneficiaire: [...parBeneficiaireMap.values()].sort((a, b) => b.total - a.total),
          parRubrique: [...parRubriqueMap.entries()].map(([rubrique, total]) => ({ rubrique, total })).sort((a, b) => b.total - a.total),
          detailLignes: detailFiltre,
        };
      }
      case "consulter_mes_dossiers_entente_prealable": {
        const dossiers = ctx.assureSanteId
          ? await this.accordPrealable.findAll({ assureId: ctx.assureSanteId })
          : ctx.prestataireId
            ? await this.accordPrealable.findAll({ prestataireId: ctx.prestataireId })
            : [];
        return dossiers.map((d) => ({ id: d.id, type: d.type, description: d.description, decision: d.decision, statutAnalyseMedicale: d.statutAnalyseMedicale, statutValidationFinanciere: d.statutValidationFinanciere, dateDemande: d.dateDemande }));
      }
      case "consulter_mes_remboursements": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        const remboursements = await this.remboursements.findAll({ assurePrincipalId: ctx.assureSanteId });
        return remboursements.map((r) => ({ id: r.id, statut: r.statut, dateDeclaration: r.dateDeclaration, nombreLignes: r.lignes.length }));
      }
      case "verifier_dossier_entente_prealable": {
        const accordId = String(args.accordId ?? "");
        const dossier = await this.accordPrealable.findOne(accordId).catch(() => null);
        if (!dossier) return { erreur: "Dossier introuvable." };
        const appartientAssure = ctx.assureSanteId ? (await this.idsFamilleDe(ctx.assureSanteId)).includes(dossier.assureId) : false;
        const appartientPrestataire = ctx.prestataireId ? dossier.prestataireId === ctx.prestataireId : false;
        if (!appartientAssure && !appartientPrestataire) return { erreur: "Ce dossier n'appartient pas à cette conversation." };

        // Lecture RÉELLE des pièces déjà déposées directement sur le
        // dossier (2026-08) — voir demande utilisateur : "l'agent IA n'a
        // toujours pas une vraie lecture des documents qui ont été joints à
        // la demande... il demande des documents, mais l'assuré a joint des
        // pièces." Un dossier créé via le formulaire classique du portail
        // (pas la messagerie) peut déjà porter son ordonnance/devis — ne
        // JAMAIS les traiter comme absents. Le contenu réel (image/PDF) est
        // renvoyé DANS ce tool_result (voir __blocsBruts, extrait par
        // repondre() et placé dans le content du tool_result — Anthropic
        // supporte des blocs image/document à l'intérieur d'un tool_result),
        // pour que tu puisses vraiment le lire, pas seulement savoir qu'il
        // existe. Un format non supporté (tableur, Word...) est signalé
        // précisément — jamais confondu avec "rien n'a été fourni".
        const blocsBruts: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam)[] = [];
        const etatPiece = async (libelle: string, nomFichier: string | null) => {
          if (!nomFichier) return { presente: false };
          const lecture = await lireFichierJoint(this.storage, "accords-prealables", UPLOADS_DOCS_DIR, nomFichier);
          if (lecture.lisible) {
            blocsBruts.push({ type: "text", text: `Voici le document "${libelle}" déjà joint à ce dossier (dossier ${accordId}) — lis-le réellement :` }, lecture.bloc);
            return { presente: true, lisible: true };
          }
          if (lecture.raison === "format_non_supporte") {
            return { presente: true, lisible: false, raison: `déjà joint mais dans un format (.${lecture.format}) que tu ne peux pas lire automatiquement — demande à l'interlocuteur de le renvoyer en PDF ou en photo, ne dis jamais qu'il "n'a rien envoyé"` };
          }
          return { presente: false };
        };
        const ordonnance = await etatPiece("ordonnance/déclaration d'hospitalisation", dossier.ordonnanceFichier);
        const devis = await etatPiece("devis", dossier.devisFichier);

        return {
          id: dossier.id, type: dossier.type, decision: dossier.decision,
          statutAnalyseMedicale: dossier.statutAnalyseMedicale, statutValidationFinanciere: dossier.statutValidationFinanciere,
          montantDevis: dossier.montantDevis, montantAutorise: dossier.montantAutorise, montantAutoriseSuggere: dossier.montantAutoriseSuggere,
          ordonnance, devis,
          __blocsBruts: blocsBruts,
        };
      }
      case "accuser_reception_remboursement": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        // Garde-fou (2026-08) — voir demande utilisateur : "la prise en
        // charge se génère alors qu'aucun montant n'a été renseigné. Le
        // devis même transmis n'est pas un vrai devis et la prise en
        // charge a été générée." Le montant reste à 0 jusqu'à l'examen du
        // gestionnaire (même règle que le vrai formulaire "Remboursement"
        // du portail, voir PortailMembreController.creerRemboursement) —
        // mais SANS pièce jointe réellement envoyée dans la conversation,
        // ce dossier n'a rien de vérifiable à examiner : refuser plutôt
        // que créer un dossier vide, jamais deviner ou déclarer une pièce
        // reçue qui ne l'est pas.
        const piecesRecues = await this.prisma.message.count({
          where: { conversationId, auteurType: "Utilisateur", pieceJointe: { not: null } },
        });
        if (piecesRecues === 0) {
          return { erreur: "Aucune pièce jointe reçue dans cette conversation. Demande à l'assuré une photo ou un scan de sa facture/quittance avant d'enregistrer le dossier — n'annonce jamais qu'une pièce a été reçue tant que ce n'est pas vrai." };
        }
        const cree = await this.sante.createPriseEnCharge({
          assureId: ctx.assureSanteId,
          prestataire: (args.prestataire as string) || "À préciser",
          type: (args.type as string) || "Remboursement",
          montant: 0,
          date: String(args.date ?? ""),
          modePaiement: "Remboursement",
        } as Parameters<SanteService["createPriseEnCharge"]>[0]);
        // descriptionPiece (2026-08, "OCR") — ce que l'IA a réellement lu
        // sur la pièce jointe, transmis au gestionnaire à titre indicatif
        // seulement : jamais écrit dans `montant` (voir createPriseEnCharge
        // ci-dessus, toujours 0 — le gestionnaire fixe le vrai montant à
        // l'examen des pièces).
        const descriptionPiece = typeof args.descriptionPiece === "string" && args.descriptionPiece.trim() ? ` Lu sur la pièce jointe : "${args.descriptionPiece.trim()}".` : "";
        await this.notifierAgentsHumains(conversationId, `Nouvelle demande de remboursement (${cree.id}) déposée via ${NOM_AGENT} — pièce(s) jointe(s) envoyée(s) par l'assuré dans la conversation, montant à examiner.${descriptionPiece}`);
        return { id: cree.id, message: `Demande enregistrée avec la pièce jointe reçue, un agent ${ctx.nomEntreprise} va l'examiner.` };
      }
      case "decider_chambre_hospitalisation": {
        if (!ctx.assureSanteId && !ctx.prestataireId) return { erreur: "Non disponible pour ce type de compte." };
        const accordId = String(args.accordId ?? "");
        const dossier = await this.accordPrealable.findOne(accordId).catch(() => null);
        if (!dossier) return { erreur: "Dossier introuvable." };
        // Ownership assuré OU prestataire (2026-08) — voir demande
        // utilisateur : "les prise en charge de type hospitalisation
        // [sont] beaucoup plus demandées par les prestataires médicaux",
        // même recoupement de propriété que verifier_dossier_entente_prealable.
        const appartient = ctx.assureSanteId
          ? (await this.idsFamilleDe(ctx.assureSanteId)).includes(dossier.assureId)
          : dossier.prestataireId === ctx.prestataireId;
        if (!appartient) return { erreur: "Ce dossier n'appartient pas à cette conversation." };
        if (dossier.type !== "Hospitalisation") {
          return { erreur: "Cet outil ne s'applique qu'aux demandes de type Hospitalisation — pour tout autre type, transmets le dossier à un gestionnaire (escalader_vers_humain)." };
        }
        if (dossier.decision !== "En attente") {
          return { erreur: `Ce dossier a déjà une décision (${dossier.decision}) — rien à faire.` };
        }
        // Exige la déclaration d'hospitalisation ET le devis, disponibles
        // et lisibles — déjà déposés directement sur le dossier (formulaire
        // classique du portail) OU envoyés dans cette conversation (voir
        // resoudrePieces, jamais l'un ou l'autre supposé absent sans
        // vérification réelle du disque).
        const { ordonnance: resOrdonnance, devis: resDevis } = await this.resoudrePieces(conversationId, accordId, dossier);
        if (!resOrdonnance.ok || !resDevis.ok) {
          const motifs: string[] = [];
          if (!resOrdonnance.ok) motifs.push(resOrdonnance.raisonFormatNonSupporte ? `la déclaration d'hospitalisation déjà jointe est dans un format (.${resOrdonnance.raisonFormatNonSupporte}) illisible automatiquement — demande-la en PDF ou en photo` : "la déclaration d'hospitalisation n'a pas encore été fournie");
          if (!resDevis.ok) motifs.push(resDevis.raisonFormatNonSupporte ? `le devis déjà joint est dans un format (.${resDevis.raisonFormatNonSupporte}) illisible automatiquement — demande-le en PDF ou en photo` : "le devis n'a pas encore été fourni");
          return { erreur: motifs.join(" ; ") };
        }

        const contrat = await this.prisma.contrat.findUnique({ where: { id: dossier.contratId }, select: { plafondChambreJour: true } });
        const plafondJour = contrat?.plafondChambreJour != null ? Number(contrat.plafondChambreJour) : null;
        if (plafondJour == null) {
          return { erreur: "Ce contrat n'a pas de plafond de chambre paramétré — tu ne peux pas trancher toi-même ce dossier, transmets-le à un gestionnaire (escalader_vers_humain)." };
        }
        const montantParJour = Number(args.montantChambreParJour ?? 0);
        const jours = Number(args.nombreJours ?? 0);
        if (montantParJour <= 0 || jours <= 0) {
          return { erreur: "Le montant de la chambre par jour et le nombre de jours (lus sur le devis) doivent être des valeurs positives." };
        }

        // Recoupement identité patient + prestataire (2026-08) — voir
        // demande utilisateur : "vérifier le nom du prestataire, l'identité
        // du patient... si les pièces ne correspondent pas, elle doit
        // pouvoir rejeter." Comparaison déterministe côté serveur (voir
        // nomsCorrespondent), jamais un jugement de l'IA elle-même.
        const assure = await this.prisma.assureSante.findUnique({ where: { id: dossier.assureId }, select: { nom: true, prenom: true } });
        const nomAttenduPatient = `${assure?.nom ?? ""} ${assure?.prenom ?? ""}`.trim();
        const patientOrdonnanceOk = nomsCorrespondent(nomAttenduPatient, String(args.nomPatientLuSurOrdonnance ?? ""));
        const patientDevisOk = nomsCorrespondent(nomAttenduPatient, String(args.nomPatientLuSurDevis ?? ""));

        let prestataireReel: { nom: string; statutConvention: string | null } | null = dossier.prestataireId
          ? await this.prisma.prestataire.findUnique({ where: { id: dossier.prestataireId }, select: { nom: true, statutConvention: true } })
          : null;
        if (!prestataireReel) {
          prestataireReel = await this.prisma.prestataire.findFirst({ where: { nom: { contains: dossier.prestataire, mode: "insensitive" } }, select: { nom: true, statutConvention: true } });
        }
        const nomLuPrestataire = String(args.nomPrestataireLuSurDevis ?? "");
        const prestataireCorrespondDossier = nomsCorrespondent(dossier.prestataire, nomLuPrestataire);
        const prestataireConventionne = prestataireReel?.statutConvention === "Conventionné";

        const motifsRefus: string[] = [];
        if (!patientOrdonnanceOk) motifsRefus.push("le nom du patient sur la déclaration d'hospitalisation ne correspond pas à l'assuré de ce dossier");
        if (!patientDevisOk) motifsRefus.push("le nom du patient sur le devis ne correspond pas à l'assuré de ce dossier");
        if (!prestataireCorrespondDossier) motifsRefus.push(`le prestataire indiqué sur le devis ("${nomLuPrestataire || "non lisible"}") ne correspond pas au prestataire déclaré sur ce dossier ("${dossier.prestataire}")`);
        if (!prestataireReel) motifsRefus.push(`le prestataire "${dossier.prestataire}" n'a pas été retrouvé dans le réseau conventionné ${ctx.nomEntreprise}`);
        else if (!prestataireConventionne) motifsRefus.push(`${prestataireReel.nom} n'est pas (ou plus) conventionné avec ${ctx.nomEntreprise}`);

        if (motifsRefus.length > 0) {
          const motif = motifsRefus.join(" ; ");
          await this.prisma.accordPrealable.update({
            where: { id: accordId },
            data: { statutAnalyseMedicale: "Rejetée", decision: "Refusé", motifDecision: motif, dateDecision: aujourdhuiFr() },
          });
          const compteRefus = await this.prisma.user.findUnique({ where: { assureSanteId: dossier.assureId } });
          if (compteRefus) {
            await this.notifications.create("Assuré", compteRefus.id, `Votre demande de prise en charge (${accordId}) a été refusée : ${motif}.`).catch(() => undefined);
          }
          await this.notifierAgentsHumains(conversationId, `Chambre hospitalisation REJETÉE automatiquement par ${NOM_AGENT} pour le dossier ${accordId} — motif : ${motif}. À vérifier par un gestionnaire.`);
          return {
            decision: "Refusé", motif,
            message: `Votre demande n'a malheureusement pas pu être accordée : ${motif}. Si vous pensez qu'il s'agit d'une erreur, un conseiller ${ctx.nomEntreprise} peut réexaminer votre dossier — souhaitez-vous que je le transmette ?`,
          };
        }

        const montantDevisChambre = arrondi2(montantParJour * jours);
        const plafondTotal = arrondi2(plafondJour * jours);
        const capped = montantDevisChambre > plafondTotal;
        const montantAutorise = capped ? plafondTotal : montantDevisChambre;
        const motifAccord = capped ? `Chambre plafonnée à ${plafondJour} FCFA/jour × ${jours} jour(s) (devis à ${montantParJour} FCFA/jour)` : `Chambre accordée au montant du devis (${montantParJour} FCFA/jour × ${jours} jour(s))`;

        // Rattache au dossier les pièces qui venaient du chat — celles déjà
        // sur le dossier (source "dossier") n'ont rien à rattacher, même
        // circuit que l'upload manuel (AccordPrealableService.uploadDocument)
        // pour les autres, pour que le dossier reste cohérent avec le reste
        // de l'application (certificat, écran interne...).
        for (const [type, resolu] of [["ordonnance", resOrdonnance], ["devis", resDevis]] as const) {
          if (resolu.source !== "messagerie") continue;
          const buffer = this.storage.actif
            ? await this.storage.download("messagerie", resolu.piece.pieceJointe!)
            : (() => { const c = path.join(UPLOADS_MESSAGERIE_DIR, resolu.piece.pieceJointe!); return fs.existsSync(c) ? fs.readFileSync(c) : null; })();
          if (buffer) {
            await this.accordPrealable.uploadDocument(accordId, type, { originalname: resolu.piece.pieceJointe!, buffer } as Express.Multer.File);
          }
        }

        // Mise à jour DIRECTE (2026-08) — pas AccordPrealableService.decider(),
        // qui n'a pas connaissance du recoupement identité/prestataire fait
        // ci-dessus. Montant toujours plafonné à une donnée réelle du
        // contrat, ordonnance ET devis toujours exigés et rattachés.
        await this.prisma.accordPrealable.update({
          where: { id: accordId },
          data: { statutAnalyseMedicale: "Validée", statutValidationFinanciere: "Validée", decision: "Accordé", montantAutorise, motifDecision: motifAccord, dateDecision: aujourdhuiFr() },
        });
        const compteAssure = await this.prisma.user.findUnique({ where: { assureSanteId: dossier.assureId } });
        if (compteAssure) {
          await this.notifications.create("Assuré", compteAssure.id, `Votre demande de prise en charge (${accordId}) a été accordée.`).catch(() => undefined);
        }
        await this.notifierAgentsHumains(conversationId, `Chambre hospitalisation décidée automatiquement par ${NOM_AGENT} pour le dossier ${accordId} : ${montantAutorise} FCFA autorisés (${motifAccord}). Prestataire et identité du patient vérifiés.`);
        // "et après il envoie le fichier de la prise en charge" (2026-08).
        await this.envoyerCertificatDansConversation(conversationId, accordId);

        return {
          decision: "Accordé", montantAutorise, plafondChambreJour: plafondJour, nombreJours: jours, capped,
          message: capped
            ? `Chambre accordée au plafond contractuel de votre garantie : ${montantAutorise} FCFA (${plafondJour} FCFA/jour × ${jours} jour(s)). Le devis indiquait ${montantParJour} FCFA/jour — la différence reste à votre charge auprès de l'établissement.`
            : `Chambre accordée au montant du devis : ${montantAutorise} FCFA (${montantParJour} FCFA/jour × ${jours} jour(s)).`,
        };
      }
      case "traiter_demande_garantie": {
        if (!ctx.assureSanteId) return { erreur: "Non disponible pour ce type de compte." };
        const accordId = String(args.accordId ?? "");
        const dossier = await this.accordPrealable.findOne(accordId).catch(() => null);
        if (!dossier) return { erreur: "Dossier introuvable." };
        const appartient = (await this.idsFamilleDe(ctx.assureSanteId)).includes(dossier.assureId);
        if (!appartient) return { erreur: "Ce dossier n'appartient pas à cette conversation." };
        if (!RUBRIQUES_PLAFONNEES.includes(dossier.type)) {
          return { erreur: "Cet outil ne s'applique qu'aux garanties Dentisterie/Optique/Kinésithérapie & Cure thermale/Maternité/Transport/Autre — pour l'hospitalisation utilise decider_chambre_hospitalisation, pour tout autre type transmets à un gestionnaire (escalader_vers_humain)." };
        }
        if (dossier.decision !== "En attente") {
          return { erreur: `Ce dossier a déjà une décision (${dossier.decision}) — rien à faire.` };
        }

        // Exige l'ordonnance ET le devis, disponibles et lisibles — mêmes
        // garde-fou et résolution unifiée dossier/messagerie que
        // decider_chambre_hospitalisation (voir resoudrePieces).
        const { ordonnance: resOrdonnance, devis: resDevis } = await this.resoudrePieces(conversationId, accordId, dossier);
        if (!resOrdonnance.ok || !resDevis.ok) {
          const motifs: string[] = [];
          if (!resOrdonnance.ok) motifs.push(resOrdonnance.raisonFormatNonSupporte ? `l'ordonnance déjà jointe est dans un format (.${resOrdonnance.raisonFormatNonSupporte}) illisible automatiquement — demande-la en PDF ou en photo` : "l'ordonnance n'a pas encore été fournie");
          if (!resDevis.ok) motifs.push(resDevis.raisonFormatNonSupporte ? `le devis déjà joint est dans un format (.${resDevis.raisonFormatNonSupporte}) illisible automatiquement — demande-le en PDF ou en photo` : "le devis n'a pas encore été fourni");
          return { erreur: motifs.join(" ; ") };
        }

        // Recoupement identité patient + prestataire — même logique que
        // decider_chambre_hospitalisation (voir nomsCorrespondent).
        const assure = await this.prisma.assureSante.findUnique({ where: { id: dossier.assureId }, select: { nom: true, prenom: true } });
        const nomAttenduPatient = `${assure?.nom ?? ""} ${assure?.prenom ?? ""}`.trim();
        const patientOrdonnanceOk = nomsCorrespondent(nomAttenduPatient, String(args.nomPatientLuSurOrdonnance ?? ""));
        const patientDevisOk = nomsCorrespondent(nomAttenduPatient, String(args.nomPatientLuSurDevis ?? ""));

        let prestataireReel: { nom: string; statutConvention: string | null } | null = dossier.prestataireId
          ? await this.prisma.prestataire.findUnique({ where: { id: dossier.prestataireId }, select: { nom: true, statutConvention: true } })
          : null;
        if (!prestataireReel) {
          prestataireReel = await this.prisma.prestataire.findFirst({ where: { nom: { contains: dossier.prestataire, mode: "insensitive" } }, select: { nom: true, statutConvention: true } });
        }
        const nomLuPrestataire = String(args.nomPrestataireLuSurDevis ?? "");
        const prestataireCorrespondDossier = nomsCorrespondent(dossier.prestataire, nomLuPrestataire);
        const prestataireConventionne = prestataireReel?.statutConvention === "Conventionné";

        // Montant déclaré vs montant réellement lu sur le devis (2026-08) —
        // voir demande utilisateur : "compare avec les données renseignées".
        // Tolérance d'arrondi/lecture (2%, minimum 1000 FCFA) — un écart
        // au-delà n'est pas anodin (dossier corrigé après coup, ou devis ne
        // correspondant pas à la demande initiale).
        const montantDeclare = dossier.montantDevis != null ? Number(dossier.montantDevis) : null;
        const montantLu = Number(args.montantLuSurDevis ?? 0);
        const toleranceMontant = montantDeclare != null ? Math.max(1000, montantDeclare * 0.02) : Infinity;
        const montantCorrespond = montantDeclare == null || Math.abs(montantLu - montantDeclare) <= toleranceMontant;

        const motifsRefus: string[] = [];
        if (!patientOrdonnanceOk) motifsRefus.push("le nom du patient sur l'ordonnance ne correspond pas à l'assuré de ce dossier");
        if (!patientDevisOk) motifsRefus.push("le nom du patient sur le devis ne correspond pas à l'assuré de ce dossier");
        if (!prestataireCorrespondDossier) motifsRefus.push(`le prestataire indiqué sur le devis ("${nomLuPrestataire || "non lisible"}") ne correspond pas au prestataire déclaré sur ce dossier ("${dossier.prestataire}")`);
        if (!prestataireReel) motifsRefus.push(`le prestataire "${dossier.prestataire}" n'a pas été retrouvé dans le réseau conventionné ${ctx.nomEntreprise}`);
        else if (!prestataireConventionne) motifsRefus.push(`${prestataireReel.nom} n'est pas (ou plus) conventionné avec ${ctx.nomEntreprise}`);
        if (!montantCorrespond) motifsRefus.push(`le montant lu sur le devis (${montantLu} FCFA) ne correspond pas au montant déclaré sur la demande (${montantDeclare} FCFA)`);

        if (motifsRefus.length > 0) {
          const motif = motifsRefus.join(" ; ");
          await this.prisma.accordPrealable.update({
            where: { id: accordId },
            data: { statutAnalyseMedicale: "Rejetée", decision: "Refusé", motifDecision: motif, dateDecision: aujourdhuiFr() },
          });
          const compteRefus = await this.prisma.user.findUnique({ where: { assureSanteId: dossier.assureId } });
          if (compteRefus) {
            await this.notifications.create("Assuré", compteRefus.id, `Votre demande de prise en charge (${accordId}) a été refusée : ${motif}.`).catch(() => undefined);
          }
          await this.notifierAgentsHumains(conversationId, `Demande de garantie (${dossier.type}) REJETÉE automatiquement par ${NOM_AGENT} pour le dossier ${accordId} — motif : ${motif}. À vérifier par un gestionnaire.`);
          return {
            decision: "Refusé", motif,
            message: `Votre demande n'a malheureusement pas pu être accordée : ${motif}. Si vous pensez qu'il s'agit d'une erreur, un conseiller ${ctx.nomEntreprise} peut réexaminer votre dossier — souhaitez-vous que je le transmette ?`,
          };
        }

        // Montant autorisé = EXACTEMENT le même calcul que verrait un
        // gestionnaire (AccordPrealableService.montantAutoriseSuggere, déjà
        // rendu par findOne() — jamais recalculé ici). Sans acte reconnu
        // dans le catalogue, ce montant est null : pas de décision
        // automatique possible, on transmet plutôt que de deviner.
        const montantAutorise = dossier.montantAutoriseSuggere;
        if (montantAutorise == null) {
          return { erreur: "Impossible de calculer un montant autorisé pour ce dossier (acte non reconnu dans le catalogue ou garantie non paramétrée) — transmets-le à un gestionnaire (escalader_vers_humain)." };
        }

        for (const [type, resolu] of [["ordonnance", resOrdonnance], ["devis", resDevis]] as const) {
          if (resolu.source !== "messagerie") continue;
          const buffer = this.storage.actif
            ? await this.storage.download("messagerie", resolu.piece.pieceJointe!)
            : (() => { const c = path.join(UPLOADS_MESSAGERIE_DIR, resolu.piece.pieceJointe!); return fs.existsSync(c) ? fs.readFileSync(c) : null; })();
          if (buffer) {
            await this.accordPrealable.uploadDocument(accordId, type, { originalname: resolu.piece.pieceJointe!, buffer } as Express.Multer.File);
          }
        }

        await this.prisma.accordPrealable.update({
          where: { id: accordId },
          data: {
            statutAnalyseMedicale: "Validée", statutValidationFinanciere: "Validée", decision: "Accordé", montantAutorise,
            motifDecision: `Montant autorisé calculé selon le plafond de la garantie ${dossier.type} et le tarif de référence de l'acte.`,
            dateDecision: aujourdhuiFr(),
          },
        });
        const compteAssure = await this.prisma.user.findUnique({ where: { assureSanteId: dossier.assureId } });
        if (compteAssure) {
          await this.notifications.create("Assuré", compteAssure.id, `Votre demande de prise en charge (${accordId}) a été accordée.`).catch(() => undefined);
        }
        await this.notifierAgentsHumains(conversationId, `Demande de garantie (${dossier.type}) décidée automatiquement par ${NOM_AGENT} pour le dossier ${accordId} : ${montantAutorise} FCFA autorisés. Prestataire et identité du patient vérifiés.`);
        await this.envoyerCertificatDansConversation(conversationId, accordId);

        return {
          decision: "Accordé", montantAutorise,
          message: `Votre demande a été accordée pour un montant de ${montantAutorise} FCFA, calculé selon le plafond de votre garantie et le tarif de référence de l'acte. Je vous transmets votre certificat de prise en charge.`,
        };
      }
      case "escalader_vers_humain": {
        await this.escalader(conversationId, String(args.motif ?? `Escaladé par ${NOM_AGENT}.`));
        return { ok: true };
      }
      case "cloturer_conversation_resolue": {
        const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) return { erreur: "Conversation introuvable." };
        // Garde-fous côté serveur (2026-09) — jamais fait confiance au seul
        // jugement du modèle : une conversation escaladée, ou déjà reprise
        // par un agent humain (même filtre que MessagerieService.
        // envoyerMessage), ne peut jamais être close comme "résolue par IA
        // seule" — voir demande utilisateur : le rapport ne doit exister
        // QUE quand Ariana a vraiment géré la demande de bout en bout.
        if (conversation.statut === "EnCoursHumain") return { erreur: "Cette conversation a déjà été transmise à un conseiller — elle ne peut pas être close comme résolue par IA seule." };
        const dejaAssistee = await this.prisma.message.count({ where: { conversationId, auteurType: "Agent" } });
        if (dejaAssistee > 0) return { erreur: "Un conseiller est déjà intervenu sur cette conversation — elle ne peut pas être close comme résolue par IA seule." };
        const resume = String(args.resume ?? "").trim();
        if (!resume) return { erreur: "Résumé manquant." };
        const demandeur = await this.prisma.user.findUnique({ where: { id: conversation.demandeurId } });
        await this.prisma.$transaction([
          this.prisma.conversation.update({ where: { id: conversationId }, data: { statut: "Resolue" } }),
          this.prisma.rapportConversationIA.create({
            data: { conversationId, societeId: conversation.societeId, demandeurNom: demandeur?.nom ?? "Inconnu", objet: conversation.objet, resume },
          }),
        ]);
        // Apprentissage anonymisé (déjà existant, voir apprendreDeLaResolution)
        // — jusqu'ici jamais réellement déclenché faute d'écran appelant
        // changerStatut("Resolue") ; cet outil l'active enfin pour de vrai.
        this.apprendreDeLaResolution(conversationId).catch(() => undefined);
        return { ok: true };
      }
      default:
        return { erreur: `Outil inconnu: ${nom}` };
    }
  }

  private async notifierAgentsHumains(conversationId: string, message: string) {
    const destinataires = await this.prisma.user.findMany({ where: { roleId: { in: ROLES_MESSAGERIE_NOTIFIEES } }, select: { id: true } });
    await Promise.all(destinataires.map((u) => this.notifications.create("Gestionnaire", u.id, `[${conversationId}] ${message}`).catch(() => undefined)));
  }

  private async escalader(conversationId: string, motif: string) {
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { statut: "EnCoursHumain", updatedAt: new Date() } });
    await this.notifierAgentsHumains(conversationId, `Conversation escaladée par ${NOM_AGENT} — ${motif}`);
  }

  // Pièces jointes d'UN dossier précis dans une conversation potentiellement
  // réutilisée pour plusieurs demandes successives (2026-08 — bug trouvé en
  // testant traiter_demande_garantie : demarrerDemandeHospitalisation/
  // demarrerDemandeGarantie réutilisent la conversation "EnCoursIA" déjà
  // ouverte d'un même demandeur plutôt que d'en recréer une — un simple
  // "premier/dernier fichier envoyé dans la conversation" attacherait alors
  // les pièces d'un dossier déjà décidé au dossier suivant). On s'ancre sur
  // le message-modèle qu'envoie demarrerDemandeX, qui cite toujours
  // littéralement l'accordId ("... dossier ${accord.id}") : seules les
  // pièces envoyées PAR L'UTILISATEUR après ce message précis comptent pour
  // CE dossier. Sans ancrage trouvé (dossier créé par un autre chemin), on
  // retombe sur l'historique complet — comportement d'avant ce correctif.
  // Résolution unifiée ordonnance/devis (2026-08) — voir demande
  // utilisateur : "l'agent IA n'a toujours pas une vraie lecture des
  // documents... il demande des documents, mais l'assuré a joint des
  // pièces." Une pièce déjà déposée directement sur le dossier
  // (dossier.ordonnanceFichier/devisFichier, formulaire classique du
  // portail) est TOUJOURS prioritaire et ne consomme aucune pièce de chat ;
  // seule une pièce manquante côté dossier retombe sur la prochaine pièce
  // jointe reçue dans CETTE conversation (voir piecesDepuisDemande), dans
  // l'ordre où elles ont été envoyées. Une pièce présente sur le dossier
  // mais dans un format illisible (tableur, Word...) n'est PAS traitée
  // comme absente : elle bloque avec un motif précis, jamais confondue avec
  // "rien n'a été fourni".
  private async resoudrePieces(conversationId: string, accordId: string, dossier: { ordonnanceFichier: string | null; devisFichier: string | null }) {
    const piecesChat = await this.piecesDepuisDemande(conversationId, accordId);
    let curseur = 0;
    type Resolution =
      | { ok: true; source: "dossier" }
      | { ok: true; source: "messagerie"; piece: (typeof piecesChat)[number] }
      | { ok: false; raisonFormatNonSupporte?: string };
    const resoudre = async (nomFichierDossier: string | null): Promise<Resolution> => {
      if (nomFichierDossier) {
        const lecture = await lireFichierJoint(this.storage, "accords-prealables", UPLOADS_DOCS_DIR, nomFichierDossier);
        if (lecture.lisible) return { ok: true, source: "dossier" };
        if (lecture.raison === "format_non_supporte") return { ok: false, raisonFormatNonSupporte: lecture.format };
        // "absente" malgré un nom en base (fichier disparu du disque) : retombe sur le chat ci-dessous.
      }
      const piece = piecesChat[curseur];
      if (!piece) return { ok: false };
      curseur += 1;
      return { ok: true, source: "messagerie", piece };
    };
    return { ordonnance: await resoudre(dossier.ordonnanceFichier), devis: await resoudre(dossier.devisFichier) };
  }

  private async piecesDepuisDemande(conversationId: string, accordId: string) {
    const ancrage = await this.prisma.message.findFirst({
      where: { conversationId, auteurType: "IA", contenu: { contains: accordId } },
      orderBy: { dateEnvoi: "asc" },
    });
    return this.prisma.message.findMany({
      where: {
        conversationId,
        auteurType: "Utilisateur",
        pieceJointe: { not: null },
        ...(ancrage ? { dateEnvoi: { gte: ancrage.dateEnvoi } } : {}),
      },
      orderBy: { dateEnvoi: "asc" },
    });
  }

  // Envoi du certificat dans la conversation (2026-08) — voir demande
  // utilisateur : "et après il envoie le fichier de la prise en charge."
  // Réutilise le MÊME générateur que le bouton "Certificat de prise en
  // charge" déjà existant (DocumentsService.renderCertificatPriseEnCharge,
  // le même document PDF partout dans l'application — pas un document
  // recréé pour l'occasion), en capturant sa sortie dans un buffer au lieu
  // d'un flux HTTP réel (PassThrough se comporte comme le Response attendu
  // pour .setHeader()/.pipe()). Best-effort : une erreur ici ne doit jamais
  // empêcher l'annonce de la décision elle-même à l'interlocuteur.
  private async envoyerCertificatDansConversation(conversationId: string, accordId: string): Promise<void> {
    try {
      const flux = new PassThrough();
      (flux as unknown as { setHeader: (...a: unknown[]) => void }).setHeader = () => undefined;
      const morceaux: Buffer[] = [];
      flux.on("data", (m: Buffer) => morceaux.push(m));
      const termine = new Promise<Buffer>((resolve, reject) => {
        flux.on("end", () => resolve(Buffer.concat(morceaux)));
        flux.on("error", reject);
      });
      await this.documents.renderCertificatPriseEnCharge(accordId, flux as unknown as Response, { id: null, nom: `${NOM_AGENT} (décision automatique)`, roleId: "assure_principal" });
      const buffer = await termine;

      const nomFichier = `${accordId}-certificat-${Date.now()}.pdf`;
      if (this.storage.actif) {
        await this.storage.upload("messagerie", nomFichier, buffer, "application/pdf");
      } else {
        await fs.promises.mkdir(UPLOADS_MESSAGERIE_DIR, { recursive: true });
        await fs.promises.writeFile(path.join(UPLOADS_MESSAGERIE_DIR, nomFichier), buffer);
      }
      await this.prisma.message.create({
        data: { conversationId, auteurId: null, auteurType: "IA", contenu: "Voici votre certificat de prise en charge.", pieceJointe: nomFichier },
      });
    } catch (err) {
      this.logger.error(`Envoi du certificat impossible pour ${accordId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Déclenchement automatique (2026-08) — voir demande utilisateur : "dès
  // qu'une nouvelle demande Hospitalisation est créée depuis le portail,
  // ouvrir/relancer automatiquement une conversation IA qui demande
  // directement les deux pièces à l'assuré, plutôt que d'attendre qu'il
  // pense à écrire lui-même." Appelé par PortailMembreController.
  // creerAccordPrealable juste après la création d'un dossier Hospitalisation
  // déposé depuis ce portail — best-effort, ne doit jamais faire échouer la
  // création du dossier (voir appel en .catch()).
  //
  // RÉVISÉ (2026-08) — voir demande utilisateur : "l'agent IA doit savoir
  // s'adapter aux questions... l'agent IA n'a toujours pas une vraie
  // lecture des documents qui ont été joints à la demande... il demande des
  // documents, mais l'assuré a joint des pièces." Le message figé
  // "envoyez-moi d'abord X puis Y" a été retiré : il ignorait totalement
  // qu'un dossier peut arriver DÉJÀ pourvu de son ordonnance/devis (déposés
  // via le formulaire classique du portail). On ne poste plus qu'un accusé
  // factuel court (nécessaire comme ancrage pour piecesDepuisDemande/
  // resoudrePieces), puis on laisse repondre() composer la VRAIE première
  // réponse via une amorce éphémère qui pousse l'IA à vérifier le dossier
  // réel (verifier_dossier_entente_prealable, qui lit maintenant les pièces
  // pour de vrai) avant de dire quoi que ce soit sur ce qui manque.
  async demarrerDemandeHospitalisation(userId: string, accord: { id: string; prestataire: string }): Promise<void> {
    const demandeur = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!demandeur) return;

    // Réutilise une conversation IA déjà ouverte pour ce demandeur plutôt
    // que d'en multiplier — un assuré avec plusieurs échanges en cours
    // garde une seule file de discussion avec Ariana.
    const existante = await this.prisma.conversation.findFirst({
      where: { demandeurId: userId, canal: "IA", statut: "EnCoursIA" },
      orderBy: { updatedAt: "desc" },
    });

    let conversationId: string;
    if (existante) {
      conversationId = existante.id;
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    } else {
      const conversation = await this.prisma.conversation.create({
        data: { objet: `Prise en charge — Hospitalisation (${accord.id})`, demandeurId: userId, demandeurRole: demandeur.roleId, canal: "IA", statut: "EnCoursIA" },
      });
      conversationId = conversation.id;
    }

    // Même règle de présentation que repondre() : ne se représente qu'au
    // tout premier message de la conversation.
    const dejaSalue = existante ? (await this.prisma.message.count({ where: { conversationId, auteurType: "IA" } })) > 0 : false;
    const contenu = `${dejaSalue ? "" : `${GREETING_PREMIER_TOUR} `}Nouvelle demande de prise en charge enregistrée : dossier ${accord.id} (Hospitalisation) auprès de ${accord.prestataire}.`;
    await this.prisma.message.create({ data: { conversationId, auteurId: null, auteurType: "IA", contenu } });
    await this.notifications.create("Assuré", userId, `${NOM_AGENT} vous a écrit au sujet de votre demande de prise en charge (${accord.id}).`).catch(() => undefined);
    await this.repondre(
      conversationId,
      `[Système, jamais à répéter tel quel] Un nouveau dossier Hospitalisation vient d'être créé : ${accord.id}, auprès de ${accord.prestataire}. Avant de t'adresser à l'interlocuteur, vérifie ce dossier avec verifier_dossier_entente_prealable pour savoir si la déclaration d'hospitalisation et le devis ont déjà été déposés directement dessus — si oui, ne les redemande surtout pas, dis plutôt où en est le traitement (et essaie de le trancher si tu as tout ce qu'il faut) ; si un format n'est pas lisible, dis-le précisément ; sinon indique clairement ce qu'il te manque. Adresse-toi directement et chaleureusement à l'interlocuteur.`,
    ).catch((err) => this.logger.error(`Erreur au démarrage de la demande ${accord.id}: ${err instanceof Error ? err.message : err}`));
  }

  // Pendant utilitaire de demarrerDemandeHospitalisation, pour les demandes
  // de garantie plafonnée (Dentisterie/Optique/Kinésithérapie & Cure
  // thermale/Maternité/Transport/Autre) déposées par un assuré depuis le
  // Portail Membre — voir demande utilisateur (2026-08) : "L'assuré...
  // joints le devis et la prescription (ordonnance)". Même mécanique que
  // ci-dessus (accusé factuel + amorce vers repondre(), voir sa doc), seule
  // différence : la pièce demandée en premier est l'ORDONNANCE (pas la
  // déclaration d'hospitalisation).
  async demarrerDemandeGarantie(userId: string, accord: { id: string; type: string; prestataire: string }): Promise<void> {
    const demandeur = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!demandeur) return;

    const existante = await this.prisma.conversation.findFirst({
      where: { demandeurId: userId, canal: "IA", statut: "EnCoursIA" },
      orderBy: { updatedAt: "desc" },
    });

    let conversationId: string;
    if (existante) {
      conversationId = existante.id;
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    } else {
      const conversation = await this.prisma.conversation.create({
        data: { objet: `Prise en charge — ${accord.type} (${accord.id})`, demandeurId: userId, demandeurRole: demandeur.roleId, canal: "IA", statut: "EnCoursIA" },
      });
      conversationId = conversation.id;
    }

    const dejaSalue = existante ? (await this.prisma.message.count({ where: { conversationId, auteurType: "IA" } })) > 0 : false;
    const contenu = `${dejaSalue ? "" : `${GREETING_PREMIER_TOUR} `}Nouvelle demande de prise en charge enregistrée : dossier ${accord.id} (${accord.type}) auprès de ${accord.prestataire}.`;
    await this.prisma.message.create({ data: { conversationId, auteurId: null, auteurType: "IA", contenu } });
    await this.notifications.create("Assuré", userId, `${NOM_AGENT} vous a écrit au sujet de votre demande de prise en charge (${accord.id}).`).catch(() => undefined);
    await this.repondre(
      conversationId,
      `[Système, jamais à répéter tel quel] Un nouveau dossier ${accord.type} vient d'être créé : ${accord.id}, auprès de ${accord.prestataire}. Avant de t'adresser à l'interlocuteur, vérifie ce dossier avec verifier_dossier_entente_prealable pour savoir si l'ordonnance et le devis ont déjà été déposés directement dessus — si oui, ne les redemande surtout pas, dis plutôt où en est le traitement (et essaie de le trancher si tu as tout ce qu'il faut) ; si un format n'est pas lisible, dis-le précisément ; sinon indique clairement ce qu'il te manque. Adresse-toi directement et chaleureusement à l'interlocuteur.`,
    ).catch((err) => this.logger.error(`Erreur au démarrage de la demande ${accord.id}: ${err instanceof Error ? err.message : err}`));
  }

  // Point d'entrée (2026-08) — appelé par MessagerieService après chaque
  // message d'un demandeur externe dans une conversation canal="IA" encore
  // active (pas déjà escaladée). Best-effort et silencieux : sans clé API
  // configurée, ou en cas d'erreur d'appel, la conversation reste ouverte
  // sans réponse automatique jusqu'à ce qu'un agent humain la prenne en
  // charge — ne doit jamais faire échouer l'envoi du message lui-même
  // (voir MessagerieService.envoyerMessage/creer, appel en .catch()).
  // amorce (2026-08) — voir demande utilisateur : "l'agent doit savoir
  // s'adapter... et vérifier les pièces déjà jointes plutôt que de
  // redemander à l'identique." Un tour "système" ÉPHÉMÈRE (jamais persisté
  // en base, jamais visible tel quel) ajouté juste pour CET appel, pour
  // donner à l'IA un déclencheur à traiter par elle-même (dossier créé,
  // vérifie-le avant de parler) au lieu du message figé qu'on postait
  // avant. Remplace l'ancien pattern "message TEMPLATE" de
  // demarrerDemandeHospitalisation/demarrerDemandeGarantie.
  async repondre(conversationId: string, amorce?: string): Promise<void> {
    const client = this.getClient();
    if (!client) { this.logger.debug("ANTHROPIC_API_KEY non configurée — pas de réponse IA automatique."); return; }

    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.canal !== "IA" || conversation.statut === "EnCoursHumain" || conversation.statut === "Resolue" || conversation.statut === "Fermee") return;

    const demandeur = await this.prisma.user.findUnique({ where: { id: conversation.demandeurId } });
    if (!demandeur) return;
    // Nom réel de la société de CETTE conversation (2026-09) — voir
    // OutilContexte.nomEntreprise. Résolu directement depuis
    // conversation.societeId (déjà en main, jamais depuis TenantContext :
    // repondre() est lancée en tâche de fond, fire-and-forget, depuis
    // MessagerieService — l'AsyncLocalStorage de la requête d'origine n'est
    // pas une garantie fiable à ce stade). Repli sur "MedAssur" si la ligne
    // n'existe pas ou n'a pas de nom — comportement historique inchangé
    // pour la société bootstrap et tout contexte sans société.
    const parametres = await this.prisma.parametresEntreprise.findUnique({ where: { id: conversation.societeId ?? "societe-bootstrap" } });
    const nomEntreprise = parametres?.nom?.trim() || "MedAssur";
    const ctx: OutilContexte = {
      demandeurId: demandeur.id, demandeurRole: demandeur.roleId, assureSanteId: demandeur.assureSanteId,
      prestataireId: demandeur.prestataireId, nomEntreprise, societeId: conversation.societeId,
    };

    const historique = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { dateEnvoi: "asc" } });
    // Pièces jointes lues réellement (2026-08, "OCR" — voir en-tête du
    // fichier) : une image/PDF envoyée par l'interlocuteur est transmise
    // au modèle sous forme de bloc image/document, pas seulement signalée
    // par un texte de remplacement — l'IA peut donc vraiment répondre sur
    // ce qui y est écrit (montant, date, prestataire...).
    const messages: Anthropic.MessageParam[] = await Promise.all(historique.map(async (m) => {
      const bloc = m.pieceJointe ? await blocDePieceJointe(this.storage, m.pieceJointe) : null;
      if (!bloc) return { role: m.auteurType === "IA" ? "assistant" : "user", content: m.contenu || "(message sans texte, pièce jointe envoyée)" } as Anthropic.MessageParam;
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.contenu) content.push({ type: "text", text: m.contenu });
      content.push(bloc);
      return { role: m.auteurType === "IA" ? "assistant" : "user", content } as Anthropic.MessageParam;
    }));
    if (amorce) messages.push({ role: "user", content: amorce });

    const outils = this.outilsDisponibles(ctx);
    try {
      let tour = 0;
      // Plafond de tours d'appels d'outils (2026-09) — voir demande
      // utilisateur : "l'agent IA ne part pas au bout des échanges... il
      // doit parcourir toutes les données existantes." L'ancien plafond (5)
      // coupait le tour en PLEIN SILENCE dès qu'une question exigeait plus
      // de recherches (garanties + contrat + consommation + dossiers +
      // remboursements dépasse vite 5 appels) — relevé largement, et surtout
      // le dépassement du plafond n'est plus jamais silencieux (voir
      // filet de sécurité après la boucle).
      const PLAFOND_TOURS = 20;
      while (tour < PLAFOND_TOURS) {
        tour += 1;
        const reponse = await client.messages.create({
          model: "claude-sonnet-5", max_tokens: 1024, system: construireSystemPrompt(nomEntreprise), tools: outils, messages,
        });

        const blocsTexte = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        const blocsOutils = reponse.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

        if (blocsTexte) {
          await this.prisma.message.create({ data: { conversationId, auteurId: null, auteurType: "IA", contenu: blocsTexte } });
          await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
          // Notification système (2026-09) — voir demande utilisateur :
          // "informé des nouvelles entrées même quand il n'est pas dans
          // l'application". `demandeur` = propriétaire de CETTE conversation
          // (son propre compte), jamais un tiers.
          this.pushNotifications.envoyerAUtilisateur(demandeur.id, nomEntreprise, blocsTexte.slice(0, 180), { conversationId }).catch(() => undefined);
        }

        if (reponse.stop_reason !== "tool_use" || blocsOutils.length === 0) return;

        messages.push({ role: "assistant", content: reponse.content });
        const resultats: Anthropic.ToolResultBlockParam[] = [];
        for (const bloc of blocsOutils) {
          const resultat = await this.executerOutil(bloc.name, (bloc.input as Record<string, unknown>) ?? {}, ctx, conversationId);
          // __blocsBruts (2026-08) — voir verifier_dossier_entente_prealable :
          // certains outils renvoient, EN PLUS du JSON habituel, le contenu
          // réel (image/PDF) d'une pièce déjà déposée sur le dossier. Un
          // tool_result peut légitimement contenir plusieurs blocs (texte +
          // image/document — supporté nativement par l'API Messages), donc
          // on les place DANS ce même tool_result plutôt que d'inventer un
          // second message. Uniquement pour un résultat-objet (jamais un
          // tableau, ex. consulter_garanties/consulter_mes_dossiers_entente_
          // prealable — un spread sur un tableau en ferait un objet indexé,
          // cassant leur sérialisation JSON habituelle).
          let contenuResultat: Anthropic.ToolResultBlockParam["content"];
          if (resultat && typeof resultat === "object" && !Array.isArray(resultat) && "__blocsBruts" in resultat) {
            const { __blocsBruts, ...resteResultat } = resultat as Record<string, unknown> & {
              __blocsBruts?: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam)[];
            };
            contenuResultat = __blocsBruts && __blocsBruts.length > 0 ? [{ type: "text", text: JSON.stringify(resteResultat) }, ...__blocsBruts] : JSON.stringify(resteResultat);
          } else {
            contenuResultat = JSON.stringify(resultat);
          }
          resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: contenuResultat });
          if (bloc.name === "escalader_vers_humain") {
            // Accusé de réception systématique (2026-08 — trouvé en testant
            // le déclenchement prestataire) : escalader() ne notifie que les
            // gestionnaires, jamais l'interlocuteur lui-même — un tour où le
            // modèle appelle escalader_vers_humain SANS texte d'accompagnement
            // laissait la personne sans aucune réponse visible, alors que sa
            // demande avait bien été transmise. Filet de sécurité seulement :
            // le prompt système continue de demander un texte avant d'escalader.
            if (!blocsTexte) {
              const texteAccuse = `Je transmets votre demande à un conseiller ${nomEntreprise}, qui reviendra vers vous avec le détail.`;
              await this.prisma.message.create({
                data: { conversationId, auteurId: null, auteurType: "IA", contenu: texteAccuse },
              });
              this.pushNotifications.envoyerAUtilisateur(demandeur.id, nomEntreprise, texteAccuse, { conversationId }).catch(() => undefined);
            }
            messages.push({ role: "user", content: resultats });
            return;
          }
        }
        messages.push({ role: "user", content: resultats });
      }
      // Filet de sécurité (2026-09) — voir demande utilisateur : "il ne
      // doit pas arrêter de converser". Si le plafond de tours est atteint
      // SANS qu'une réponse finale n'ait été envoyée (le modèle voulait
      // encore appeler un outil), la personne ne doit jamais se retrouver
      // sans aucune réponse visible — jamais un silence total, même dans
      // ce cas limite. Le dossier reste consultable au prochain message :
      // on n'escalade pas automatiquement ici, on tient juste la personne
      // informée que la recherche continue.
      await this.prisma.message.create({
        data: { conversationId, auteurId: null, auteurType: "IA", contenu: `Je continue à vérifier votre dossier en détail, je reviens vers vous très vite avec une réponse précise.` },
      });
      this.pushNotifications.envoyerAUtilisateur(demandeur.id, nomEntreprise, "Je continue à vérifier votre dossier, je reviens vers vous très vite.", { conversationId }).catch(() => undefined);
    } catch (err) {
      this.logger.error(`Erreur agent IA sur la conversation ${conversationId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // "Apprentissage" à partir de la gestion réelle (2026-09) — voir demande
  // utilisateur : "qu'elle apprenne de la gestion qui se fera dans
  // l'application... que cela affine sa capacité à interagir avec les
  // assurés, les souscripteurs, les prestataires". Ariana (API Claude) ne
  // se réentraîne pas — ceci est une mémoire de CAS RÉSOLUS, consultée par
  // le même outil que la réglementation (consulter_base_connaissance_
  // assurance, voir rechercherBaseConnaissance), pas un modèle qui change.
  // Déclenché à la clôture d'une conversation (voir MessagerieService.
  // changerStatut → statut "Resolue"), fire-and-forget, jamais bloquant
  // pour le workflow de clôture appelant. Le résumé est VOLONTAIREMENT une
  // généralisation du TYPE de situation (jamais les données personnelles
  // du dossier — nom, téléphone, numéro de dossier) : ce n'est pas un
  // export des conversations, seulement une leçon réutilisable pour un cas
  // similaire futur.
  async apprendreDeLaResolution(conversationId: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    try {
      const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) return;
      const messages = await this.prisma.message.findMany({ where: { conversationId }, orderBy: { dateEnvoi: "asc" } });
      // Pas assez de substance pour en tirer une vraie leçon (ex. juste un
      // accusé de réception jamais discuté davantage).
      if (messages.length < 3) return;

      const transcript = messages.map((m) => `${m.auteurType === "IA" ? "Conseiller" : "Interlocuteur"}: ${m.contenu || "(pièce jointe)"}`).join("\n");
      const reponse = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: "Tu résumes une conversation de service client en assurance santé pour en tirer une leçon générale et réutilisable. RÈGLES STRICTES : jamais de nom propre, numéro de téléphone, numéro de dossier ou toute autre donnée identifiante — généralise le TYPE de situation (ex. \"un assuré signale un document erroné joint à sa demande d'entente préalable\" plutôt que le nom réel). 2 à 3 phrases maximum : (1) le type de situation/demande, (2) comment elle a été traitée, (3) le point d'attention à retenir pour un cas similaire. Réponds uniquement par ce résumé, sans préambule.",
        messages: [{ role: "user", content: transcript.slice(0, 6000) }],
      });
      const resume = reponse.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ").trim();
      if (!resume || resume.length < 20) return;

      await this.prisma.arianaConnaissance.create({
        data: {
          categorie: "CasResolu",
          source: "Conversation résolue",
          titre: `Cas résolu — ${conversation.objet}`.slice(0, 190),
          contenu: resume,
          societeId: conversation.societeId,
        },
      });
    } catch (err) {
      this.logger.warn(`Apprentissage post-résolution échoué pour ${conversationId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
