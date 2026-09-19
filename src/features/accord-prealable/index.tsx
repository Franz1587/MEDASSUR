import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, CheckCircle, XCircle, Plus, FileOutput, ListChecks, ShieldCheck, Paperclip, FileText, Search, Pencil, Hash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { DateInput } from "@/components/shared/DateInput";
import { DerniereModification } from "@/components/shared/DerniereModification";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import {
  getAccordsPrealables, decider, createAccordPrealable, updateAccordPrealable, annulerAccordPrealable, doublonEnCoursDe,
  uploadOrdonnanceAccordPrealable, uploadDevisAccordPrealable, urlDocumentAccordPrealable, prendreAccordPrealable,
  type AccordPrealableUpsertInput, type DoublonEnCoursDossier,
} from "@/services/accordPrealable.service";
import { messageErreur, QueuedOfflineError } from "@/lib/http";
import { useAuth } from "@/auth/AuthContext";
import { UserPlus } from "lucide-react";
import { getAssuresSante } from "@/services/sante.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import { getPrestataires } from "@/services/prestataires.service";
import { getContrats } from "@/services/contrats.service";
import { getLettresCles } from "@/services/lettresCles.service";
import { openCertificatPriseEnCharge } from "@/services/documents.service";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import type { AccordPrealable } from "@/types/accordPrealable";
import type { AssureSante } from "@/types/sante";
import type { ActeMedical } from "@/types/acteMedical";
import type { Prestataire } from "@/types/prestataires";
import type { Contrat } from "@/types/contrats";
import type { LettreCle } from "@/types/lettresCles";
import { CODE_KA, CODE_KC, CODE_K_LOC } from "@/types/lettresCles";

// Montant du devis pour un acte codifié à la lettre clé (2026-08) — la
// codification est paramétrée une fois sur l'acte du catalogue (voir
// Catalogue des actes médicaux) : ici on choisit juste l'acte comme
// d'habitude, le montant est déjà connu (acte.prixDefaut). Seul le cas KC
// est particulier — le devis doit couvrir l'épisode chirurgical complet
// (chirurgien + anesthésiste + bloc), donc la somme des 3 composantes
// dérivées, pas seulement la part du chirurgien (voir FactureSaisie.tsx
// pour la même dérivation appliquée à la facturation réelle).
function montantDevisPourActe(acte: ActeMedical, lettresActives: LettreCle[]): number {
  if (acte.lettreCleCode !== CODE_KC || !acte.coefficient) return acte.prixDefaut;
  const coefKA = acte.coefficient / 2;
  const coefKLoc = acte.coefficient + coefKA;
  const valKA = lettresActives.find((l) => l.code === CODE_KA)?.valeurUnitaire ?? 0;
  const valKLoc = lettresActives.find((l) => l.code === CODE_K_LOC)?.valeurUnitaire ?? 0;
  return acte.prixDefaut + coefKA * valKA + coefKLoc * valKLoc;
}

// Rubriques de garantie à plafond partagé (2026-08) — même liste que
// backend/src/sante/dto/create-facture-ligne.dto.ts RUBRIQUES_PLAFONNEES :
// leur calcul dépend de la consommation déjà engagée par l'assuré sur la
// fenêtre du contrat, non reproductible dans un aperçu client — affichées
// "—" plutôt qu'un chiffre trompeur, le vrai calcul se fait côté serveur au
// moment de trancher le dossier (AccordPrealableService.calculerMontantSuggere).
const RUBRIQUES_PLAFONNEES = ["Dentisterie", "Optique", "Kinésithérapie & Cure thermale", "Maternité", "Transport", "Autre"];

function parseTauxPourcent(texte?: string | null): number | null {
  if (!texte) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*%?/.exec(texte);
  return m ? Number(m[1].replace(",", ".")) : null;
}

// Quote-part d'UNE ligne d'acte — réplique de SanteService.
// calculerPartAssuranceLigne/tauxParSecteur (backend, LE moteur qui fait
// réellement foi, même principe que la saisie de Facture) : le taux
// applicable dépend du secteur (Public/Privé) du prestataire ET de la
// rubrique de garantie de CET acte (ambulatoire vs hospitalisation), avec
// un taux ayant droit distinct si le contrat en prévoit un et que l'assuré
// n'est pas l'assuré principal (voir demande utilisateur : "le taux doit
// être fonction de l'acte et de sa rubrique" / "vraiment en option"). Le
// remboursement reste plafonné au tarif de référence de l'acte
// (plafondReference, figé à la saisie). Renvoie {remb: null, reste: null}
// quand le calcul n'est pas reproductible ici (rubrique plafonnée, secteur
// ou taux du contrat inconnus) — aperçu volontairement silencieux plutôt
// que trompeur, la valeur qui fait foi est calculée côté serveur.
function calculerRembLigne(
  l: { montantDevis: number; plafondReference: number },
  ctx: {
    secteur?: string | null; estAyantDroit: boolean; categorieGarantie?: string | null;
    contrat?: {
      tauxAmbulatoirePublique?: string | null; tauxAmbulatoirePrivee?: string | null;
      tauxHospitalisationPublique?: string | null; tauxHospitalisationPrivee?: string | null;
      tauxAmbulatoirePubliqueAyantDroit?: string | null; tauxAmbulatoirePriveeAyantDroit?: string | null;
      tauxHospitalisationPubliqueAyantDroit?: string | null; tauxHospitalisationPriveeAyantDroit?: string | null;
    } | null;
  },
): { remb: number | null; reste: number | null } {
  if (ctx.categorieGarantie && RUBRIQUES_PLAFONNEES.includes(ctx.categorieGarantie)) return { remb: null, reste: null };
  if (!ctx.secteur || !ctx.contrat) return { remb: null, reste: null };
  const estHospitalisation = !ctx.categorieGarantie || ctx.categorieGarantie === "Hospitalisation";
  const estPublic = ctx.secteur === "Public";
  let taux: number | null = null;
  if (ctx.estAyantDroit) {
    const texteAyantDroit = estHospitalisation
      ? (estPublic ? ctx.contrat.tauxHospitalisationPubliqueAyantDroit : ctx.contrat.tauxHospitalisationPriveeAyantDroit)
      : (estPublic ? ctx.contrat.tauxAmbulatoirePubliqueAyantDroit : ctx.contrat.tauxAmbulatoirePriveeAyantDroit);
    taux = parseTauxPourcent(texteAyantDroit);
  }
  if (taux == null) {
    const texte = estHospitalisation
      ? (estPublic ? ctx.contrat.tauxHospitalisationPublique : ctx.contrat.tauxHospitalisationPrivee)
      : (estPublic ? ctx.contrat.tauxAmbulatoirePublique : ctx.contrat.tauxAmbulatoirePrivee);
    taux = parseTauxPourcent(texte);
  }
  if (taux == null) return { remb: null, reste: null };
  const remb = Math.round(Math.min(l.montantDevis, l.plafondReference) * (taux / 100));
  return { remb, reste: l.montantDevis - remb };
}

function sommeConnue(valeurs: (number | null)[]): number | null {
  return valeurs.length > 0 && valeurs.every((v) => v != null) ? valeurs.reduce((s: number, v) => s + (v as number), 0) : null;
}

// Ligne d'acte en cours de saisie, pas encore soumise (2026-08) — une
// prise en charge peut couvrir plusieurs actes liés, comme une facture
// (voir demande utilisateur : "il ne faut pas oublier que la prise en
// charge peut avoir plusieurs lignes d'acte comme la facture" /
// "la saisie se fait aussi par ligne même si le système calcule
// automatiquement que l'assurance prendra en charge"). plafondReference
// est calculé automatiquement (montantDevisPourActe côté KC, sinon
// acte.prixDefaut) ; montantDevis reste les frais réels du devis
// prestataire, éditables ligne par ligne.
interface LigneActeForm {
  acteMedicalId?: string;
  lettreCleCode?: string;
  coefficient?: number;
  description: string;
  plafondReference: number;
  montantDevis: number;
}

// Dérive les 3 lignes KC/KA/K Loc d'un bloc chirurgical à partir du seul
// coefficient paramétré sur l'acte KC — mêmes formules que FactureSaisie.tsx
// (coef KA = coef KC/2, coef K Loc = coef KC + coef KA), chacune valorisée
// avec sa propre valeur unitaire de lettre clé.
function deriverBundleKC(acte: ActeMedical, lettresActives: LettreCle[]): { kc: number; ka: number; kloc: number } | null {
  if (acte.lettreCleCode !== CODE_KC || !acte.coefficient) return null;
  const coefKA = acte.coefficient / 2;
  const coefKLoc = acte.coefficient + coefKA;
  const valKA = lettresActives.find((l) => l.code === CODE_KA)?.valeurUnitaire ?? 0;
  const valKLoc = lettresActives.find((l) => l.code === CODE_K_LOC)?.valeurUnitaire ?? 0;
  return { kc: acte.prixDefaut, ka: coefKA * valKA, kloc: coefKLoc * valKLoc };
}

const workflowVariant: Record<string, "success" | "warning" | "danger"> = {
  "Validée": "success", "En cours": "warning", "Rejetée": "danger",
};
const decisionVariant: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  "Accordé": "success", "Refusé": "danger", "En attente": "warning", "Annulé": "neutral",
};

const DECISIONS = [
  { id: "En attente", libelle: "En attente" }, { id: "Accordé", libelle: "Accordé" }, { id: "Refusé", libelle: "Refusé" },
  { id: "Annulé", libelle: "Annulé" },
];
const ORIGINES = [
  { id: "Agent", libelle: "Saisie agent" }, { id: "Portail Prestataire", libelle: "Portail Prestataire" }, { id: "Portail Assuré", libelle: "Portail Assuré" },
];

function emptyForm(): AccordPrealableUpsertInput {
  // type vide (2026-08) — les options dépendent désormais du contrat de
  // l'assuré choisi (voir typesGarantieCreate), pas de valeur par défaut
  // pertinente tant qu'aucun assuré n'est sélectionné.
  return { assureId: "", type: "", description: "", dateDemande: new Date().toLocaleDateString("fr-FR"), prestataire: "", origine: "Agent" };
}

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionHeaderCls = "flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-primary mb-3";

export default function AccordPrealableView() {
  const { shellActionRequest } = useShellNavigation();
  const { currentUser } = useAuth();
  const [accords, setAccords] = useState<AccordPrealable[]>([]);
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [lettresCles, setLettresCles] = useState<LettreCle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  // Contrôleur de demande/saisie (2026-08) — voir demande utilisateur : "si
  // une demande a été faite en ligne et qu'elle demeure en mode 'en cours',
  // si l'assuré se rend physiquement à l'assurance... l'application...
  // [doit] bloquer et signaler qu'il y a déjà une demande en cours et
  // proposer de continuer la saisie sur cette demande ou l'annuler pour
  // faire une nouvelle saisie." Dossier renvoyé par le 409 du backend
  // (AccordPrealableService.create) — non-null pendant que la boîte de
  // dialogue de résolution est affichée, PAR-DESSUS le formulaire de
  // création (jamais à la place, l'agent doit pouvoir revenir dessus).
  const [doublon, setDoublon] = useState<DoublonEnCoursDossier | null>(null);
  const [resolutionDoublon, setResolutionDoublon] = useState(false);
  const [form, setForm] = useState<AccordPrealableUpsertInput>(emptyForm());
  const [prestataireChoisi, setPrestataireChoisi] = useState<Prestataire | null>(null);
  const [familleActe, setFamilleActe] = useState("");
  const [acteChoisi, setActeChoisi] = useState<ActeMedical | null>(null);
  // Lignes d'actes de la demande en cours de saisie (2026-08) — voir
  // LigneActeForm. ligneMontantDevis/bundleKCForm sont les frais réels
  // encore éditables AVANT ajout à lignesForm (simple ou bloc KC/KA/K Loc).
  const [lignesForm, setLignesForm] = useState<LigneActeForm[]>([]);
  const [ligneMontantDevis, setLigneMontantDevis] = useState(0);
  const [bundleKCForm, setBundleKCForm] = useState<{ kc: number; ka: number; kloc: number } | null>(null);
  const [fichierOrdonnance, setFichierOrdonnance] = useState<File | null>(null);
  const [fichierDevis, setFichierDevis] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtres de recherche (2026-08) — même principe que l'écran Règlement,
  // avec plusieurs critères (voir demande utilisateur).
  const [filtrePrestataireId, setFiltrePrestataireId] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [filtreDecision, setFiltreDecision] = useState("");
  const [filtreOrigine, setFiltreOrigine] = useState("");
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");
  const [filtreReference, setFiltreReference] = useState("");
  const [recherchant, setRecherchant] = useState(false);

  // Édition d'une demande déjà saisie (2026-08) — écran identique à la
  // saisie initiale, bénéficiaire compris (voir demande utilisateur : "on
  // doit même être capable de modifier le bénéficiaire en cas d'erreur et
  // non juste bloquer ou annuler la prise en charge").
  const [editingAccord, setEditingAccord] = useState<AccordPrealable | null>(null);
  const [editForm, setEditForm] = useState<AccordPrealableUpsertInput & { dateValidite: string }>({ ...emptyForm(), dateValidite: "" });
  const [editAssureChoisi, setEditAssureChoisi] = useState<AssureSante | null>(null);
  const [editPrestataireChoisi, setEditPrestataireChoisi] = useState<Prestataire | null>(null);
  const [editFamilleActe, setEditFamilleActe] = useState("");
  const [editActeChoisi, setEditActeChoisi] = useState<ActeMedical | null>(null);
  const [editLignesForm, setEditLignesForm] = useState<LigneActeForm[]>([]);
  const [editLigneMontantDevis, setEditLigneMontantDevis] = useState(0);
  const [editBundleKCForm, setEditBundleKCForm] = useState<{ kc: number; ka: number; kloc: number } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const filtresActuels = {
    prestataireId: filtrePrestataireId || undefined,
    type: filtreType || undefined,
    decision: filtreDecision || undefined,
    origine: filtreOrigine || undefined,
    du: filtreDu || undefined,
    au: filtreAu || undefined,
    reference: filtreReference || undefined,
  };

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setAccords(await getAccordsPrealables(filtresActuels));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => {
    handleRechercher();
    getAssuresSante().then(setAssures);
    getActesMedicaux().then(setActes);
    getPrestataires().then(setPrestataires);
    getContrats().then(setContrats);
    getLettresCles().then(setLettresCles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const famillesActes = useMemo(() => [...new Set(actes.map((a) => a.famille))].sort(), [actes]);
  const actesDeLaFamille = useMemo(() => actes.filter((a) => a.famille === familleActe), [actes, familleActe]);
  const editActesDeLaFamille = useMemo(() => actes.filter((a) => a.famille === editFamilleActe), [actes, editFamilleActe]);
  const lettresActives = useMemo(() => lettresCles.filter((l) => l.actif), [lettresCles]);

  // Totaux des lignes d'actes en cours de saisie (2026-08) — le plafond
  // s'applique ACTE PAR ACTE, jamais globalement : le reste à charge total
  // est la somme des dépassements de CHAQUE ligne, pas
  // max(0, total devis - total plafond) (cette dernière formule laisserait
  // la marge d'un acte sous son plafond compenser le dépassement d'un
  // autre, ce qui n'est pas la règle — voir demande utilisateur, même
  // erreur corrigée sur le Certificat de Prise en Charge,
  // DocumentsService.renderCertificatPriseEnCharge).
  const totalDevisCreate = lignesForm.reduce((s, l) => s + l.montantDevis, 0);
  const totalPlafondCreate = lignesForm.reduce((s, l) => s + l.plafondReference, 0);
  const totalDevisEdit = editLignesForm.reduce((s, l) => s + l.montantDevis, 0);
  const totalPlafondEdit = editLignesForm.reduce((s, l) => s + l.plafondReference, 0);

  // Plafond de garantie applicable au type sélectionné (2026-08) — cherché
  // dans le tableau de garanties du contrat de l'assuré choisi, même
  // rapprochement texte best-effort que SanteService.verifierPlafondPartage
  // côté backend (Garantie.libelle vs le type), pour afficher au gestionnaire
  // le plafond que la décision devra respecter (voir demande utilisateur :
  // "lier les plafond de garantie en fonction de ce que le tableau indique").
  // Fonction partagée entre le formulaire de création et celui de
  // modification (identiques, voir demande utilisateur).
  // a.type (Hospitalisation/Chirurgie/EVASAN) correspond à Garantie.
  // categorie, pas à Garantie.libelle (bien plus granulaire) — même
  // correction que côté backend (DocumentsService.
  // renderCertificatPriseEnCharge).
  const trouverGarantieDuType = (assureId: string, type: string) => {
    const assureChoisi = assures.find((a) => a.id === assureId);
    const contratDeLAssure = assureChoisi ? contrats.find((c) => c.id === assureChoisi.police) : undefined;
    if (!contratDeLAssure) return undefined;
    const typeLower = type.trim().toLowerCase();
    return contratDeLAssure.garanties.find((g) => g.categorie.trim().toLowerCase() === typeLower && g.plafondMontant != null)
      ?? contratDeLAssure.garanties.find((g) => g.categorie.trim().toLowerCase() === typeLower)
      ?? contratDeLAssure.garanties.find((g) => g.libelle.trim().toLowerCase() === typeLower)
      ?? contratDeLAssure.garanties.find((g) => typeLower.includes(g.libelle.trim().toLowerCase()) || g.libelle.trim().toLowerCase().includes(typeLower));
  };
  const garantieDuType = useMemo(() => trouverGarantieDuType(form.assureId, form.type), [assures, contrats, form.assureId, form.type]);
  const editGarantieDuType = useMemo(() => trouverGarantieDuType(editForm.assureId, editForm.type), [assures, contrats, editForm.assureId, editForm.type]);

  // Contrat de l'assuré choisi (2026-08) — même lookup assureId -> police ->
  // Contrat que trouverGarantieDuType, mais on garde ici l'objet Contrat
  // complet pour lire ses 8 champs de taux ambulatoire/hospitalisation ×
  // public/privé × ayant droit (voir calculerRembLigne ci-dessus).
  const contratCreate = useMemo(() => {
    const assureChoisi = assures.find((as) => as.id === form.assureId);
    return assureChoisi ? contrats.find((c) => c.id === assureChoisi.police) : undefined;
  }, [assures, contrats, form.assureId]);
  const contratEdit = useMemo(() => {
    const assureChoisi = assures.find((as) => as.id === editForm.assureId);
    return assureChoisi ? contrats.find((c) => c.id === assureChoisi.police) : undefined;
  }, [assures, contrats, editForm.assureId]);
  const assureCreateChoisiFull = useMemo(() => assures.find((as) => as.id === form.assureId), [assures, form.assureId]);
  const assureEditChoisiFull = useMemo(() => assures.find((as) => as.id === editForm.assureId), [assures, editForm.assureId]);

  // Rubriques de garantie disponibles pour le "Type" (2026-08) — voir
  // demande utilisateur : "tu ne fais toujours pas remonter toutes les
  // rubrique de garanties". Remplace l'ancienne liste figée à 3 valeurs
  // (Hospitalisation/Chirurgie/EVASAN) par le VRAI tableau de garanties du
  // contrat de l'assuré CHOISI — mêmes données que l'onglet Garanties de la
  // fiche contrat, jamais une liste à part qui pourrait diverger. Vide tant
  // qu'aucun assuré n'est sélectionné (on ne connaît pas encore son
  // contrat, donc pas ses garanties).
  // Le type déjà enregistré reste toujours proposé même s'il ne figure plus
  // dans les garanties actuelles du contrat (dossier plus ancien, rubrique
  // renommée depuis...) — jamais une valeur qui "disparaît" à l'édition.
  const typesGarantieCreate = useMemo(() => {
    const categories = new Set((contratCreate?.garanties ?? []).map((g) => g.categorie));
    if (form.type) categories.add(form.type);
    return [...categories].map((c) => ({ id: c, libelle: c }));
  }, [contratCreate, form.type]);
  const typesGarantieEdit = useMemo(() => {
    const categories = new Set((contratEdit?.garanties ?? []).map((g) => g.categorie));
    if (editForm.type) categories.add(editForm.type);
    return [...categories].map((c) => ({ id: c, libelle: c }));
  }, [contratEdit, editForm.type]);
  // Filtre de la liste (2026-08) — les dossiers existants peuvent porter
  // n'importe laquelle des rubriques réelles de tous les contrats, jamais
  // limité aux 3 anciennes valeurs : dérivé des dossiers eux-mêmes.
  const typesPresents = useMemo(
    () => [...new Set(accords.map((a) => a.type))].sort((a, b) => a.localeCompare(b)).map((t) => ({ id: t, libelle: t })),
    [accords],
  );

  // Quote-part par ligne — voir calculerRembLigne (moteur ambulatoire/
  // hospitalisation × secteur du prestataire × ayant droit, plafonné au
  // tarif de référence de chaque acte).
  const lignesCalcCreate = lignesForm.map((l) => calculerRembLigne(l, {
    secteur: prestataireChoisi?.secteur, estAyantDroit: (assureCreateChoisiFull?.typeAssure ?? "AS") !== "AS",
    categorieGarantie: actes.find((ac) => ac.id === l.acteMedicalId)?.categorieGarantie, contrat: contratCreate,
  }));
  const lignesCalcEdit = editLignesForm.map((l) => calculerRembLigne(l, {
    secteur: editPrestataireChoisi?.secteur, estAyantDroit: (assureEditChoisiFull?.typeAssure ?? "AS") !== "AS",
    categorieGarantie: actes.find((ac) => ac.id === l.acteMedicalId)?.categorieGarantie, contrat: contratEdit,
  }));
  const totalRembCreate = sommeConnue(lignesCalcCreate.map((r) => r.remb));
  const totalResteCreate = sommeConnue(lignesCalcCreate.map((r) => r.reste));
  const totalRembEdit = sommeConnue(lignesCalcEdit.map((r) => r.remb));
  const totalResteEdit = sommeConnue(lignesCalcEdit.map((r) => r.reste));

  const handleSelectFamille = (famille: string) => {
    setFamilleActe(famille);
    setActeChoisi(null);
  };

  // bundleKCRef/editBundleKCRef = plafond assurance (calculé, jamais saisi)
  // pour chaque composante du bloc — bundleKCForm/editBundleKCForm restent
  // les frais réels, laissés à 0 pour forcer une saisie déclarée (voir
  // demande utilisateur : "laisser les frais réel à 0 et laisser l'agent
  // saisir le montant lui-même" / "pour chacune de ses rubriques il faut
  // prévoir la saisie des frais réels... afin que s'il y a dépassement,
  // cela soit à la charge de l'assuré").
  const bundleKCRef = useMemo(() => (acteChoisi ? deriverBundleKC(acteChoisi, lettresActives) : null), [acteChoisi, lettresActives]);
  const editBundleKCRef = useMemo(() => (editActeChoisi ? deriverBundleKC(editActeChoisi, lettresActives) : null), [editActeChoisi, lettresActives]);

  const handleSelectActe = (acteId: string) => {
    const acte = actesDeLaFamille.find((a) => a.id === acteId) ?? null;
    setActeChoisi(acte);
    if (!acte) { setBundleKCForm(null); setLigneMontantDevis(0); return; }
    setBundleKCForm(deriverBundleKC(acte, lettresActives) ? { kc: 0, ka: 0, kloc: 0 } : null);
    setLigneMontantDevis(0);
    setForm((v) => ({ ...v, type: acte.categorieGarantie === "Hospitalisation" ? "Hospitalisation" : v.type }));
  };

  // Ajoute l'acte choisi aux lignes de la demande (2026-08) — un acte KC
  // ajoute d'un coup les 3 lignes liées (KC/KA/K Loc), chacune avec son
  // propre "frais réels" à saisir avant ajout (voir demande utilisateur :
  // "la saisie se fait aussi par ligne... les frais réels sont souvent
  // indiqués [séparément] sur les devis des prestataires").
  const handleAjouterLigneActe = () => {
    if (!acteChoisi) return;
    if (bundleKCForm && bundleKCRef && acteChoisi.coefficient) {
      const coefKC = acteChoisi.coefficient;
      const coefKA = coefKC / 2;
      const coefKLoc = coefKC + coefKA;
      const libelleKA = lettresActives.find((l) => l.code === CODE_KA)?.libelle ?? "Acte de l'anesthésiste";
      const libelleKLoc = lettresActives.find((l) => l.code === CODE_K_LOC)?.libelle ?? "Location du bloc opératoire";
      setLignesForm((v) => [
        ...v,
        { acteMedicalId: acteChoisi.id, lettreCleCode: CODE_KC, coefficient: coefKC, description: acteChoisi.libelle, plafondReference: bundleKCRef.kc, montantDevis: bundleKCForm.kc },
        { lettreCleCode: CODE_KA, coefficient: coefKA, description: libelleKA, plafondReference: bundleKCRef.ka, montantDevis: bundleKCForm.ka },
        { lettreCleCode: CODE_K_LOC, coefficient: coefKLoc, description: libelleKLoc, plafondReference: bundleKCRef.kloc, montantDevis: bundleKCForm.kloc },
      ]);
    } else {
      const ref = montantDevisPourActe(acteChoisi, lettresActives);
      setLignesForm((v) => [...v, { acteMedicalId: acteChoisi.id, lettreCleCode: acteChoisi.lettreCleCode, coefficient: acteChoisi.coefficient, description: acteChoisi.libelle, plafondReference: ref, montantDevis: ligneMontantDevis }]);
    }
    setFamilleActe(""); setActeChoisi(null); setBundleKCForm(null); setLigneMontantDevis(0);
  };
  const handleSupprimerLigneActe = (index: number) => setLignesForm((v) => v.filter((_, i) => i !== index));
  const handleChangerMontantLigne = (index: number, montant: number) => setLignesForm((v) => v.map((l, i) => (i === index ? { ...l, montantDevis: montant } : l)));

  const handleSelectEditFamille = (famille: string) => {
    setEditFamilleActe(famille);
    setEditActeChoisi(null);
  };

  const handleSelectEditActe = (acteId: string) => {
    const acte = editActesDeLaFamille.find((a) => a.id === acteId) ?? null;
    setEditActeChoisi(acte);
    if (!acte) { setEditBundleKCForm(null); setEditLigneMontantDevis(0); return; }
    setEditBundleKCForm(deriverBundleKC(acte, lettresActives) ? { kc: 0, ka: 0, kloc: 0 } : null);
    setEditLigneMontantDevis(0);
    setEditForm((v) => ({ ...v, type: acte.categorieGarantie === "Hospitalisation" ? "Hospitalisation" : v.type }));
  };

  const handleAjouterLigneActeEdit = () => {
    if (!editActeChoisi) return;
    if (editBundleKCForm && editBundleKCRef && editActeChoisi.coefficient) {
      const coefKC = editActeChoisi.coefficient;
      const coefKA = coefKC / 2;
      const coefKLoc = coefKC + coefKA;
      const libelleKA = lettresActives.find((l) => l.code === CODE_KA)?.libelle ?? "Acte de l'anesthésiste";
      const libelleKLoc = lettresActives.find((l) => l.code === CODE_K_LOC)?.libelle ?? "Location du bloc opératoire";
      setEditLignesForm((v) => [
        ...v,
        { acteMedicalId: editActeChoisi.id, lettreCleCode: CODE_KC, coefficient: coefKC, description: editActeChoisi.libelle, plafondReference: editBundleKCRef.kc, montantDevis: editBundleKCForm.kc },
        { lettreCleCode: CODE_KA, coefficient: coefKA, description: libelleKA, plafondReference: editBundleKCRef.ka, montantDevis: editBundleKCForm.ka },
        { lettreCleCode: CODE_K_LOC, coefficient: coefKLoc, description: libelleKLoc, plafondReference: editBundleKCRef.kloc, montantDevis: editBundleKCForm.kloc },
      ]);
    } else {
      const ref = montantDevisPourActe(editActeChoisi, lettresActives);
      setEditLignesForm((v) => [...v, { acteMedicalId: editActeChoisi.id, lettreCleCode: editActeChoisi.lettreCleCode, coefficient: editActeChoisi.coefficient, description: editActeChoisi.libelle, plafondReference: ref, montantDevis: editLigneMontantDevis }]);
    }
    setEditFamilleActe(""); setEditActeChoisi(null); setEditBundleKCForm(null); setEditLigneMontantDevis(0);
  };
  const handleSupprimerLigneActeEdit = (index: number) => setEditLignesForm((v) => v.filter((_, i) => i !== index));
  const handleChangerMontantLigneEdit = (index: number, montant: number) => setEditLignesForm((v) => v.map((l, i) => (i === index ? { ...l, montantDevis: montant } : l)));

  const refresh = async () => setAccords(await getAccordsPrealables(filtresActuels));

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production".
  const prendre = async (a: AccordPrealable) => {
    try {
      await prendreAccordPrealable(a.id);
      refresh();
    } catch (err) {
      toast.error(messageErreur(err, "Impossible de prendre ce dossier."));
    }
  };

  // Nombre de dossiers dont aucune étape du workflow n'a encore abouti —
  // reflète le compteur affiché en badge sur la navigation (voir AdminShell).
  const enAttente = accords.filter((a) => a.decision === "En attente").length;

  // Compteurs (2026-08) — total établi, par type et par souscripteur, sur
  // le résultat de recherche actuellement affiché (voir demande
  // utilisateur : "un compteur permettant de connaître le nombre de prise
  // en charge total établie... par type... et par souscripteur").
  const parType = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accords) m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [accords]);
  const parSouscripteur = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accords) {
      const nom = contrats.find((c) => c.id === a.contratId)?.client ?? "—";
      m.set(nom, (m.get(nom) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [accords, contrats]);

  const openCreate = () => {
    setForm(emptyForm());
    setPrestataireChoisi(null);
    setFamilleActe("");
    setActeChoisi(null);
    setLignesForm([]);
    setLigneMontantDevis(0);
    setBundleKCForm(null);
    setFichierOrdonnance(null);
    setFichierDevis(null);
    setFormError(null);
    setShowCreate(true);
  };

  // Raccourci d'accès rapide depuis le bandeau (2026-08) — voir AdminShell.tsx.
  useEffect(() => {
    if (shellActionRequest?.view === "accordPrealable" && shellActionRequest.label === "Nouvelle prise en charge") openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellActionRequest]);

  const handleCreate = async () => {
    if (!form.assureId || !form.prestataire || !form.type) {
      setFormError("Assuré, type (rubrique de garantie) et prestataire sont obligatoires.");
      return;
    }
    if (lignesForm.length === 0) {
      setFormError("Au moins un acte est requis pour instruire une demande de prise en charge.");
      return;
    }
    try {
      setSubmitting(true);
      const cree = await createAccordPrealable({
        ...form,
        description: lignesForm.map((l) => l.description).join(" + "),
        montantDevis: totalDevisCreate,
        lignes: lignesForm,
      });
      // Pièces jointes facultatives en saisie Agent — chargées juste après
      // la création (même principe que la photo d'un assuré), puisque
      // l'upload a besoin de l'id du dossier (voir demande utilisateur).
      if (fichierOrdonnance) await uploadOrdonnanceAccordPrealable(cree.id, fichierOrdonnance);
      if (fichierDevis) await uploadDevisAccordPrealable(cree.id, fichierDevis);
      setShowCreate(false);
      refresh();
      toast.success("Demande de prise en charge enregistrée.");
    } catch (err) {
      if (err instanceof QueuedOfflineError) {
        // Pas une erreur : la demande est en file, elle partira seule à la
        // reconnexion (voir lib/syncManager.ts), qui préviendra l'agent si
        // elle finit par être refusée (doublon ouvert entre-temps). Les
        // pièces jointes, elles, ne peuvent pas être mises en file (fichier
        // binaire) — à ajouter une fois le dossier effectivement créé.
        setShowCreate(false);
        refresh();
        toast.info(
          fichierOrdonnance || fichierDevis
            ? "Pas de connexion — la demande a été enregistrée et sera envoyée automatiquement. Vous pourrez joindre l'ordonnance/le devis une fois le dossier créé."
            : "Pas de connexion — la demande a été enregistrée et sera envoyée automatiquement dès le retour du réseau.",
        );
        return;
      }
      const dossierEnCours = doublonEnCoursDe(err);
      if (dossierEnCours) {
        // Ne pas fermer le formulaire — l'agent doit pouvoir y revenir s'il
        // choisit de continuer sur le dossier existant plutôt que de le
        // remplacer (voir résolution ci-dessous).
        setDoublon(dossierEnCours);
      } else {
        setFormError(messageErreur(err, "Erreur de saisie."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Résolution du doublon détecté par handleCreate (2026-08) — voir
  // demande utilisateur. Deux issues possibles pour l'agent :
  // - continuer la saisie sur le dossier existant (ouvre l'écran d'édition
  //   déjà utilisé pour corriger une demande, openEdit ci-dessous) ;
  // - l'abandonner (AccordPrealableService.annuler) puis relancer la
  //   création initiale — le formulaire déjà rempli n'est jamais reperdu.
  const continuerSurDoublon = () => {
    if (!doublon) return;
    const existant = accords.find((a) => a.id === doublon.id);
    setDoublon(null);
    setShowCreate(false);
    if (existant) openEdit(existant);
    else toast.error("Dossier introuvable dans la liste — actualisez la page.");
  };

  const annulerDoublonEtRecreer = async () => {
    if (!doublon) return;
    try {
      setResolutionDoublon(true);
      await annulerAccordPrealable(doublon.id);
      setDoublon(null);
      await handleCreate();
    } catch (err) {
      toast.error(messageErreur(err, "Impossible d'annuler le dossier existant."));
    } finally {
      setResolutionDoublon(false);
    }
  };

  // Ouverture d'une demande déjà saisie pour correction (voir demande
  // utilisateur : "permettre l'accès aux lignes des prise en charge déjà
  // [existantes]... modification en cas d'erreur ou d'actualisation des
  // délais de validité").
  const openEdit = (a: AccordPrealable) => {
    setEditingAccord(a);
    setEditForm({
      assureId: a.assureId, type: a.type as AccordPrealableUpsertInput["type"], description: a.description,
      dateDemande: a.dateDemande, prestataire: a.prestataire, prestataireId: undefined,
      montantDevis: a.montantDevis, origine: a.origine as AccordPrealableUpsertInput["origine"],
      dateValidite: a.dateValidite ?? "",
    });
    setEditAssureChoisi(assures.find((as) => as.id === a.assureId) ?? null);
    setEditPrestataireChoisi(prestataires.find((pr) => pr.nom === a.prestataire) ?? null);
    setEditFamilleActe("");
    setEditActeChoisi(null);
    setEditBundleKCForm(null);
    setEditLigneMontantDevis(0);
    // Dossiers créés avant le modèle de lignes (2026-08) — reconstitue une
    // ligne unique à partir de description/montantDevis pour ne rien perdre
    // à l'affichage ; la sauvegarde suivante les migre vers de vraies lignes.
    setEditLignesForm(a.lignes.length > 0
      ? a.lignes.map((l) => ({ acteMedicalId: l.acteMedicalId, lettreCleCode: l.lettreCleCode, coefficient: l.coefficient, description: l.description, plafondReference: l.plafondReference, montantDevis: l.montantDevis }))
      : (a.montantDevis ? [{ description: a.description, plafondReference: a.montantDevis, montantDevis: a.montantDevis }] : []));
    setEditError(null);
  };

  const handleUpdate = async () => {
    if (!editingAccord) return;
    if (!editForm.assureId || !editForm.prestataire || !editForm.type) {
      setEditError("Assuré, type (rubrique de garantie) et prestataire sont obligatoires.");
      return;
    }
    if (editLignesForm.length === 0) {
      setEditError("Au moins un acte est requis.");
      return;
    }
    try {
      setEditSubmitting(true);
      await updateAccordPrealable(editingAccord.id, {
        assureId: editForm.assureId, type: editForm.type, description: editLignesForm.map((l) => l.description).join(" + "), dateDemande: editForm.dateDemande,
        prestataire: editForm.prestataire, prestataireId: editForm.prestataireId,
        montantDevis: totalDevisEdit, origine: editForm.origine,
        dateValidite: editForm.dateValidite || undefined,
        lignes: editLignesForm,
      });
      toast.success("Demande de prise en charge modifiée.");
      setEditingAccord(null);
      refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditUpload = async (type: "ordonnance" | "devis", file: File | null) => {
    if (!editingAccord || !file) return;
    try {
      const maj = type === "ordonnance"
        ? await uploadOrdonnanceAccordPrealable(editingAccord.id, file)
        : await uploadDevisAccordPrealable(editingAccord.id, file);
      setEditingAccord(maj);
      refresh();
      toast.success(type === "ordonnance" ? "Ordonnance chargée." : "Devis chargé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible.");
    }
  };

  const validerAnalyse = async (a: AccordPrealable) => {
    await decider(a.id, { statutAnalyseMedicale: "Validée" });
    refresh();
  };
  const validerFinancier = async (a: AccordPrealable) => {
    await decider(a.id, { statutValidationFinanciere: "Validée" });
    refresh();
  };
  const trancher = async (a: AccordPrealable, decision: "Accordé" | "Refusé") => {
    // Préremplit avec le montant calculé (min(frais réel, plafond de
    // référence) × taux de couverture par ligne, voir
    // AccordPrealableService.calculerMontantSuggere) plutôt que les frais
    // réels bruts — un taux de couverture à 100% ne veut pas dire "tout
    // remboursé", mais "remboursé jusqu'au plafond de l'acte" (voir demande
    // utilisateur). Repli sur montantDevis pour les dossiers sans lignes
    // (ancien modèle, aucun plafond de référence connu côté serveur).
    const suggestion = a.montantAutoriseSuggere ?? a.montantDevis ?? 0;
    const montantAutorise = decision === "Accordé" ? Number(window.prompt("Montant autorisé (FCFA) :", String(suggestion))) : undefined;
    await decider(a.id, { decision, montantAutorise, dateDecision: new Date().toLocaleDateString("fr-FR") });
    refresh();
  };

  const imprimerCertificat = async (a: AccordPrealable) => {
    try {
      await openCertificatPriseEnCharge(a.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération du certificat impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader
        title="Prise en charge" subtitle="Prise en charge (entente préalable) — accord si oui ou non, et à hauteur de combien, une prestation sera couverte"
        icon={ClipboardCheck}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle demande</Btn>}
      />
      {enAttente > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-[12.5px] text-foreground w-fit">
          <span className="font-semibold">{enAttente}</span> demande{enAttente > 1 ? "s" : ""} en attente de décision
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <StatCard title="Total prises en charge établies" value={String(accords.length)} icon={ClipboardCheck} />
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Par type</p>
          <div className="flex flex-wrap gap-1.5">
            {parType.length === 0 && <span className="text-[12px] text-muted-foreground">—</span>}
            {parType.map(([type, n]) => (
              <span key={type} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 text-[11px] text-foreground">{type} <span className="font-semibold text-primary">{n}</span></span>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Par souscripteur</p>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
            {parSouscripteur.length === 0 && <span className="text-[12px] text-muted-foreground">—</span>}
            {parSouscripteur.map(([nom, n]) => (
              <span key={nom} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 text-[11px] text-foreground">{nom} <span className="font-semibold text-primary">{n}</span></span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl mb-4">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Rechercher des demandes</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <label className="block">
              <div className={labelCls}>Prestataire</div>
              <Combobox
                options={prestataires}
                value={prestataires.find((pr) => pr.id === filtrePrestataireId) ?? null}
                onChange={(pr) => setFiltrePrestataireId(pr?.id ?? "")}
                getLabel={(pr) => pr.nom} getSubLabel={(pr) => pr.ville} getId={(pr) => pr.id}
                allowClear clearLabel="Tous"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Type</div>
              <Combobox
                options={typesPresents}
                value={typesPresents.find((t) => t.id === filtreType) ?? null}
                onChange={(t) => setFiltreType(t?.id ?? "")}
                getLabel={(t) => t.libelle} getId={(t) => t.id}
                allowClear clearLabel="Tous"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Décision</div>
              <Combobox
                options={DECISIONS}
                value={DECISIONS.find((d) => d.id === filtreDecision) ?? null}
                onChange={(d) => setFiltreDecision(d?.id ?? "")}
                getLabel={(d) => d.libelle} getId={(d) => d.id}
                allowClear clearLabel="Toutes"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Origine</div>
              <Combobox
                options={ORIGINES}
                value={ORIGINES.find((o) => o.id === filtreOrigine) ?? null}
                onChange={(o) => setFiltreOrigine(o?.id ?? "")}
                getLabel={(o) => o.libelle} getId={(o) => o.id}
                allowClear clearLabel="Toutes"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Du</div>
              <DateInput value={filtreDu} onChange={setFiltreDu} className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>Au</div>
              <DateInput value={filtreAu} onChange={setFiltreAu} className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>N° dossier ou assuré</div>
              <input value={filtreReference} onChange={(e) => setFiltreReference(e.target.value)} placeholder="ex. PEC-2026 ou nom" className={fieldCls} />
            </label>
          </div>
          <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}>
            <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
          </Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Origine", "Assuré", "Prestataire", "Type", "Description", "Pièces jointes", "Devis", "Analyse médicale", "Validation financière", "Décision", "Montant autorisé", "Facturé", "Pris en charge", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accords.map((a) => (
              <tr key={a.id} onClick={() => openEdit(a)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{a.id}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant="neutral">{a.origine ?? "Agent"}</Badge></td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{a.assureNom}</td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">{a.prestataire}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{a.type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{a.description}</td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 text-xs">
                    {a.ordonnanceFichier
                      ? <a href={urlDocumentAccordPrealable(a.ordonnanceFichier)} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Ordonnance</a>
                      : <span className="text-muted-foreground">— Ordonnance</span>}
                    {a.devisFichier
                      ? <a href={urlDocumentAccordPrealable(a.devisFichier)} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Devis</a>
                      : <span className="text-muted-foreground">— Devis</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{a.montantDevis ? `${fmtM(a.montantDevis)} FCFA` : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={workflowVariant[a.statutAnalyseMedicale] ?? "neutral"}>{a.statutAnalyseMedicale}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={workflowVariant[a.statutValidationFinanciere] ?? "neutral"}>{a.statutValidationFinanciere}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={decisionVariant[a.decision] ?? "neutral"}><span title={a.motifDecision}>{a.decision}</span></Badge></td>
                <td className="px-4 py-3 text-right text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{a.montantAutorise ? `${fmtM(a.montantAutorise)} FCFA` : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {a.facture
                    ? <Badge variant="success">Facturé{a.montantFacture ? ` · ${fmtM(a.montantFacture)} FCFA` : ""}</Badge>
                    : <Badge variant="neutral">Non facturé</Badge>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {!a.assigneAId ? (
                    <button onClick={() => prendre(a)} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium inline-flex items-center gap-1">
                      <UserPlus className="w-3 h-3" />Prendre
                    </button>
                  ) : a.assigneAId === currentUser?.id ? (
                    <Badge variant="success">Vous</Badge>
                  ) : (
                    <Badge variant="neutral">Pris en charge</Badge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {a.statutAnalyseMedicale === "En cours" && <Btn variant="ghost" onClick={() => validerAnalyse(a)}>Valider analyse</Btn>}
                    {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "En cours" && <Btn variant="ghost" onClick={() => validerFinancier(a)}>Valider finance</Btn>}
                    {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "Validée" && a.decision === "En attente" && (
                      <>
                        <button onClick={() => trancher(a, "Accordé")} className="p-1.5 rounded hover:bg-secondary text-green-400" title="Accorder"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => trancher(a, "Refusé")} className="p-1.5 rounded hover:bg-secondary text-red-400" title="Refuser"><XCircle className="w-4 h-4" /></button>
                      </>
                    )}
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    {a.decision === "Accordé" && (
                      <button onClick={() => imprimerCertificat(a)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Certificat de prise en charge"><FileOutput className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accords.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucun accord préalable en cours</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle demande de prise en charge</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className={labelCls}>Assuré</div>
                  <Combobox
                    options={assures}
                    value={assures.find((a) => a.id === form.assureId) ?? null}
                    onChange={(a) => setForm((v) => ({ ...v, assureId: a?.id ?? "" }))}
                    getLabel={(a) => a.nom} getSubLabel={(a) => a.matricule} getId={(a) => a.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Origine de la demande</div>
                  <select value={form.origine} onChange={(e) => setForm((v) => ({ ...v, origine: e.target.value as AccordPrealableUpsertInput["origine"] }))} className={fieldCls}>
                    <option value="Agent">Saisie agent</option>
                    <option value="Portail Prestataire">Portail Prestataire</option>
                    <option value="Portail Assuré">Portail Assuré</option>
                  </select>
                </label>
                <label className="block">
                  <div className={labelCls}>Type</div>
                  <Combobox
                    options={typesGarantieCreate}
                    value={typesGarantieCreate.find((t) => t.id === form.type) ?? null}
                    onChange={(t) => setForm((v) => ({ ...v, type: t?.id ?? "" }))}
                    getLabel={(t) => t.libelle} getId={(t) => t.id}
                    placeholder={form.assureId ? "Rechercher…" : "Choisir d'abord un assuré"}
                  />
                  {garantieDuType?.plafondMontant != null && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      Plafond de garantie : <span className="font-semibold text-foreground">{fmtM(garantieDuType.plafondMontant)} FCFA{garantieDuType.plafondPeriode ? ` / ${garantieDuType.plafondPeriode}` : ""}</span>
                    </p>
                  )}
                </label>
                <label className="block">
                  <div className={labelCls}>Prestataire</div>
                  <Combobox
                    options={prestataires}
                    value={prestataireChoisi}
                    onChange={(pr) => { setPrestataireChoisi(pr); setForm((v) => ({ ...v, prestataire: pr?.nom ?? "", prestataireId: pr?.id })); }}
                    getLabel={(pr) => pr.nom} getSubLabel={(pr) => pr.ville} getId={(pr) => pr.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block"><div className={labelCls}>Date de la demande</div><DateInput value={form.dateDemande} onChange={(v) => setForm((f) => ({ ...f, dateDemande: v }))} className={fieldCls} /></label>
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-4">
                <div className={sectionHeaderCls}><Paperclip className="w-3.5 h-3.5" />Pièces jointes (facultatif)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className={labelCls}>Ordonnance (image ou document)</div>
                    <input type="file" onChange={(e) => setFichierOrdonnance(e.target.files?.[0] ?? null)} className={`${fieldCls} py-1.5`} />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Devis (image ou document)</div>
                    <input type="file" onChange={(e) => setFichierDevis(e.target.files?.[0] ?? null)} className={`${fieldCls} py-1.5`} />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Obligatoires lorsque la demande est déposée via le portail d'un prestataire ou d'un assuré — pour valider l'analyse médicale.</p>
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-4">
                <div className={sectionHeaderCls}><ListChecks className="w-3.5 h-3.5" />Actes de la prise en charge</div>
                <p className="text-[11px] text-muted-foreground mb-3">Une prise en charge peut couvrir plusieurs actes liés, comme une facture — ajoutez-les un par un. Un acte KC (chirurgien) ajoute automatiquement les 3 lignes du bloc (KC/KA/K Loc).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Famille d'acte</div>
                    <select value={familleActe} onChange={(e) => handleSelectFamille(e.target.value)} className={fieldCls}>
                      <option value="">— Sélectionnez une famille —</option>
                      {famillesActes.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={labelCls}>Acte médical</div>
                    <Combobox
                      options={actesDeLaFamille}
                      value={acteChoisi}
                      onChange={(a) => handleSelectActe(a?.id ?? "")}
                      getLabel={(a) => a.libelle} getId={(a) => a.id}
                      disabled={!familleActe}
                      placeholder={familleActe ? "Rechercher…" : "Choisir une famille d'abord"}
                    />
                  </div>
                </div>

                {acteChoisi && bundleKCForm && bundleKCRef && (
                  <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                    <p className="text-[11.5px] font-medium text-foreground flex items-center gap-1"><Hash className="w-3 h-3" />Bloc chirurgical — 3 lignes liées. Saisissez le frais réel facturé par le prestataire pour chaque rubrique (le dépassement du plafond assurance reste à la charge de l'assuré).</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <label className="block"><div className={labelCls}>{acteChoisi.libelle} (KC) — plafond {fmtM(bundleKCRef.kc)} FCFA</div><input type="number" value={bundleKCForm.kc || ""} onChange={(e) => setBundleKCForm((v) => v && ({ ...v, kc: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                      <label className="block"><div className={labelCls}>Anesthésiste (KA) — plafond {fmtM(bundleKCRef.ka)} FCFA</div><input type="number" value={bundleKCForm.ka || ""} onChange={(e) => setBundleKCForm((v) => v && ({ ...v, ka: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                      <label className="block"><div className={labelCls}>Location bloc (K Loc) — plafond {fmtM(bundleKCRef.kloc)} FCFA</div><input type="number" value={bundleKCForm.kloc || ""} onChange={(e) => setBundleKCForm((v) => v && ({ ...v, kloc: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                    </div>
                    <Btn variant="secondary" disabled={bundleKCForm.kc <= 0 || bundleKCForm.ka <= 0 || bundleKCForm.kloc <= 0} onClick={handleAjouterLigneActe}><Plus className="w-4 h-4" />Ajouter les 3 lignes</Btn>
                  </div>
                )}
                {acteChoisi && !bundleKCForm && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                    <label className="block">
                      <div className={labelCls}>Frais réels (devis prestataire) — plafond assurance : {fmtM(montantDevisPourActe(acteChoisi, lettresActives))} FCFA</div>
                      <input type="number" value={ligneMontantDevis || ""} onChange={(e) => setLigneMontantDevis(e.target.value ? Number(e.target.value) : 0)} className={fieldCls} placeholder="Frais réel facturé" />
                    </label>
                    <Btn variant="secondary" disabled={ligneMontantDevis <= 0} onClick={handleAjouterLigneActe}><Plus className="w-4 h-4" />Ajouter la ligne</Btn>
                  </div>
                )}

                {lignesForm.length > 0 && (
                  <div className="mt-4 border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left px-2.5 py-1.5">Acte</th>
                          <th className="text-right px-2.5 py-1.5">Plafond assurance</th>
                          <th className="text-right px-2.5 py-1.5">Frais réels</th>
                          <th className="text-right px-2.5 py-1.5">Remb. estimé</th>
                          <th className="text-right px-2.5 py-1.5">Reste à charge</th>
                          <th className="px-2.5 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {lignesForm.map((l, i) => {
                          const { remb, reste } = lignesCalcCreate[i];
                          return (
                            <tr key={i}>
                              <td className="px-2.5 py-1.5 text-foreground">{l.description}{l.lettreCleCode && <span className="text-[10.5px] text-muted-foreground"> · {l.lettreCleCode}</span>}</td>
                              <td className="px-2.5 py-1.5 text-right text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.plafondReference)}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <input type="number" value={l.montantDevis} onChange={(e) => handleChangerMontantLigne(i, Number(e.target.value))} className="w-28 text-right border border-border rounded-md px-2 py-1 bg-background text-foreground" />
                              </td>
                              <td className="px-2.5 py-1.5 text-right text-emerald-700" style={{ fontFamily: "'DM Mono', monospace" }}>{remb != null ? fmtM(remb) : "—"}</td>
                              <td className="px-2.5 py-1.5 text-right text-amber-700" style={{ fontFamily: "'DM Mono', monospace" }}>{reste != null ? fmtM(reste) : "—"}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <button type="button" onClick={() => handleSupprimerLigneActe(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-semibold">
                          <td className="px-2.5 py-1.5 text-foreground">Total</td>
                          <td className="px-2.5 py-1.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPlafondCreate)}</td>
                          <td className="px-2.5 py-1.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalDevisCreate)}</td>
                          <td className="px-2.5 py-1.5 text-right text-emerald-700" style={{ fontFamily: "'DM Mono', monospace" }}>{totalRembCreate != null ? fmtM(totalRembCreate) : "—"}</td>
                          <td className="px-2.5 py-1.5 text-right text-amber-700" style={{ fontFamily: "'DM Mono', monospace" }}>{totalResteCreate != null ? fmtM(totalResteCreate) : "—"}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {totalResteCreate != null && totalResteCreate > 0 && (
                  <p className="text-[11.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-3">
                    Reste à charge estimé de {fmtM(totalResteCreate)} FCFA (frais réels au-delà du tarif de référence et/ou taux de couverture appliqué acte par acte, selon le secteur du prestataire) — à la charge du bénéficiaire de la prise en charge.
                  </p>
                )}
                {lignesForm.length > 0 && totalResteCreate == null && (
                  <p className="text-[11.5px] text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2 mt-3">
                    Quote-part non calculable pour un ou plusieurs actes (prestataire, secteur ou taux du contrat non renseignés, ou rubrique à plafond partagé) — le montant exact sera déterminé à la décision du dossier.
                  </p>
                )}
              </div>
            </div>
            <p className="px-5 text-[11px] text-muted-foreground mb-3">Une demande de prise en charge n'est instruite que sur présentation d'un devis chiffré du coût de l'acte à couvrir.</p>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer la demande</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {doublon && (
        // Contrôleur de demande/saisie (2026-08) — voir demande utilisateur :
        // "l'application... [doit] bloquer et signaler qu'il y a déjà une
        // demande en cours et doit proposer de continuer la saisie sur
        // cette demande ou l'annuler pour faire une nouvelle saisie." z-[90]
        // — AU-DESSUS du formulaire de création (z-[80]/[70] usuels dans cet
        // écran), qui reste affiché derrière pour que l'agent puisse y
        // revenir sans perdre sa saisie s'il annule cette boîte de dialogue.
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold text-foreground">Demande déjà en cours</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[13px] text-foreground">
                Une demande de prise en charge est déjà <span className="font-semibold">en attente</span> pour cet assuré sur cette garantie :
              </p>
              <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary med-num">{doublon.id}</span>
                  <Badge variant="warning">{doublon.statutAnalyseMedicale}</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">{doublon.type} · {doublon.prestataire}</p>
                <p className="text-[12px] text-muted-foreground">Déposée le {doublon.dateDemande} ({doublon.origine})</p>
                {doublon.description && <p className="text-[12px] text-foreground">{doublon.description}</p>}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Voulez-vous continuer la saisie sur ce dossier existant, ou l'annuler pour en enregistrer un nouveau ?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDoublon(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Revenir au formulaire</button>
              <button type="button" onClick={continuerSurDoublon} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Continuer sur ce dossier</button>
              <button type="button" disabled={resolutionDoublon} onClick={annulerDoublonEtRecreer} className="h-9 px-4 rounded-lg bg-destructive text-white text-[13px] hover:opacity-90 disabled:opacity-60">Annuler ce dossier et refaire la saisie</button>
            </div>
          </div>
        </div>
      )}

      {editingAccord && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Modifier la demande {editingAccord.id}</h3>
                <div className="mt-0.5"><DerniereModification entite="accord-prealable" entiteId={editingAccord.id} /></div>
              </div>
              <button type="button" onClick={() => setEditingAccord(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className={labelCls}>Assuré</div>
                  <Combobox
                    options={assures}
                    value={editAssureChoisi}
                    onChange={(as) => { setEditAssureChoisi(as); setEditForm((v) => ({ ...v, assureId: as?.id ?? "" })); }}
                    getLabel={(as) => as.nom} getSubLabel={(as) => as.matricule} getId={(as) => as.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Origine de la demande</div>
                  <Combobox
                    options={ORIGINES}
                    value={ORIGINES.find((o) => o.id === editForm.origine) ?? null}
                    onChange={(o) => setEditForm((v) => ({ ...v, origine: (o?.id ?? "Agent") as AccordPrealableUpsertInput["origine"] }))}
                    getLabel={(o) => o.libelle} getId={(o) => o.id}
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Type</div>
                  <Combobox
                    options={typesGarantieEdit}
                    value={typesGarantieEdit.find((t) => t.id === editForm.type) ?? null}
                    onChange={(t) => setEditForm((v) => ({ ...v, type: t?.id ?? "" }))}
                    getLabel={(t) => t.libelle} getId={(t) => t.id}
                  />
                  {editGarantieDuType?.plafondMontant != null && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      Plafond de garantie : <span className="font-semibold text-foreground">{fmtM(editGarantieDuType.plafondMontant)} FCFA{editGarantieDuType.plafondPeriode ? ` / ${editGarantieDuType.plafondPeriode}` : ""}</span>
                    </p>
                  )}
                </label>
                <label className="block">
                  <div className={labelCls}>Prestataire</div>
                  <Combobox
                    options={prestataires}
                    value={editPrestataireChoisi}
                    onChange={(pr) => { setEditPrestataireChoisi(pr); setEditForm((v) => ({ ...v, prestataire: pr?.nom ?? v.prestataire, prestataireId: pr?.id })); }}
                    getLabel={(pr) => pr.nom} getSubLabel={(pr) => pr.ville} getId={(pr) => pr.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block"><div className={labelCls}>Date de la demande</div><DateInput value={editForm.dateDemande} onChange={(v) => setEditForm((f) => ({ ...f, dateDemande: v }))} className={fieldCls} /></label>
                <label className="block">
                  <div className={labelCls}>Date de validité du certificat</div>
                  <DateInput value={editForm.dateValidite} onChange={(v) => setEditForm((f) => ({ ...f, dateValidite: v }))} className={fieldCls} />
                  <p className="text-[11px] text-muted-foreground mt-1">Laisser vide pour garder le calcul automatique (+30 jours après décision).</p>
                </label>
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-4">
                <div className={sectionHeaderCls}><ListChecks className="w-3.5 h-3.5" />Actes de la prise en charge</div>
                <p className="text-[11px] text-muted-foreground mb-3">Une prise en charge peut couvrir plusieurs actes liés, comme une facture — ajoutez-les un par un. Un acte KC (chirurgien) ajoute automatiquement les 3 lignes du bloc (KC/KA/K Loc).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Famille d'acte</div>
                    <select value={editFamilleActe} onChange={(e) => handleSelectEditFamille(e.target.value)} className={fieldCls}>
                      <option value="">— Sélectionnez une famille —</option>
                      {famillesActes.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={labelCls}>Acte médical</div>
                    <Combobox
                      options={editActesDeLaFamille}
                      value={editActeChoisi}
                      onChange={(a) => handleSelectEditActe(a?.id ?? "")}
                      getLabel={(a) => a.libelle} getId={(a) => a.id}
                      disabled={!editFamilleActe}
                      placeholder={editFamilleActe ? "Rechercher…" : "Choisir une famille d'abord"}
                    />
                  </div>
                </div>

                {editActeChoisi && editBundleKCForm && editBundleKCRef && (
                  <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                    <p className="text-[11.5px] font-medium text-foreground flex items-center gap-1"><Hash className="w-3 h-3" />Bloc chirurgical — 3 lignes liées. Saisissez le frais réel facturé par le prestataire pour chaque rubrique (le dépassement du plafond assurance reste à la charge de l'assuré).</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <label className="block"><div className={labelCls}>{editActeChoisi.libelle} (KC) — plafond {fmtM(editBundleKCRef.kc)} FCFA</div><input type="number" value={editBundleKCForm.kc || ""} onChange={(e) => setEditBundleKCForm((v) => v && ({ ...v, kc: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                      <label className="block"><div className={labelCls}>Anesthésiste (KA) — plafond {fmtM(editBundleKCRef.ka)} FCFA</div><input type="number" value={editBundleKCForm.ka || ""} onChange={(e) => setEditBundleKCForm((v) => v && ({ ...v, ka: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                      <label className="block"><div className={labelCls}>Location bloc (K Loc) — plafond {fmtM(editBundleKCRef.kloc)} FCFA</div><input type="number" value={editBundleKCForm.kloc || ""} onChange={(e) => setEditBundleKCForm((v) => v && ({ ...v, kloc: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} placeholder="Frais réel facturé" /></label>
                    </div>
                    <Btn variant="secondary" disabled={editBundleKCForm.kc <= 0 || editBundleKCForm.ka <= 0 || editBundleKCForm.kloc <= 0} onClick={handleAjouterLigneActeEdit}><Plus className="w-4 h-4" />Ajouter les 3 lignes</Btn>
                  </div>
                )}
                {editActeChoisi && !editBundleKCForm && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                    <label className="block">
                      <div className={labelCls}>Frais réels (devis prestataire) — plafond assurance : {fmtM(montantDevisPourActe(editActeChoisi, lettresActives))} FCFA</div>
                      <input type="number" value={editLigneMontantDevis || ""} onChange={(e) => setEditLigneMontantDevis(e.target.value ? Number(e.target.value) : 0)} className={fieldCls} placeholder="Frais réel facturé" />
                    </label>
                    <Btn variant="secondary" disabled={editLigneMontantDevis <= 0} onClick={handleAjouterLigneActeEdit}><Plus className="w-4 h-4" />Ajouter la ligne</Btn>
                  </div>
                )}

                {editLignesForm.length > 0 && (
                  <div className="mt-4 border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left px-2.5 py-1.5">Acte</th>
                          <th className="text-right px-2.5 py-1.5">Plafond assurance</th>
                          <th className="text-right px-2.5 py-1.5">Frais réels</th>
                          <th className="text-right px-2.5 py-1.5">Remb. estimé</th>
                          <th className="text-right px-2.5 py-1.5">Reste à charge</th>
                          <th className="px-2.5 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {editLignesForm.map((l, i) => {
                          const { remb, reste } = lignesCalcEdit[i];
                          return (
                            <tr key={i}>
                              <td className="px-2.5 py-1.5 text-foreground">{l.description}{l.lettreCleCode && <span className="text-[10.5px] text-muted-foreground"> · {l.lettreCleCode}</span>}</td>
                              <td className="px-2.5 py-1.5 text-right text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.plafondReference)}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <input type="number" value={l.montantDevis} onChange={(e) => handleChangerMontantLigneEdit(i, Number(e.target.value))} className="w-28 text-right border border-border rounded-md px-2 py-1 bg-background text-foreground" />
                              </td>
                              <td className="px-2.5 py-1.5 text-right text-emerald-700" style={{ fontFamily: "'DM Mono', monospace" }}>{remb != null ? fmtM(remb) : "—"}</td>
                              <td className="px-2.5 py-1.5 text-right text-amber-700" style={{ fontFamily: "'DM Mono', monospace" }}>{reste != null ? fmtM(reste) : "—"}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <button type="button" onClick={() => handleSupprimerLigneActeEdit(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-semibold">
                          <td className="px-2.5 py-1.5 text-foreground">Total</td>
                          <td className="px-2.5 py-1.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPlafondEdit)}</td>
                          <td className="px-2.5 py-1.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalDevisEdit)}</td>
                          <td className="px-2.5 py-1.5 text-right text-emerald-700" style={{ fontFamily: "'DM Mono', monospace" }}>{totalRembEdit != null ? fmtM(totalRembEdit) : "—"}</td>
                          <td className="px-2.5 py-1.5 text-right text-amber-700" style={{ fontFamily: "'DM Mono', monospace" }}>{totalResteEdit != null ? fmtM(totalResteEdit) : "—"}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {totalResteEdit != null && totalResteEdit > 0 && (
                  <p className="text-[11.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-3">
                    Reste à charge estimé de {fmtM(totalResteEdit)} FCFA (frais réels au-delà du tarif de référence et/ou taux de couverture appliqué acte par acte, selon le secteur du prestataire) — à la charge du bénéficiaire de la prise en charge.
                  </p>
                )}
                {editLignesForm.length > 0 && totalResteEdit == null && (
                  <p className="text-[11.5px] text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2 mt-3">
                    Quote-part non calculable pour un ou plusieurs actes (prestataire, secteur ou taux du contrat non renseignés, ou rubrique à plafond partagé) — le montant exact sera déterminé à la décision du dossier.
                  </p>
                )}
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-4">
                <div className={sectionHeaderCls}><Paperclip className="w-3.5 h-3.5" />Pièces jointes</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className={labelCls}>Ordonnance {editingAccord.ordonnanceFichier && <a href={urlDocumentAccordPrealable(editingAccord.ordonnanceFichier)} target="_blank" rel="noreferrer" className="text-primary hover:underline">(voir le fichier actuel)</a>}</div>
                    <input type="file" onChange={(e) => handleEditUpload("ordonnance", e.target.files?.[0] ?? null)} className={`${fieldCls} py-1.5`} />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Devis {editingAccord.devisFichier && <a href={urlDocumentAccordPrealable(editingAccord.devisFichier)} target="_blank" rel="noreferrer" className="text-primary hover:underline">(voir le fichier actuel)</a>}</div>
                    <input type="file" onChange={(e) => handleEditUpload("devis", e.target.files?.[0] ?? null)} className={`${fieldCls} py-1.5`} />
                  </label>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{editError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditingAccord(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={editSubmitting} onClick={handleUpdate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer les modifications</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
