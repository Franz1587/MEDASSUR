import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Ban, CheckCircle2, X, Tag, Percent, XCircle, Printer, ListChecks, CircleDollarSign, FileWarning, Pencil, Hash } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { DerniereModification } from "@/components/shared/DerniereModification";
import { fmtM } from "@/lib/format";
import {
  getFacture, ajouterLigneFacture, modifierLigneFacture, rejeterLigneFacture, supprimerLigneFacture, terminerFacture,
  annulerFacture, apercuLigneFacture, ajouterNumeroFacture, supprimerNumeroFacture,
} from "@/services/factures.service";
import { getAssuresSante } from "@/services/sante.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import { getAccordsPrealablesContrat } from "@/services/accordPrealable.service";
import { getLettresCles } from "@/services/lettresCles.service";
import { getCodesAffection, type CodeAffection } from "@/services/codesAffection.service";
import { openDecompteFacture } from "@/services/documents.service";
import { OPTIONS_NATURE_MALADIE, type NatureMaladie } from "@/lib/natureMaladie";
import { MOTIFS_REJET_FACTURE, MOTIF_REJET_AUTRE, mapMotifRejet } from "@/lib/motifsRejet";
import type { Facture, FactureLigne, ApercuLigne } from "@/types/facture";
import type { AssureSante } from "@/types/sante";
import type { ActeMedical } from "@/types/acteMedical";
import type { AccordPrealable } from "@/types/accordPrealable";
import type { LettreCle } from "@/types/lettresCles";
import { CODE_KA, CODE_KC, CODE_K_LOC } from "@/types/lettresCles";

// Doit rester strictement identique à TYPES_PRESTATION/RUBRIQUES_PLAFONNEES
// (backend/src/sante/dto/create-facture-ligne.dto.ts) — 2026-09, voir
// demande utilisateur : "c'est exactement ce qui doit devenir le modèle
// standard du tableau de garanties" (repris du contrat 3M PARTNERS &
// CONSEILS, police 10005316). Consultations/Pharmacie/Imagerie/Analyses
// Médicale/Petite Chirurgie-Soins/Hospitalisation suivent le calcul au
// pourcentage, le reste suit le calcul au plafond de rubrique
// (Garantie.categorie).
const TYPES_PRESTATION = ["Ambulatoire", "Consultations", "Actes de Spécialités", "Pharmacie", "Imagerie", "Analyses Médicale", "Petite Chirurgie/Soins", "Hospitalisation", "Soins & Prothèses dentaires", "Optique", "Kinésithérapie & Cure thermale", "Maternité", "Transport", "Orthophonie", "Orthoptie", "Autre"];

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionHeaderCls = "flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-primary mb-3";

interface LigneForm {
  assure: AssureSante | null;
  typePrestation: string;
  datePrestation: string;
  accord: AccordPrealable | null;
  famille: string;
  // La codification à la lettre clé est paramétrée UNE FOIS sur l'acte du
  // catalogue (voir Catalogue des actes médicaux) — à la saisie, on choisit
  // juste l'acte comme d'habitude, le système sait déjà s'il s'agit d'un K,
  // KC, AMI… et applique son coefficient (voir demande utilisateur : "le
  // système remonte son coefficient").
  acte: ActeMedical | null;
  // Édition d'une ligne "dérivée" (2026-08) — une ligne KA/K Loc générée
  // automatiquement par un acte KC n'a pas d'acte de catalogue à proprement
  // parler, juste la lettre clé/coefficient d'origine, affichés en lecture
  // seule (voir handleEditerLigne).
  ligneDeriveeCode: string | null;
  ligneDeriveeCoefficient: number | null;
  // KC/KA/K Loc sont étroitement liés (acte chirurgien / anesthésiste /
  // location du bloc opératoire) — sélectionner un acte KC coche
  // automatiquement ce commutateur pour générer d'un coup les 3 lignes, les
  // coefficients KA et K Loc étant dérivés de celui du KC (voir
  // handleSelectActe / handleAjouterLigne).
  genererBundleKC: boolean;
  quantite: number;
  montant: number;
  montantRejete: number;
  motifRejetSaisie: string;
  // Précision libre quand le motif choisi est "AUTRE" (2026-09) — voir
  // MOTIFS DE REJET DE FACTURE.pdf, note "Nécessité d'avoir alors un champ
  // de saisie libre" (poste 20 du catalogue officiel).
  motifRejetAutre: string;
  nSinistre: string;
  nDeclaration: string;
  // Nature de l'affection + code CNAMGS (2026-08) — voir demande
  // utilisateur : "il fallait créer une rubrique nature de l'affection
  // dans la saisie de la facture" — obligatoires (voir handleAjouterLigne),
  // jamais affichés sur le Décompte (toujours "Affection Courante" à
  // l'écran), strictement internes/statistiques.
  natureMaladie: NatureMaladie;
  codeAffection: CodeAffection | null;
}

function emptyLigneForm(): LigneForm {
  return {
    assure: null, typePrestation: "Ambulatoire", datePrestation: new Date().toLocaleDateString("fr-FR"), accord: null,
    famille: "", acte: null, ligneDeriveeCode: null, ligneDeriveeCoefficient: null, genererBundleKC: true, quantite: 1,
    montant: 0, montantRejete: 0, motifRejetSaisie: "", motifRejetAutre: "",
    nSinistre: "", nDeclaration: "", natureMaladie: "AffectionCourante", codeAffection: null,
  };
}

export default function FactureSaisie({ factureId, onClose, onChanged }: { factureId: string; onClose: () => void; onChanged?: () => void }) {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [accords, setAccords] = useState<AccordPrealable[]>([]);
  const [lettresCles, setLettresCles] = useState<LettreCle[]>([]);
  const [codesAffection, setCodesAffection] = useState<CodeAffection[]>([]);
  const [form, setForm] = useState<LigneForm>(emptyLigneForm());
  const [editingLigneId, setEditingLigneId] = useState<string | null>(null);
  // Le formulaire de saisie masque le tableau des lignes déjà saisies sur
  // un écran court (voir capture utilisateur — le tableau devient illisible,
  // juste l'entête sticky visible). Repliable, et replié par défaut dès
  // qu'une facture a déjà des lignes : priorité à leur lecture/modification,
  // pas à un nouvel ajout (voir demande utilisateur).
  const [showLigneForm, setShowLigneForm] = useState(false);
  const [apercu, setApercu] = useState<ApercuLigne | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejetLigneId, setRejetLigneId] = useState<string | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [motifRejetAutreConfirm, setMotifRejetAutreConfirm] = useState("");
  const [showAnnuler, setShowAnnuler] = useState(false);
  const [motifAnnulationSaisie, setMotifAnnulationSaisie] = useState("");
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [ajoutNumeroEnCours, setAjoutNumeroEnCours] = useState(false);

  const refresh = () => getFacture(factureId).then(setFacture);

  useEffect(() => {
    getFacture(factureId).then((f) => {
      setFacture(f);
      setShowLigneForm(f.lignes.length === 0);
    });
    getActesMedicaux().then(setActes);
    getLettresCles().then(setLettresCles);
    getCodesAffection().then(setCodesAffection);
  }, [factureId]);

  useEffect(() => {
    if (!facture) return;
    getAssuresSante(facture.contratId).then(setAssures);
    getAccordsPrealablesContrat(facture.contratId).then(setAccords);
  }, [facture?.contratId]);

  // Aperçu du taux de prise en charge / part assurance en direct, dès que
  // les 3 informations nécessaires au calcul sont connues — sans persister
  // (voir FacturesService.apercuLigne), pour l'afficher dans la section
  // Tarification avant même l'ajout de la ligne.
  const rejetTotal = form.montantRejete > 0 && form.montantRejete >= form.montant;

  useEffect(() => {
    if (!form.assure || !form.montant || rejetTotal) { setApercu(null); return; }
    const t = setTimeout(() => {
      apercuLigneFacture(factureId, {
        assureId: form.assure!.id, typePrestation: form.typePrestation, montant: form.montant,
        acteMedicalId: form.acte?.id, montantRejete: form.montantRejete || undefined,
      }).then(setApercu).catch(() => setApercu(null));
    }, 300);
    return () => clearTimeout(t);
  }, [factureId, form.assure, form.typePrestation, form.montant, form.montantRejete, form.acte, rejetTotal]);

  const accordsDeLAssure = useMemo(
    () => (form.assure ? accords.filter((a) => a.assureId === form.assure!.id && a.decision === "Accordé") : []),
    [accords, form.assure],
  );

  const famillesActes = useMemo(() => [...new Set(actes.map((a) => a.famille))].sort(), [actes]);
  const actesDeLaFamille = useMemo(() => actes.filter((a) => a.famille === form.famille), [actes, form.famille]);
  const lettresActives = useMemo(() => lettresCles.filter((l) => l.actif), [lettresCles]);

  const totaux = useMemo(() => {
    if (!facture) return { fraisReels: 0, partAssurance: 0, partAssure: 0, totalRejete: 0, montantTps: 0, netAPayer: 0 };
    const actives = facture.lignes.filter((l) => l.statut !== "Rejeté");
    const rejetees = facture.lignes.filter((l) => l.statut === "Rejeté");
    const partAssurance = actives.reduce((s, l) => s + (l.baseRemboursement ?? 0), 0);
    const montantTps = actives.reduce((s, l) => s + (l.montantTps ?? 0), 0);
    return {
      fraisReels: actives.reduce((s, l) => s + l.montant, 0),
      partAssurance,
      partAssure: actives.reduce((s, l) => s + (l.resteACharge ?? 0), 0),
      // Rejet total (lignes statut "Rejeté") + rejets partiels des lignes
      // restées "Déclaré" (voir PriseEnCharge.montantRejete).
      totalRejete: rejetees.reduce((s, l) => s + l.montant, 0) + actives.reduce((s, l) => s + (l.montantRejete ?? 0), 0),
      montantTps,
      // Net à payer au prestataire, jamais les frais réels ni même la
      // simple part assurance : la TPS retenue (prestataires assujettis)
      // doit être déduite — voir feedback-montant-net-a-payer.
      netAPayer: partAssurance - montantTps,
    };
  }, [facture]);

  const handleSelectFamille = (famille: string) => {
    setForm((v) => ({ ...v, famille, acte: null }));
  };

  const handleSelectActe = (acteId: string) => {
    const acte = actesDeLaFamille.find((a) => a.id === acteId) ?? null;
    if (!acte) { setForm((v) => ({ ...v, acte: null, ligneDeriveeCode: null })); return; }
    setForm((v) => ({
      ...v, acte, ligneDeriveeCode: null, montant: acte.prixDefaut * (v.quantite || 1),
      genererBundleKC: acte.lettreCleCode === CODE_KC,
      // La rubrique de garantie de l'acte (categorieGarantie) correspond
      // désormais DIRECTEMENT à une valeur de TYPES_PRESTATION (taxonomie
      // alignée, 2026-09) — plus besoin d'une table de correspondance.
      typePrestation: (acte.categorieGarantie && TYPES_PRESTATION.includes(acte.categorieGarantie) ? acte.categorieGarantie : null) || v.typePrestation,
    }));
  };

  const handleQuantiteChange = (quantite: number) => {
    setForm((v) => (v.acte ? { ...v, quantite, montant: v.acte.prixDefaut * quantite } : { ...v, quantite }));
  };

  // KC entraîne la génération automatique des lignes KA et K Loc liées
  // (2026-08) — un seul coefficient, celui paramétré sur l'acte KC dans le
  // catalogue, suffit à dériver les deux autres : coef(KA) = coef(KC)/2,
  // coef(K Loc) = coef(KC)+coef(KA), chacune valorisée avec la valeur
  // unitaire propre à SA lettre (voir demande utilisateur + réponse à la
  // question de clarification posée en session).
  const bundleKC = useMemo(() => {
    if (!form.acte || form.acte.lettreCleCode !== CODE_KC || !form.acte.coefficient) return null;
    const coefKC = form.acte.coefficient;
    const coefKA = coefKC / 2;
    const coefKLoc = coefKC + coefKA;
    const valKA = lettresActives.find((l) => l.code === CODE_KA)?.valeurUnitaire ?? 0;
    const valKLoc = lettresActives.find((l) => l.code === CODE_K_LOC)?.valeurUnitaire ?? 0;
    const q = form.quantite || 1;
    return {
      kc: { coef: coefKC, montant: form.acte.prixDefaut * q },
      ka: { coef: coefKA, montant: coefKA * valKA * q },
      kloc: { coef: coefKLoc, montant: coefKLoc * valKLoc * q },
    };
  }, [form.acte, form.quantite, lettresActives]);

  // Rouvre une ligne déjà saisie dans le formulaire ci-dessus pour la
  // corriger (voir demande utilisateur : pouvoir consulter et modifier les
  // lignes d'une facture déjà en cours ou déjà soumise). Réservé aux lignes
  // pas encore rejetées manuellement (voir bouton "Modifier" dans le
  // tableau) — les objets assure/acte/accord doivent être retrouvés dans
  // les listes déjà chargées, la ligne elle-même ne portant que leurs id.
  const handleEditerLigne = (ligne: FactureLigne) => {
    const assure = assures.find((a) => a.id === ligne.assureId) ?? null;
    const acte = ligne.acteMedicalId ? actes.find((a) => a.id === ligne.acteMedicalId) ?? null : null;
    const accord = ligne.accordPrealableId ? accords.find((a) => a.id === ligne.accordPrealableId) ?? null : null;
    setEditingLigneId(ligne.id);
    setForm({
      assure, typePrestation: ligne.typePrestation, datePrestation: ligne.datePrestation, accord,
      famille: acte?.famille ?? "", acte,
      ligneDeriveeCode: !acte && ligne.lettreCleCode ? ligne.lettreCleCode : null,
      ligneDeriveeCoefficient: !acte && ligne.lettreCleCode ? (ligne.coefficient ?? null) : null,
      genererBundleKC: false,
      quantite: ligne.quantite ?? 1, montant: ligne.montant, montantRejete: ligne.montantRejete ?? 0,
      ...mapMotifRejet(ligne.motifRejet),
      nSinistre: ligne.nSinistre ?? "", nDeclaration: ligne.nDeclaration ?? "",
      natureMaladie: ligne.natureMaladie ?? "AffectionCourante",
      codeAffection: ligne.codeAffection ? codesAffection.find((c) => c.code === ligne.codeAffection) ?? null : null,
    });
    setApercu(null);
    setShowLigneForm(true);
  };

  const handleAnnulerEdition = () => {
    setEditingLigneId(null);
    setForm((v) => ({ ...emptyLigneForm(), datePrestation: v.datePrestation }));
    setApercu(null);
    setShowLigneForm(false);
  };

  const handleAjouterLigne = async () => {
    if (!form.assure || !form.montant) {
      toast.error("Assuré et frais réels sont obligatoires.");
      return;
    }
    if (!form.acte && !form.ligneDeriveeCode) {
      toast.error("Un acte médical est obligatoire.");
      return;
    }
    if (form.montantRejete > 0 && !form.motifRejetSaisie.trim()) {
      toast.error("Un motif est obligatoire en cas de rejet, total ou partiel.");
      return;
    }
    if (form.montantRejete > 0 && form.motifRejetSaisie === MOTIF_REJET_AUTRE && !form.motifRejetAutre.trim()) {
      toast.error("Précisez le motif de rejet (\"AUTRE\").");
      return;
    }
    if (!form.codeAffection) {
      toast.error("Le code affection est obligatoire.");
      return;
    }
    const motifRejetFinal = form.motifRejetSaisie === MOTIF_REJET_AUTRE ? form.motifRejetAutre.trim() : form.motifRejetSaisie.trim();
    const basePayload = {
      assureId: form.assure.id, typePrestation: form.typePrestation, datePrestation: form.datePrestation,
      accordPrealableId: form.accord?.id,
      motifRejet: form.montantRejete > 0 ? motifRejetFinal : undefined,
      montantRejete: form.montantRejete || 0,
      nSinistre: form.nSinistre.trim() || undefined, nDeclaration: form.nDeclaration.trim() || undefined,
      natureMaladie: form.natureMaladie, codeAffection: form.codeAffection.code,
    };
    try {
      setSubmitting(true);
      if (editingLigneId) {
        // Ligne "dérivée" (KA/K Loc sans acte de catalogue) : lettreCleCode/
        // coefficient d'origine ne sont pas renvoyés, donc préservés tels
        // quels côté serveur (voir SanteService.modifierLigneFacture).
        const payload = form.acte
          ? { ...basePayload, acteMedicalId: form.acte.id, lettreCleCode: form.acte.lettreCleCode, coefficient: form.acte.coefficient, quantite: form.quantite, montant: form.montant }
          : { ...basePayload, quantite: form.quantite, montant: form.montant };
        await modifierLigneFacture(factureId, editingLigneId, payload);
        toast.success("Ligne modifiée.");
        // Après une correction, le tableau reprend la priorité d'affichage
        // (voir capture utilisateur — repliage systématique du formulaire).
        setShowLigneForm(false);
      } else if (form.acte?.lettreCleCode === CODE_KC && form.genererBundleKC && bundleKC) {
        // KC entraîne la génération automatique des lignes KA et K Loc liées
        // — le coefficient est déjà connu (paramétré une fois sur l'acte du
        // catalogue), plus besoin de le ressaisir à chaque facture (voir
        // demande utilisateur).
        const q = form.quantite || 1;
        const lignes = [
          { acteMedicalId: form.acte.id, lettreCleCode: CODE_KC, coefficient: bundleKC.kc.coef, montant: bundleKC.kc.montant },
          { lettreCleCode: CODE_KA, coefficient: bundleKC.ka.coef, montant: bundleKC.ka.montant },
          { lettreCleCode: CODE_K_LOC, coefficient: bundleKC.kloc.coef, montant: bundleKC.kloc.montant },
        ];
        for (const item of lignes) {
          await ajouterLigneFacture(factureId, { ...basePayload, ...item, quantite: q });
        }
        toast.success("Lignes KC, KA et K Loc ajoutées.");
      } else {
        const payload = { ...basePayload, acteMedicalId: form.acte!.id, lettreCleCode: form.acte!.lettreCleCode, coefficient: form.acte!.coefficient, quantite: form.quantite, montant: form.montant };
        await ajouterLigneFacture(factureId, payload);
        toast.success(rejetTotal ? "Ligne ajoutée et rejetée." : form.montantRejete > 0 ? "Ligne ajoutée avec rejet partiel." : "Ligne ajoutée.");
      }
      setEditingLigneId(null);
      setForm((v) => ({ ...emptyLigneForm(), datePrestation: v.datePrestation }));
      setApercu(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement de la ligne impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmerRejet = async (ligneId: string) => {
    if (!motifRejet.trim()) { toast.error("Un motif de rejet est obligatoire."); return; }
    if (motifRejet === MOTIF_REJET_AUTRE && !motifRejetAutreConfirm.trim()) { toast.error("Précisez le motif de rejet (\"AUTRE\")."); return; }
    const motifFinal = motifRejet === MOTIF_REJET_AUTRE ? motifRejetAutreConfirm.trim() : motifRejet.trim();
    try {
      await rejeterLigneFacture(factureId, ligneId, motifFinal);
      toast.success("Ligne rejetée.");
      setRejetLigneId(null);
      setMotifRejet("");
      setMotifRejetAutreConfirm("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejet impossible.");
    }
  };

  const handleSupprimer = async (ligne: FactureLigne) => {
    const ok = window.confirm(`Retirer la ligne "${ligne.acteLibelle ?? ligne.typePrestation}" (${ligne.assureNom}) ?`);
    if (!ok) return;
    try {
      await supprimerLigneFacture(factureId, ligne.id);
      toast.success("Ligne retirée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleTerminer = async () => {
    try {
      await terminerFacture(factureId);
      toast.success("Facture terminée.");
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de terminer la facture.");
    }
  };

  const handleAnnuler = async () => {
    if (!motifAnnulationSaisie.trim()) { toast.error("Un motif d'annulation est obligatoire."); return; }
    try {
      await annulerFacture(factureId, motifAnnulationSaisie.trim());
      toast.success("Facture annulée.");
      setShowAnnuler(false);
      setMotifAnnulationSaisie("");
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    }
  };

  const handleImprimer = async () => {
    try {
      await openDecompteFacture(factureId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération du décompte impossible.");
    }
  };

  // Numéros de facture prestataire additionnels — une déclaration peut en
  // regrouper plusieurs si la saisie a été traitée en batch.
  const handleAjouterNumero = async () => {
    if (!nouveauNumero.trim()) return;
    setAjoutNumeroEnCours(true);
    try {
      await ajouterNumeroFacture(factureId, nouveauNumero.trim());
      setNouveauNumero("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout du numéro impossible.");
    } finally {
      setAjoutNumeroEnCours(false);
    }
  };

  const handleSupprimerNumero = async (numeroId: string) => {
    try {
      await supprimerNumeroFacture(factureId, numeroId);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleClose = () => {
    onChanged?.();
    onClose();
  };

  if (!facture) return null;
  const estAnnulee = facture.statut === "Annulée";

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[92vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">{facture.referenceFacture} — {facture.prestataireNom}</h3>
            <p className="text-[12px] text-muted-foreground">
              {facture.clientNom} · Réception {facture.dateReception} · <Badge variant={estAnnulee ? "danger" : facture.statut === "Soumise" ? "success" : "warning"}>{facture.statut}</Badge>
              {facture.bordereauNumero && <> · <Badge variant="info">Réglée — N° {facture.bordereauNumero}</Badge></>}
            </p>
            <div className="mt-0.5"><DerniereModification entite="factures" entiteId={facture.id} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={handleImprimer}><Printer className="w-4 h-4" />Décompte</Btn>
            <button type="button" onClick={handleClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="px-5 pt-4 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Numéros de facture additionnels :</span>
            {facture.numerosSupplementaires.length === 0 && <span className="text-[11px] text-muted-foreground italic">aucun</span>}
            {facture.numerosSupplementaires.map((n) => (
              <span key={n.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[11px] text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                {n.numero}
                {!estAnnulee && <button type="button" onClick={() => handleSupprimerNumero(n.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>}
              </span>
            ))}
            {!estAnnulee && (
              <span className="inline-flex items-center gap-1">
                <input
                  value={nouveauNumero}
                  onChange={(e) => setNouveauNumero(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAjouterNumero(); }}
                  placeholder="Ajouter un numéro…"
                  className="h-7 px-2 rounded-md border border-border bg-background text-[11px] text-foreground placeholder:text-muted-foreground w-36"
                />
                <button type="button" onClick={handleAjouterNumero} disabled={ajoutNumeroEnCours || !nouveauNumero.trim()} className="h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        </div>

        {estAnnulee && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2 flex-shrink-0">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-foreground"><span className="font-semibold">Facture annulée.</span> {facture.motifAnnulation}</p>
          </div>
        )}

        {!estAnnulee && (
          <div className="px-5 pt-4 flex-shrink-0 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground">{facture.lignes.length} ligne{facture.lignes.length > 1 ? "s" : ""} saisie{facture.lignes.length > 1 ? "s" : ""}</span>
            {!showLigneForm ? (
              <Btn variant="primary" onClick={() => setShowLigneForm(true)}><Plus className="w-4 h-4" />Ajouter une ligne</Btn>
            ) : (
              <Btn variant="ghost" onClick={() => { setShowLigneForm(false); if (editingLigneId) handleAnnulerEdition(); }}>Masquer le formulaire</Btn>
            )}
          </div>
        )}

        {!estAnnulee && showLigneForm && (
          <div className="p-5 border-b border-border flex-shrink-0 bg-secondary/20 overflow-y-auto" style={{ maxHeight: "42vh" }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <div className={labelCls}>Assuré / ayant droit</div>
                <Combobox
                  options={assures} value={form.assure}
                  onChange={(a) => setForm((v) => ({ ...v, assure: a, accord: null }))}
                  getLabel={(a) => `${a.nom} ${a.prenom ?? ""}`.trim()} getSubLabel={(a) => a.matricule} getId={(a) => a.id}
                  placeholder="Rechercher…"
                />
              </div>
              <div>
                <div className={labelCls}>Type de prestation</div>
                <select value={form.typePrestation} onChange={(e) => setForm((v) => ({ ...v, typePrestation: e.target.value }))} className={fieldCls}>
                  {TYPES_PRESTATION.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className={labelCls}>Référence prise en charge</div>
                <Combobox
                  options={accordsDeLAssure} value={form.accord}
                  onChange={(a) => setForm((v) => ({ ...v, accord: a }))}
                  getLabel={(a) => a.id} getSubLabel={(a) => `${a.description} · ${a.montantAutorise ? fmtM(a.montantAutorise) : "—"} FCFA`} getId={(a) => a.id}
                  placeholder={form.assure ? "Optionnel…" : "Choisir un assuré d'abord"}
                  disabled={!form.assure}
                />
              </div>
              <div>
                <div className={labelCls}>Date de prestation</div>
                <DateInput value={form.datePrestation} onChange={(v) => setForm((f) => ({ ...f, datePrestation: v }))} className={fieldCls} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 mb-3">
              <div className={sectionHeaderCls}><ListChecks className="w-3.5 h-3.5" />Identification de l'acte</div>
              {form.ligneDeriveeCode ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[12.5px] text-muted-foreground">Ligne dérivée automatiquement — lettre clé <span className="font-semibold text-foreground">{form.ligneDeriveeCode}</span>, coefficient <span className="font-semibold text-foreground">{form.ligneDeriveeCoefficient}</span> (non modifiable ici — voir l'acte KC d'origine)</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className={labelCls}>Famille d'acte *</div>
                    <select value={form.famille} onChange={(e) => handleSelectFamille(e.target.value)} className={fieldCls}>
                      <option value="">— Sélectionnez une famille —</option>
                      {famillesActes.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={labelCls}>Acte médical *</div>
                    <select value={form.acte?.id ?? ""} onChange={(e) => handleSelectActe(e.target.value)} disabled={!form.famille} className={`${fieldCls} disabled:opacity-60`}>
                      <option value="">{form.famille ? "— Sélectionnez un acte —" : "Choisir une famille d'abord"}</option>
                      {actesDeLaFamille.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={labelCls}>Quantité</div>
                    <input type="number" min={1} value={form.quantite || ""} onChange={(e) => handleQuantiteChange(e.target.value ? Number(e.target.value) : 1)} className={fieldCls} />
                  </div>
                </div>
              )}
              {form.acte?.lettreCleCode && form.acte.lettreCleCode !== CODE_KC && (
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1"><Hash className="w-3 h-3" />Codifié — {form.acte.lettreCleCode} · coefficient {form.acte.coefficient}</p>
              )}
              {bundleKC && (
                <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.genererBundleKC} onChange={(e) => setForm((v) => ({ ...v, genererBundleKC: e.target.checked }))} className="rounded border-border" />
                    <span className="text-[12px] text-foreground font-medium">Générer aussi les lignes KA (anesthésiste) et K Loc (location du bloc) — coefficients dérivés automatiquement</span>
                  </label>
                  {form.genererBundleKC && (
                    <div className="text-[11.5px] text-muted-foreground space-y-0.5 pl-6" style={{ fontFamily: "'DM Mono', monospace" }}>
                      <p>{form.acte?.libelle} (KC {bundleKC.kc.coef}) : {fmtM(bundleKC.kc.montant)} FCFA</p>
                      <p>K Anesthésie (KA {bundleKC.ka.coef}) : {fmtM(bundleKC.ka.montant)} FCFA</p>
                      <p>Location bloc (K Loc {bundleKC.kloc.coef}) : {fmtM(bundleKC.kloc.montant)} FCFA</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4 mb-3">
              <div className={sectionHeaderCls}><FileWarning className="w-3.5 h-3.5" />Dossier sinistre santé</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <div className={labelCls}>N° Sinistre</div>
                  <input value={form.nSinistre} onChange={(e) => setForm((v) => ({ ...v, nSinistre: e.target.value }))} className={fieldCls} placeholder="ex: 00565 / 2024" />
                </div>
                <div>
                  <div className={labelCls}>N° Déclaration</div>
                  <input value={form.nDeclaration} onChange={(e) => setForm((v) => ({ ...v, nDeclaration: e.target.value }))} className={fieldCls} placeholder="ex: 36 258 / 2024" />
                </div>
              </div>
              {/* Nature de l'affection + code CNAMGS (2026-08) — voir demande
                  utilisateur : "il fallait créer une rubrique nature de
                  l'affection dans la saisie de la facture... ça permettra à
                  l'application d'avoir des données statistique réels de
                  santé... sans faire remonter ses données dans les documents
                  statistiques." Jamais affiché sur le Décompte (toujours
                  "Affection Courante" à l'écran) — strictement interne. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={labelCls}>Nature de l'affection *</div>
                  <div className="flex gap-2">
                    {OPTIONS_NATURE_MALADIE.map((o) => (
                      <button
                        key={o.valeur} type="button" onClick={() => setForm((v) => ({ ...v, natureMaladie: o.valeur }))}
                        className={`h-9 flex-1 px-3 rounded-lg border text-[12.5px] font-medium ${form.natureMaladie === o.valeur ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Code affection (CNAMGS) *</div>
                  <Combobox
                    options={codesAffection}
                    value={form.codeAffection}
                    onChange={(c) => setForm((v) => ({ ...v, codeAffection: c }))}
                    getLabel={(c) => `${c.code} — ${c.libelle}`} getSubLabel={(c) => c.chapitre} getId={(c) => c.code}
                    placeholder="Rechercher un code affection…"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 mb-3">
              <div className={sectionHeaderCls}><CircleDollarSign className="w-3.5 h-3.5" />Tarification</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className={labelCls}>Prix de référence de l'acte</div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                    <Tag className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                    <span className="text-[13px] font-semibold text-sky-700">{form.acte ? `${fmtM(form.acte.prixDefaut)} FCFA` : "—"}</span>
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Taux / part de prise en charge</div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2">
                    <Percent className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    <span className="text-[13px] font-semibold text-green-700">
                      {rejetTotal ? "Rejetée — 0%"
                        : apercu?.tauxRemboursement !== undefined ? `${apercu.tauxRemboursement}% (${fmtM(apercu.baseRemboursement ?? 0)} FCFA)`
                        : apercu?.plafondApplique !== undefined ? `Plafonné (${fmtM(apercu.baseRemboursement ?? 0)} FCFA)`
                        : "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Frais réels (coût total) *</div>
                  <input type="number" value={form.montant || ""} onChange={(e) => setForm((v) => ({ ...v, montant: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} />
                </div>
              </div>
              {apercu?.messagePlafond && (
                <p className="text-[11.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-3">{apercu.messagePlafond}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <div className={labelCls}>Montant rejeté (contesté par le contrôle médical)</div>
                  <input
                    type="number" value={form.montantRejete || ""}
                    onChange={(e) => setForm((v) => ({ ...v, montantRejete: e.target.value ? Number(e.target.value) : 0 }))}
                    className={fieldCls} placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Retiré des frais réels avant calcul de la part assurance et de la part assuré. Rempli avec le montant total = rejet complet de la ligne.</p>
                </div>
                <div>
                  <div className={labelCls}>Motif du rejet{form.montantRejete > 0 ? " *" : ""}</div>
                  <Combobox
                    options={MOTIFS_REJET_FACTURE.map((m) => ({ id: m, libelle: m }))}
                    value={form.motifRejetSaisie ? { id: form.motifRejetSaisie, libelle: form.motifRejetSaisie } : null}
                    onChange={(m) => setForm((v) => ({ ...v, motifRejetSaisie: m?.libelle ?? "", motifRejetAutre: m?.libelle === MOTIF_REJET_AUTRE ? v.motifRejetAutre : "" }))}
                    getLabel={(m) => m.libelle} getId={(m) => m.id}
                    placeholder="Choisir un motif…"
                  />
                  {form.motifRejetSaisie === MOTIF_REJET_AUTRE && (
                    <input
                      value={form.motifRejetAutre} onChange={(e) => setForm((v) => ({ ...v, motifRejetAutre: e.target.value }))}
                      className={`${fieldCls} mt-1.5`} placeholder="Préciser le motif…"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Btn variant="primary" disabled={submitting} onClick={handleAjouterLigne}>
                {editingLigneId ? <><Pencil className="w-4 h-4" />Enregistrer les modifications</> : <><Plus className="w-4 h-4" />Ajouter la ligne</>}
              </Btn>
              {editingLigneId && <Btn variant="ghost" onClick={handleAnnulerEdition}>Annuler la modification</Btn>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border sticky top-0 bg-card">
                {["Assuré", "Acte", "Qté", "Type", "Date", "Frais réels", "Rejeté", "Part assurance", "Part assuré", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l) => (
                <tr key={l.id} className={`border-b border-border/50 ${l.statut === "Rejeté" ? "opacity-50" : ""} ${editingLigneId === l.id ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{l.assureNom}</td>
                  <td className="px-3 py-2 text-foreground">{l.acteLibelle ?? (l.lettreCleCode ? `${l.lettreCleCode} (coef. ${l.coefficient ?? "—"})` : "—")}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground whitespace-nowrap">{l.quantite ?? 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><Badge variant={l.typePrestation === "Hospitalisation" ? "danger" : "neutral"}>{l.typePrestation}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{l.datePrestation}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-destructive" style={{ fontFamily: "'DM Mono', monospace" }}>
                    {l.montantRejete ? (
                      <span title={l.motifRejet}>{fmtM(l.montantRejete)}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-green-500" style={{ fontFamily: "'DM Mono', monospace" }}>{l.baseRemboursement !== undefined ? fmtM(l.baseRemboursement) : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.resteACharge !== undefined ? fmtM(l.resteACharge) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {l.statut === "Rejeté" ? <Badge variant="danger">Rejeté</Badge> : <Badge variant="success">{l.statut}</Badge>}
                    {l.motifRejet && <p className="text-[10px] text-destructive mt-0.5 max-w-[160px] truncate" title={l.motifRejet}>{l.motifRejet}</p>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {l.statut !== "Rejeté" && (
                      <div className="flex items-center gap-1">
                        {!estAnnulee && (
                          <button type="button" onClick={() => handleEditerLigne(l)} className="p-1.5 rounded hover:bg-secondary text-primary" title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                        <button type="button" onClick={() => { setRejetLigneId(l.id); setMotifRejet(""); setMotifRejetAutreConfirm(""); }} className="p-1.5 rounded hover:bg-secondary text-amber-500" title="Rejeter"><Ban className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleSupprimer(l)} className="p-1.5 rounded hover:bg-secondary text-destructive" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {facture.lignes.length === 0 && (
                <tr><td colSpan={11} className="text-center text-muted-foreground text-xs py-10">Aucune ligne saisie — utilisez le formulaire ci-dessus.</td></tr>
              )}
            </tbody>
          </table>

          {rejetLigneId && (
            <div className="mt-4 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg">
              <p className="text-[12.5px] font-semibold text-foreground mb-2">Motif de rejet</p>
              <Combobox
                options={MOTIFS_REJET_FACTURE.map((m) => ({ id: m, libelle: m }))}
                value={motifRejet ? { id: motifRejet, libelle: motifRejet } : null}
                onChange={(m) => { setMotifRejet(m?.libelle ?? ""); if (m?.libelle !== MOTIF_REJET_AUTRE) setMotifRejetAutreConfirm(""); }}
                getLabel={(m) => m.libelle} getId={(m) => m.id}
                placeholder="Choisir un motif…"
              />
              {motifRejet === MOTIF_REJET_AUTRE && (
                <input
                  value={motifRejetAutreConfirm} onChange={(e) => setMotifRejetAutreConfirm(e.target.value)}
                  className={`${fieldCls} mt-1.5`} placeholder="Préciser le motif…"
                />
              )}
              <div className="flex gap-2 mt-2">
                <Btn variant="primary" onClick={() => handleConfirmerRejet(rejetLigneId)}><Ban className="w-4 h-4" />Confirmer le rejet</Btn>
                <Btn variant="ghost" onClick={() => { setRejetLigneId(null); setMotifRejet(""); setMotifRejetAutreConfirm(""); }}>Annuler</Btn>
              </div>
            </div>
          )}

          {showAnnuler && (
            <div className="mt-4 p-4 border border-destructive/30 bg-destructive/5 rounded-lg">
              <p className="text-[12.5px] font-semibold text-foreground mb-2">Motif d'annulation de la facture</p>
              <textarea value={motifAnnulationSaisie} onChange={(e) => setMotifAnnulationSaisie(e.target.value)} rows={2} className={fieldCls} placeholder="Ex. facture en double, erreur de saisie du prestataire…" />
              <div className="flex gap-2 mt-2">
                <Btn variant="primary" onClick={handleAnnuler}><XCircle className="w-4 h-4" />Confirmer l'annulation</Btn>
                <Btn variant="ghost" onClick={() => { setShowAnnuler(false); setMotifAnnulationSaisie(""); }}>Retour</Btn>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between bg-secondary/20 flex-wrap gap-3">
          <div className="flex items-center gap-5 text-[12.5px] flex-wrap">
            <span className="text-muted-foreground">Frais réels : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.fraisReels)} FCFA</span></span>
            <span className="text-muted-foreground">Part assuré : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.partAssure)} FCFA</span></span>
            <span className="text-muted-foreground">Rejeté : <span className="text-destructive font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.totalRejete)} FCFA</span></span>
            {totaux.montantTps > 0 && (
              <span className="text-muted-foreground">TPS retenue : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.montantTps)} FCFA</span></span>
            )}
            <span className="text-foreground font-semibold">Net à payer au prestataire : <span className="text-primary font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.netAPayer)} FCFA</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" onClick={handleClose}>Fermer</Btn>
            {!estAnnulee && (
              <>
                <Btn variant="ghost" onClick={() => setShowAnnuler(true)}><XCircle className="w-4 h-4" />Annuler la facture</Btn>
                {facture.statut !== "Soumise" && <Btn variant="primary" onClick={handleTerminer}><CheckCircle2 className="w-4 h-4" />Terminer la facture</Btn>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
