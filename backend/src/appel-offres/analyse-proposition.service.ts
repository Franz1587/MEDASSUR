import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CotationService } from "../cotation/cotation.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import type { ContenuOffre, SectionGaranties, TableauGaranties } from "../cotation/contenu-offre";

// Lecture des propositions de compagnies par ARIANA (2026-10) — voir
// demande utilisateur : « Ariana doit lire en OCR ultra puissant les
// différentes propositions des compagnies d'assurance… lorsqu'on va
// importer, elle pourra automatiquement générer l'offre selon les modèles
// avec exactitude ». Vision native de Claude sur le PDF (scans compris),
// sortie JSON contrainte par schéma, puis une Cotation par option chiffrée
// (contenuOffre = tout ce que la page « Proposition » et le tableau de
// garanties de l'offre LA RUCHE impriment). Rien n'est deviné : un montant
// illisible reste vide et est signalé dans `remarques` pour relecture.

const UPLOADS_APPEL_OFFRES_DIR = path.join(UPLOADS_ROOT, "appel-offres");
const MEDIA_IMAGES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
};
// Carte d'assuré facturée par personne dans le décompte LA RUCHE (75 pers.
// → 187 500, 702 pers. → 1 755 000 dans les offres de référence).
export const TARIF_CARTE_DEFAUT = 2500;
// Accessoires appliqués par le courtier quand la compagnie les laisse « en
// sus » sans les chiffrer (50 000 F CFA dans les offres de référence).
export const ACCESSOIRES_DEFAUT = 50000;

// L'API limite les schémas à 16 champs « nullable » : une valeur absente
// est donc rendue "" (texte) ou 0 (nombre), puis ramenée à null par sansVides().
const NUL = (t: object) => t;
const STR = { type: "string" }, NUM = { type: "number" };
const LIGNE = { type: "object", additionalProperties: false, required: ["libelle", "taux", "plafond"], properties: { libelle: STR, taux: NUL(STR), plafond: NUL(STR) } };
const SECTION = { type: "object", additionalProperties: false, required: ["titre", "plafondCommun", "lignes"], properties: { titre: NUL(STR), plafondCommun: NUL(STR), lignes: { type: "array", items: LIGNE } } };
const TABLEAU = {
  type: "object", additionalProperties: false,
  required: ["style", "titreColonneGaranties", "titreColonneTaux", "territorialite", "tauxAmbulatoire", "tauxHospitalisation", "titreCollege", "sections", "piedTableau"],
  properties: {
    style: { type: "string", enum: ["grille", "colonnes"] }, titreColonneGaranties: NUL(STR), titreColonneTaux: NUL(STR),
    territorialite: STR, tauxAmbulatoire: NUL(STR), tauxHospitalisation: NUL(STR), titreCollege: NUL(STR),
    sections: { type: "array", items: SECTION }, piedTableau: NUL(STR),
  },
};
const PROPOSITION = {
  type: "object", additionalProperties: false,
  required: ["branche", "libelleOption", "territorialite", "tauxAmbulatoire", "tauxHospitalisation", "population", "titre", "designationRecap", "libelleComparatif",
    "garanties", "limites", "mentionsFraisReels", "tableau", "plafondFamilial", "limiteAgeAdulte", "limiteAgeEnfant", "primeNette", "primeParPersonne", "primeCommuniquee",
    "accessoires", "taxeCompagnie", "primeTTCCompagnie", "primeNonCommuniquee", "remarques"],
  properties: {
    branche: { type: "string", enum: ["Maladie", "Assistance"] }, libelleOption: STR, territorialite: STR,
    tauxAmbulatoire: NUL(STR), tauxHospitalisation: NUL(STR), population: NUL({ type: "integer" }),
    titre: { type: "array", items: STR }, designationRecap: { type: "array", items: STR }, libelleComparatif: STR,
    garanties: { type: "array", items: STR },
    limites: { type: "array", items: { type: "object", additionalProperties: false, required: ["texte", "detail"], properties: { texte: STR, detail: NUL(STR) } } },
    mentionsFraisReels: { type: "boolean" }, tableau: NUL(TABLEAU),
    plafondFamilial: NUL(NUM), limiteAgeAdulte: NUL({ type: "integer" }), limiteAgeEnfant: NUL({ type: "integer" }),
    primeNette: NUL(NUM), primeParPersonne: NUL(NUM), primeCommuniquee: NUL(NUM), accessoires: NUL(NUM), taxeCompagnie: NUL(NUM), primeTTCCompagnie: NUL(NUM),
    primeNonCommuniquee: { type: "boolean" }, remarques: NUL(STR),
  },
};
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["compagnie", "client", "dateProposition", "propositions"],
  properties: { compagnie: STR, client: STR, dateProposition: NUL(STR), propositions: { type: "array", items: PROPOSITION } },
};

interface PropositionLue {
  branche: "Maladie" | "Assistance"; libelleOption: string; territorialite: string;
  tauxAmbulatoire: string | null; tauxHospitalisation: string | null; population: number | null;
  titre: string[]; designationRecap: string[]; libelleComparatif: string; garanties: string[];
  limites: { texte: string; detail: string | null }[]; mentionsFraisReels: boolean; tableau: TableauGaranties | null;
  plafondFamilial: number | null; limiteAgeAdulte: number | null; limiteAgeEnfant: number | null;
  primeNette: number | null; primeParPersonne: number | null; primeCommuniquee: number | null; accessoires: number | null;
  taxeCompagnie: number | null; primeTTCCompagnie: number | null; primeNonCommuniquee: boolean; remarques: string | null;
}
interface LectureProposition { compagnie: string; client: string; dateProposition: string | null; propositions: PropositionLue[] }

// Conventions de rédaction des offres LA RUCHE, tirées des trois offres de
// référence (LAY PRO, BW ENERGY, ETS MSSZ). Texte figé : mis en cache.
const CONSIGNES = `Tu es ARIANA, l'assistante IA d'un cabinet de courtage en assurance santé au Gabon (LA RUCHE EXCELLENCE et ses confrères utilisateurs de MEDASSUR+).
On te remet la PROPOSITION (cotation) qu'une compagnie d'assurance (ASSINCO/BGFI, OGAR, AXA, NSIA, SANLAM ALLIANZ, SUNU…) a envoyée au courtier pour un client entreprise. Le fichier peut être un PDF natif, un scan ou une photo, parfois flou, tamponné ou de travers : lis-le entièrement, page par page, y compris les tableaux, les notes de bas de page et les tampons.

Ta mission : extraire fidèlement chaque proposition chiffrée, puis rédiger les champs de présentation exactement comme le courtier les écrit dans son offre au client.

LECTURE (fidélité absolue)
1. Une entrée dans "propositions" par combinaison option/formule × collège × branche qui possède sa propre prime ou son propre tableau. Maladie et Assistance = deux entrées distinctes. Plusieurs territorialités, taux ou collèges = une entrée chacun, dans l'ordre du document.
2. Montants en FCFA, nombres entiers sans séparateur (32 374 701 → 32374701). primeNette = prime nette TOTALE de l'option pour toute la population. primeParPersonne = prime nette par personne (écrite, ou primeNette / population si seul le total est donné). accessoires = accessoires / frais de police de la compagnie. taxeCompagnie et primeTTCCompagnie = ce que la compagnie a écrit (pour contrôle). primeCommuniquee = prime par personne AVANT une réduction commerciale si le document en montre une, sinon 0.
3. Prime absente (« non communiquée », à définir…) → primeNonCommuniquee = true et montants à 0.
4. Ne JAMAIS inventer. Une valeur illisible ou absente vaut "" (texte) ou 0 (nombre) — jamais une valeur supposée. Toute incertitude (chiffre flou, rature, tampon sur un montant, total incohérent avec le détail) est décrite dans "remarques" (français, phrases courtes) ; sinon remarques = "".
5. Tableau de garanties : TOUTES les lignes, dans l'ordre, libellé / taux / plafond tels qu'écrits (corrige seulement les erreurs d'OCR évidentes et la casse aberrante). Taux privé/public distincts → "80% / 100%" dans taux. Une rubrique dont toutes les lignes partagent un même plafond → ce plafond dans plafondCommun et plafond = "" sur les lignes. Les lignes « plafond par famille », limite d'âge, délais de carence, exclusions, observations figurant DANS le tableau restent des lignes.

RÉDACTION AU FORMAT DE L'OFFRE (le client s'appelle {CLIENT})
- titre (bandeau de la page Proposition), Maladie : ["PROPOSITION SANTE {CLIENT} :", "<TERRITORIALITE EN MAJUSCULES>", "<taux ambulatoire> Ambulatoires &", "<taux hospitalisation, avec une espace avant %> hospitalisations"]. Ex. ["PROPOSITION SANTE LAY PRO :", "GABON UNIQUEMENT", "80% Ambulatoires &", "100 % hospitalisations"]. Assistance : ["PROPOSITION", "ASSISTANCE"].
- designationRecap (ligne du récapitulatif, 2 lignes imprimées) : ["Maladie {CLIENT} : <Territorialité> - <amb>", "Frais médicaux & <hosp> Hospitalisations"]. Ex. ["Maladie LAY PRO : Gabon uniquement - 80%", "Frais médicaux & 100% Hospitalisations"]. Assistance : ["Assistance"].
- libelleComparatif : "{CLIENT} - <Territorialité> (<amb> / <hosp>)", ex. "LAY PRO - Gabon uniquement (80% / 100%)" ; Assistance : "{CLIENT} - Assistance". Deux compagnies proposant la même formule doivent produire exactement le même libellé.
- garanties (puces ➢) : la liste standard du courtier, à garder telle quelle sauf si la compagnie exclut ou ajoute une garantie :
  "Maladie : (consultations, visite, analyses médicales, pharmacie, consultations de spécialistes, sauf les spécialistes soumises à plafond listées ci-après)", "Hospitalisations médicales et chirurgicales", "Prothèses en général (autres que dentaires et optiques)", "Maternité", "Dentisterie (soins dentaires, prothèses, orthodontie, chirurgie dentaire)", "Orthophonie", "Lunetterie", "Cures thermales et massages", "Evacuation sanitaire (intérieur du pays vers Libreville)".
  Assistance : les prestations d'assistance listées par la compagnie (ex. "Transport sanitaire", "Transport du corps en cas de décès du bénéficiaire", "Retour après convalescence", "Accompagnement du bénéficiaire", "Voyage en cas de décès d’un proche parent", "Billet de visite", "Frais d’avocat", "Avance de caution pénale").
- limites (rubrique « Limite de garantie », Maladie seulement), reformulées à partir des conditions RÉELLES de la compagnie, dans ce style :
  {"texte": "Le plafond de remboursement est fixé à 50.000.000 FCFA par famille et par année d’assurance y compris rechutes et séquelles."} (montant à points),
  {"texte": "Exclusion des antériorités, des bilans de santé et pandémie/ épidémie."}, {"texte": "Exclusion du Covid, sauf surprime de 15%"}, {"texte": "Clause d’ajustement semestriel"}, {"texte": "Limite d’âge fixée à 65 ans"},
  {"texte": "Cette cotation est ferme sous réserve de :", "detail": "L’examen des bulletins d’adhésion par le médecin conseil de la compagnie et la souscription d’un autre risque au moins"}.
  Quand la compagnie détaille ses exclusions, délais de carence ou surprimes d'âge, reprends son texte (ex. "Exclusions : les Maladies préexistantes - …", "Délais d’attente ou de carence : …", "Adulte : 65 ans (Au-delà : …). Enfants : 21 ans"). N'ajoute aucune condition que la compagnie n'a pas écrite.
- mentionsFraisReels = true pour la Maladie (mentions « FRAIS REELS » et « BTAM » en bas de page), false pour l'Assistance.
- tableau : sections = [] pour l'Assistance sans tableau de garanties. Sinon style "{STYLE}". "grille" = tableau du courtier à bandeaux de rubriques (CONSULTATION / DIVERS, DENTISTERIE, HOSPITALISATION, MATERNITE, OPTIQUE, KINESITHERAPIE & CURE THERMALE / Orthophonie / Orthoptie, TRANSAPORT, MALADIES CHRONIQUES, EVACUATION SANITAIRE…), titreCollege = "TABLEAUX DE GARANTIES COLLEGE <NOM DU COLLÈGE EN MAJUSCULES, CADRES par défaut>", tauxAmbulatoire/tauxHospitalisation renseignés, piedTableau = "LE PLAFOND PAR FAMILLE EST FIXE A <MONTANT EN LETTRES MAJUSCULES> DE F CFA (<montant chiffré à espaces>) PAR AN". "colonnes" = reproduction ligne à ligne du tableau de la compagnie (une seule section sans titre, libellés numérotés comme chez elle : "1) Médecine : …", "2) Pharmacie"…), titreColonneGaranties = "GARANTIES" ou "GARANTIES <COMPAGNIE>", titreColonneTaux = "TAUX" ou "TAUX (privé / public)", piedTableau = "" (le plafond familial devient une ligne). territorialite du tableau en MAJUSCULES.
- Les montants dans les textes s'écrivent comme le courtier : "350 000 F CFA", "65 000 F CFA / jour", "200 000 F CFA / 2 ANS".`;

@Injectable()
export class AnalysePropositionService {
  private readonly logger = new Logger(AnalysePropositionService.name);
  private client: Anthropic | null = null;

  constructor(private prisma: PrismaService, private storage: StorageService, private cotations: CotationService) {}

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException("ARIANA indisponible : clé ANTHROPIC_API_KEY non configurée sur le serveur.");
    if (!this.client) this.client = new Anthropic({ apiKey, timeout: 15 * 60 * 1000 });
    return this.client;
  }

  private async lireFichier(fichier: string): Promise<Buffer> {
    if (this.storage.actif) {
      const b = await this.storage.download("appel-offres", fichier);
      if (!b) throw new NotFoundException("Fichier du document introuvable sur le serveur.");
      return b;
    }
    const chemin = path.join(UPLOADS_APPEL_OFFRES_DIR, fichier);
    if (!fs.existsSync(chemin)) throw new NotFoundException("Fichier du document introuvable sur le serveur.");
    return fs.promises.readFile(chemin);
  }

  private async lire(buffer: Buffer, nom: string, client: string, contexte: string, style: string): Promise<LectureProposition> {
    const ext = path.extname(nom).toLowerCase();
    const media = MEDIA_IMAGES[ext];
    const bloc: Anthropic.Beta.BetaContentBlockParam = media
      ? { type: "image", source: { type: "base64", media_type: media, data: buffer.toString("base64") } }
      : ext === ".pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } }
        : (() => { throw new BadRequestException("Format non lisible par ARIANA : importez la proposition en PDF ou en image."); })();
    const consignes = CONSIGNES.replace(/\{CLIENT\}/g, client).replace("{STYLE}", style === "auto"
      ? "grille si la compagnie présente ses garanties par rubriques avec un taux par acte (comme le tableau du courtier), sinon colonnes"
      : style);
    const reponse = await this.getClient().beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: consignes, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [bloc, { type: "text", text: `Client : ${client}.${contexte ? `\nContexte de l'appel d'offres : ${contexte}` : ""}\nLis cette proposition et renvoie le JSON demandé.` }] }],
    }).finalMessage();
    if (reponse.stop_reason === "refusal") throw new ServiceUnavailableException("ARIANA n'a pas pu traiter ce document (refus du modèle). Réessayez ou saisissez la cotation à la main.");
    if (reponse.stop_reason === "max_tokens") throw new ServiceUnavailableException("Document trop volumineux pour une seule lecture : séparez les options en plusieurs fichiers.");
    const texte = reponse.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return sansVides(JSON.parse(texte)) as LectureProposition;
  }

  // Compagnie du document : celle choisie à l'import, sinon celle dont le
  // nom (ou celui de sa compagnie mère) apparaît dans le nom lu par ARIANA.
  private async resoudreCompagnie(compagnieId: string | null, nomLu: string): Promise<string | null> {
    if (compagnieId) return compagnieId;
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
    const lu = norm(nomLu);
    const toutes = await this.prisma.compagnie.findMany({ select: { id: true, nom: true, compagnieMereId: true } });
    const candidates = toutes.filter((c) => !c.compagnieMereId && norm(c.nom) && (lu.includes(norm(c.nom)) || norm(c.nom).includes(lu)));
    return candidates.sort((a, b) => b.nom.length - a.nom.length)[0]?.id ?? null;
  }

  async analyser(appelOffresId: string, documentId: string, userId: string | undefined, options: { style?: string; tarifCarte?: number }) {
    const ao = await this.prisma.appelOffres.findUnique({ where: { id: appelOffresId } });
    if (!ao) throw new NotFoundException(`Appel d'offres ${appelOffresId} introuvable`);
    const doc = await this.prisma.appelOffresDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.appelOffresId !== appelOffresId) throw new NotFoundException("Document introuvable pour cet appel d'offres.");

    const style = ["grille", "colonnes"].includes(options.style ?? "") ? options.style! : "auto";
    const tarifCarte = options.tarifCarte ?? TARIF_CARTE_DEFAUT;
    const contexte = [ao.cahierCharges, ao.garantiesDemandees && `garanties demandées : ${ao.garantiesDemandees}`].filter(Boolean).join(" — ");
    const t0 = Date.now();
    let lecture: LectureProposition;
    try {
      lecture = await this.lire(await this.lireFichier(doc.fichier), doc.nom, ao.clientNom, contexte, style);
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        this.logger.warn(`Lecture ARIANA de "${doc.nom}" échouée (${err.status}) : ${err.message}`);
        if (/credit balance/i.test(err.message)) {
          throw new ServiceUnavailableException("ARIANA est indisponible : le crédit du compte Anthropic est épuisé. Rechargez-le (console Anthropic → Plans & Billing) puis relancez l'analyse.");
        }
        throw new ServiceUnavailableException("ARIANA n'a pas pu lire ce document pour le moment. Réessayez dans quelques instants.");
      }
      throw err;
    }
    this.logger.log(`ARIANA a lu "${doc.nom}" en ${Math.round((Date.now() - t0) / 1000)} s : ${lecture.propositions.length} proposition(s).`);
    if (!lecture.propositions.length) throw new BadRequestException("ARIANA n'a trouvé aucune proposition chiffrée dans ce document.");

    const compagnieId = await this.resoudreCompagnie(doc.compagnieId, lecture.compagnie);
    // Une nouvelle lecture du même document remplace la précédente.
    await this.prisma.cotation.deleteMany({ where: { documentSourceId: doc.id } });
    const creees = [];
    try {
      for (const [ordre, p] of lecture.propositions.entries()) {
        // Lignes vides retirées, libellé manquant → "" (colonnes obligatoires).
        if (p.tableau?.sections) p.tableau.sections = p.tableau.sections.map((s) => ({
          ...s, lignes: (s.lignes ?? []).filter((l) => l.libelle || l.taux || l.plafond).map((l) => ({ ...l, libelle: l.libelle ?? "" })),
        }));
        const population = p.population && p.population > 0 ? p.population : 1;
        const primeNette = p.primeNonCommuniquee ? 0 : p.primeNette ?? (p.primeParPersonne ? p.primeParPersonne * population : 0);
        const contenu: ContenuOffre = {
          titre: p.titre ?? [], designationRecap: p.designationRecap?.length ? p.designationRecap : [p.branche],
          libelleComparatif: p.libelleComparatif ?? `${ao.clientNom} - ${p.branche}`, population,
          garanties: p.garanties ?? [], limites: p.limites ?? [], mentionsFraisReels: !!p.mentionsFraisReels,
          tableau: p.tableau?.sections?.length ? p.tableau : null, primeParPersonne: p.primeParPersonne ?? (primeNette ? Math.round(primeNette / population) : null),
          primeCommuniquee: p.primeCommuniquee, primeNonCommuniquee: p.primeNonCommuniquee, ordre,
        };
        const accessoiresDefaut = !p.primeNonCommuniquee && !p.accessoires;
        const remarques = [p.remarques, accessoiresDefaut && `Accessoires non chiffrés par la compagnie : ${ACCESSOIRES_DEFAUT.toLocaleString("fr-FR")} F CFA appliqués par défaut.`, !p.population && "Population non lue dans le document : à renseigner.", !compagnieId && `Compagnie « ${lecture.compagnie} » non reconnue : à choisir.`]
          .filter(Boolean).join(" ");
        creees.push(await this.cotations.create({
          appelOffresId, compagnieId: compagnieId ?? undefined, branche: p.branche, clientNom: ao.clientNom, population,
          territorialite: p.territorialite ?? p.tableau?.territorialite ?? "", tauxCouvertureAmbulatoire: p.tauxAmbulatoire ?? undefined, tauxCouvertureHospitalisation: p.tauxHospitalisation ?? undefined,
          plafondFamilial: p.plafondFamilial ?? undefined, limiteAgeAdulte: p.limiteAgeAdulte ?? undefined, limiteAgeEnfant: p.limiteAgeEnfant ?? undefined,
          conditionsFermete: p.libelleOption,
          primeNette, montantCartes: p.branche === "Maladie" && !p.primeNonCommuniquee ? population * tarifCarte : 0,
          montantAccessoires: p.primeNonCommuniquee ? 0 : p.accessoires ?? ACCESSOIRES_DEFAUT,
          garanties: lignesGaranties(p.tableau?.sections?.length ? p.tableau : null),
          contenuOffre: { ...contenu, remarques: remarques || null, controleCompagnie: { taxe: p.taxeCompagnie, ttc: p.primeTTCCompagnie } } as unknown as Record<string, unknown>,
          documentSourceId: doc.id,
        }, userId));
      }
    } catch (err) {
      // Tout ou rien : jamais une lecture à moitié enregistrée.
      await this.prisma.cotation.deleteMany({ where: { documentSourceId: doc.id } });
      this.logger.error(`Enregistrement de la lecture de "${doc.nom}" impossible : ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException("ARIANA a lu le document mais une proposition n'a pas pu être enregistrée. Relancez l'analyse ; si le problème persiste, saisissez cette cotation à la main.");
    }
    return { compagnie: lecture.compagnie, compagnieReconnue: !!compagnieId, cotations: creees };
  }
}

// "" et 0 (« absent » dans le schéma) → null ; les listes restent intactes,
// sauf les chaînes vides qui y sont retirées.
function sansVides(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sansVides).filter((x) => x !== null);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sansVides(x)]));
  if (v === "" || v === 0) return null;
  return typeof v === "string" ? v.trim() : v;
}

// Lignes CotationGarantieLigne (écran Cotation existant) dérivées du tableau.
function lignesGaranties(tb: TableauGaranties | null) {
  if (!tb) return [];
  return tb.sections.flatMap((s: SectionGaranties) => s.lignes.map((l) => ({
    categorie: s.titre || "Garanties", libelle: l.libelle ?? "", plafond: l.plafond || s.plafondCommun || "", tauxStructurePrivee: l.taux ?? undefined,
  })));
}
