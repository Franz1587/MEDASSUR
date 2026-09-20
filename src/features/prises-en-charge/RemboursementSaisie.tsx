import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Ban, CheckCircle2, X, Tag, Percent, XCircle, ListChecks, CircleDollarSign, FileWarning, Pencil, Hash, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { DerniereModification } from "@/components/shared/DerniereModification";
import { fmtM } from "@/lib/format";
import {
  getRemboursement, ajouterLigneRemboursement, modifierLigneRemboursement, rejeterLigneRemboursement, supprimerLigneRemboursement, terminerRemboursement,
  annulerRemboursement, apercuLigneRemboursement,
} from "@/services/remboursements.service";
import { getAssuresSante } from "@/services/sante.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import { getAccordsPrealablesContrat } from "@/services/accordPrealable.service";
import { getLettresCles } from "@/services/lettresCles.service";
import { getCodesAffection, type CodeAffection } from "@/services/codesAffection.service";
import { getPrestataires } from "@/services/prestataires.service";
import { OPTIONS_NATURE_MALADIE, type NatureMaladie } from "@/lib/natureMaladie";
import { MOTIFS_REJET_FACTURE, MOTIF_REJET_AUTRE, mapMotifRejet } from "@/lib/motifsRejet";
import type { Remboursement, RemboursementLigne } from "@/types/remboursement";
import type { ApercuLigne } from "@/types/facture";
import type { AssureSante } from "@/types/sante";
import type { ActeMedical } from "@/types/acteMedical";
import type { AccordPrealable } from "@/types/accordPrealable";
import type { LettreCle } from "@/types/lettresCles";
import type { Prestataire } from "@/types/prestataires";
import { CODE_KA, CODE_KC, CODE_K_LOC } from "@/types/lettresCles";

// Doit rester strictement identique à TYPES_PRESTATION/RUBRIQUES_PLAFONNEES
// (backend/src/sante/dto/create-facture-ligne.dto.ts) — même moteur de
// calcul qu'une Facture (voir SanteService.creerLigneRemboursement) —
// taxonomie alignée sur le modèle standard 2026-09 (contrat 3M PARTNERS &
// CONSEILS, police 10005316).
const TYPES_PRESTATION = ["Ambulatoire", "Consultations", "Actes de Spécialités", "Pharmacie", "Imagerie", "Analyses Médicale", "Petite Chirurgie/Soins", "Hospitalisation", "Soins & Prothèses dentaires", "Optique", "Kinésithérapie & Cure thermale", "Maternité", "Transport", "Orthophonie", "Orthoptie", "Autre"];

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionHeaderCls = "flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-primary mb-3";

interface LigneForm {
  assure: AssureSante | null;
  prestataire: Prestataire | null;
  prestataireNomLibre: string;
  typePrestation: string;
  datePrestation: string;
  accord: AccordPrealable | null;
  famille: string;
  acte: ActeMedical | null;
  ligneDeriveeCode: string | null;
  ligneDeriveeCoefficient: number | null;
  genererBundleKC: boolean;
  quantite: number;
  montant: number;
  montantRejete: number;
  motifRejetSaisie: string;
  motifRejetAutre: string;
  nSinistre: string;
  nDeclaration: string;
  natureMaladie: NatureMaladie;
  codeAffection: CodeAffection | null;
}

function emptyLigneForm(): LigneForm {
  return {
    assure: null, prestataire: null, prestataireNomLibre: "",
    typePrestation: "Ambulatoire", datePrestation: new Date().toLocaleDateString("fr-FR"), accord: null,
    famille: "", acte: null, ligneDeriveeCode: null, ligneDeriveeCoefficient: null, genererBundleKC: true, quantite: 1,
    montant: 0, montantRejete: 0, motifRejetSaisie: "", motifRejetAutre: "",
    nSinistre: "", nDeclaration: "", natureMaladie: "AffectionCourante", codeAffection: null,
  };
}

export default function RemboursementSaisie({ remboursementId, onClose, onChanged }: { remboursementId: string; onClose: () => void; onChanged?: () => void }) {
  const [remboursement, setRemboursement] = useState<Remboursement | null>(null);
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [accords, setAccords] = useState<AccordPrealable[]>([]);
  const [lettresCles, setLettresCles] = useState<LettreCle[]>([]);
  const [codesAffection, setCodesAffection] = useState<CodeAffection[]>([]);
  const [form, setForm] = useState<LigneForm>(emptyLigneForm());
  const [editingLigneId, setEditingLigneId] = useState<string | null>(null);
  const [showLigneForm, setShowLigneForm] = useState(false);
  const [apercu, setApercu] = useState<ApercuLigne | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejetLigneId, setRejetLigneId] = useState<string | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [motifRejetAutreConfirm, setMotifRejetAutreConfirm] = useState("");
  const [showAnnuler, setShowAnnuler] = useState(false);
  const [motifAnnulationSaisie, setMotifAnnulationSaisie] = useState("");

  const refresh = () => getRemboursement(remboursementId).then(setRemboursement);

  useEffect(() => {
    getRemboursement(remboursementId).then((r) => {
      setRemboursement(r);
      setShowLigneForm(r.lignes.length === 0);
    });
    getPrestataires().then(setPrestataires);
    getActesMedicaux().then(setActes);
    getLettresCles().then(setLettresCles);
    getCodesAffection().then(setCodesAffection);
  }, [remboursementId]);

  useEffect(() => {
    if (!remboursement) return;
    getAssuresSante(remboursement.contratId).then(setAssures);
    getAccordsPrealablesContrat(remboursement.contratId).then(setAccords);
  }, [remboursement?.contratId]);

  const rejetTotal = form.montantRejete > 0 && form.montantRejete >= form.montant;

  useEffect(() => {
    if (!form.assure || !form.montant || rejetTotal) { setApercu(null); return; }
    const t = setTimeout(() => {
      apercuLigneRemboursement(remboursementId, {
        assureId: form.assure!.id, typePrestation: form.typePrestation, montant: form.montant,
        acteMedicalId: form.acte?.id, montantRejete: form.montantRejete || undefined,
        prestataireId: form.prestataire?.id,
      }).then(setApercu).catch(() => setApercu(null));
    }, 300);
    return () => clearTimeout(t);
  }, [remboursementId, form.assure, form.typePrestation, form.montant, form.montantRejete, form.acte, form.prestataire, rejetTotal]);

  const accordsDeLAssure = useMemo(
    () => (form.assure ? accords.filter((a) => a.assureId === form.assure!.id && a.decision === "Accordé") : []),
    [accords, form.assure],
  );

  const famillesActes = useMemo(() => [...new Set(actes.map((a) => a.famille))].sort(), [actes]);
  const actesDeLaFamille = useMemo(() => actes.filter((a) => a.famille === form.famille), [actes, form.famille]);
  const lettresActives = useMemo(() => lettresCles.filter((l) => l.actif), [lettresCles]);

  const totaux = useMemo(() => {
    if (!remboursement) return { fraisReels: 0, partAssurance: 0, partAssure: 0, totalRejete: 0 };
    const actives = remboursement.lignes.filter((l) => l.statut !== "Rejeté");
    const rejetees = remboursement.lignes.filter((l) => l.statut === "Rejeté");
    return {
      fraisReels: actives.reduce((s, l) => s + l.montant, 0),
      partAssurance: actives.reduce((s, l) => s + (l.baseRemboursement ?? 0), 0),
      partAssure: actives.reduce((s, l) => s + (l.resteACharge ?? 0), 0),
      totalRejete: rejetees.reduce((s, l) => s + l.montant, 0) + actives.reduce((s, l) => s + (l.montantRejete ?? 0), 0),
    };
  }, [remboursement]);

  const handleSelectFamille = (famille: string) => setForm((v) => ({ ...v, famille, acte: null }));

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

  const handleEditerLigne = (ligne: RemboursementLigne) => {
    const assure = assures.find((a) => a.id === ligne.assureId) ?? null;
    const prestataire = ligne.prestataireId ? prestataires.find((p) => p.id === ligne.prestataireId) ?? null : null;
    const acte = ligne.acteMedicalId ? actes.find((a) => a.id === ligne.acteMedicalId) ?? null : null;
    const accord = ligne.accordPrealableId ? accords.find((a) => a.id === ligne.accordPrealableId) ?? null : null;
    setEditingLigneId(ligne.id);
    setForm({
      assure, prestataire, prestataireNomLibre: prestataire ? "" : ligne.prestataireNom,
      typePrestation: ligne.typePrestation, datePrestation: ligne.datePrestation, accord,
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
      toast.error("Bénéficiaire et frais réels sont obligatoires.");
      return;
    }
    if (!form.prestataire && !form.prestataireNomLibre.trim()) {
      toast.error("Le prestataire est obligatoire — recherchez-le dans le réseau, ou saisissez son nom s'il n'est pas conventionné.");
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
      assureId: form.assure.id, prestataireId: form.prestataire?.id, prestataireNom: form.prestataire ? undefined : form.prestataireNomLibre.trim(),
      typePrestation: form.typePrestation, datePrestation: form.datePrestation,
      accordPrealableId: form.accord?.id,
      motifRejet: form.montantRejete > 0 ? motifRejetFinal : undefined,
      montantRejete: form.montantRejete || 0,
      nSinistre: form.nSinistre.trim() || undefined, nDeclaration: form.nDeclaration.trim() || undefined,
      natureMaladie: form.natureMaladie, codeAffection: form.codeAffection.code,
    };
    try {
      setSubmitting(true);
      if (editingLigneId) {
        const payload = form.acte
          ? { ...basePayload, acteMedicalId: form.acte.id, lettreCleCode: form.acte.lettreCleCode, coefficient: form.acte.coefficient, quantite: form.quantite, montant: form.montant }
          : { ...basePayload, quantite: form.quantite, montant: form.montant };
        await modifierLigneRemboursement(remboursementId, editingLigneId, payload);
        toast.success("Ligne modifiée.");
        setShowLigneForm(false);
      } else if (form.acte?.lettreCleCode === CODE_KC && form.genererBundleKC && bundleKC) {
        const q = form.quantite || 1;
        const lignes = [
          { acteMedicalId: form.acte.id, lettreCleCode: CODE_KC, coefficient: bundleKC.kc.coef, montant: bundleKC.kc.montant },
          { lettreCleCode: CODE_KA, coefficient: bundleKC.ka.coef, montant: bundleKC.ka.montant },
          { lettreCleCode: CODE_K_LOC, coefficient: bundleKC.kloc.coef, montant: bundleKC.kloc.montant },
        ];
        for (const item of lignes) {
          await ajouterLigneRemboursement(remboursementId, { ...basePayload, ...item, quantite: q });
        }
        toast.success("Lignes KC, KA et K Loc ajoutées.");
      } else {
        const payload = { ...basePayload, acteMedicalId: form.acte!.id, lettreCleCode: form.acte!.lettreCleCode, coefficient: form.acte!.coefficient, quantite: form.quantite, montant: form.montant };
        await ajouterLigneRemboursement(remboursementId, payload);
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
      await rejeterLigneRemboursement(remboursementId, ligneId, motifFinal);
      toast.success("Ligne rejetée.");
      setRejetLigneId(null);
      setMotifRejet("");
      setMotifRejetAutreConfirm("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejet impossible.");
    }
  };

  const handleSupprimer = async (ligne: RemboursementLigne) => {
    const ok = window.confirm(`Retirer la ligne "${ligne.acteLibelle ?? ligne.typePrestation}" (${ligne.assureNom}) ?`);
    if (!ok) return;
    try {
      await supprimerLigneRemboursement(remboursementId, ligne.id);
      toast.success("Ligne retirée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleTerminer = async () => {
    try {
      await terminerRemboursement(remboursementId);
      toast.success("Déclaration terminée.");
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de terminer la déclaration.");
    }
  };

  const handleAnnuler = async () => {
    if (!motifAnnulationSaisie.trim()) { toast.error("Un motif d'annulation est obligatoire."); return; }
    try {
      await annulerRemboursement(remboursementId, motifAnnulationSaisie.trim());
      toast.success("Déclaration annulée.");
      setShowAnnuler(false);
      setMotifAnnulationSaisie("");
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    }
  };

  const handleClose = () => {
    onChanged?.();
    onClose();
  };

  if (!remboursement) return null;
  const estAnnulee = remboursement.statut === "Annulée";
  const beneficiaireLabel = remboursement.beneficiaire === "AssurePrincipal" ? (remboursement.assurePrincipalNom ?? "Assuré principal") : remboursement.clientNom;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[92vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">{remboursement.id} — À l'ordre de {beneficiaireLabel}</h3>
            <p className="text-[12px] text-muted-foreground">
              <Badge variant="neutral">{remboursement.beneficiaire === "AssurePrincipal" ? "Assuré principal" : "Souscripteur"}</Badge> · {remboursement.clientNom} · Déclaré le {remboursement.dateDeclaration} · <Badge variant={estAnnulee ? "danger" : remboursement.statut === "Soumise" ? "success" : "warning"}>{remboursement.statut}</Badge>
              {remboursement.bordereauNumero && <> · <Badge variant="info">Réglée — N° {remboursement.bordereauNumero}</Badge></>}
            </p>
            <div className="mt-0.5"><DerniereModification entite="remboursements" entiteId={remboursement.id} /></div>
          </div>
          <button type="button" onClick={handleClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {estAnnulee && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2 flex-shrink-0">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-foreground"><span className="font-semibold">Déclaration annulée.</span> {remboursement.motifAnnulation}</p>
          </div>
        )}

        {!estAnnulee && (
          <div className="px-5 pt-4 flex-shrink-0 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground">{remboursement.lignes.length} ligne{remboursement.lignes.length > 1 ? "s" : ""} saisie{remboursement.lignes.length > 1 ? "s" : ""}</span>
            {!showLigneForm ? (
              <Btn variant="primary" onClick={() => setShowLigneForm(true)}><Plus className="w-4 h-4" />Ajouter une ligne</Btn>
            ) : (
              <Btn variant="ghost" onClick={() => { setShowLigneForm(false); if (editingLigneId) handleAnnulerEdition(); }}>Masquer le formulaire</Btn>
            )}
          </div>
        )}

        {!estAnnulee && showLigneForm && (
          <div className="p-5 border-b border-border flex-shrink-0 bg-secondary/20 overflow-y-auto" style={{ maxHeight: "44vh" }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <div className={labelCls}>Assuré / ayant droit ayant consommé le soin</div>
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
                  placeholder={form.assure ? "Optionnel…" : "Choisir un bénéficiaire d'abord"}
                  disabled={!form.assure}
                />
              </div>
              <div>
                <div className={labelCls}>Date de prestation</div>
                <DateInput value={form.datePrestation} onChange={(v) => setForm((f) => ({ ...f, datePrestation: v }))} className={fieldCls} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 mb-3">
              <div className={sectionHeaderCls}><Building2 className="w-3.5 h-3.5" />Prestataire consulté (à l'origine des frais)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={labelCls}>Recherché dans le réseau conventionné</div>
                  <Combobox
                    options={prestataires} value={form.prestataire}
                    onChange={(p) => setForm((v) => ({ ...v, prestataire: p, prestataireNomLibre: "" }))}
                    getLabel={(p) => p.nom} getSubLabel={(p) => `${p.type} · ${p.ville}`} getId={(p) => p.id}
                    placeholder="Rechercher…" allowClear clearLabel="Aucun — structure non conventionnée"
                  />
                </div>
                <div>
                  <div className={labelCls}>Ou nom si non conventionné</div>
                  <input
                    value={form.prestataireNomLibre} disabled={!!form.prestataire}
                    onChange={(e) => setForm((v) => ({ ...v, prestataireNomLibre: e.target.value }))}
                    className={`${fieldCls} disabled:opacity-60`} placeholder="Ex. Cabinet médical..."
                  />
                </div>
              </div>
              {!form.prestataire && (
                <p className="text-[11px] text-muted-foreground mt-2">Sans structure conventionnée reconnue, le taux de prise en charge (ambulatoire/hospitalisation) ne peut pas être calculé automatiquement — seules les rubriques à plafond fixe (dentaire, optique…) le sont.</p>
              )}
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
                  <div className={labelCls}>Frais réels (montant présenté) *</div>
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
                {["Bénéficiaire", "Prestataire", "Acte", "Qté", "Type", "Date", "Frais réels", "Rejeté", "Part assurance", "Part assuré", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {remboursement.lignes.map((l) => (
                <tr key={l.id} className={`border-b border-border/50 ${l.statut === "Rejeté" ? "opacity-50" : ""} ${editingLigneId === l.id ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{l.assureNom}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[160px] truncate" title={l.prestataireNom}>{l.prestataireNom}</td>
                  <td className="px-3 py-2 text-foreground">{l.acteLibelle ?? (l.lettreCleCode ? `${l.lettreCleCode} (coef. ${l.coefficient ?? "—"})` : "—")}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground whitespace-nowrap">{l.quantite ?? 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><Badge variant={l.typePrestation === "Hospitalisation" ? "danger" : "neutral"}>{l.typePrestation}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{l.datePrestation}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-destructive" style={{ fontFamily: "'DM Mono', monospace" }}>
                    {l.montantRejete ? <span title={l.motifRejet}>{fmtM(l.montantRejete)}</span> : "—"}
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
              {remboursement.lignes.length === 0 && (
                <tr><td colSpan={12} className="text-center text-muted-foreground text-xs py-10">Aucune ligne saisie — utilisez le formulaire ci-dessus.</td></tr>
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
              <p className="text-[12.5px] font-semibold text-foreground mb-2">Motif d'annulation de la déclaration</p>
              <textarea value={motifAnnulationSaisie} onChange={(e) => setMotifAnnulationSaisie(e.target.value)} rows={2} className={fieldCls} placeholder="Ex. déclaration en double, erreur de saisie…" />
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
            <span className="text-muted-foreground">Part assuré (non remboursée) : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.partAssure)} FCFA</span></span>
            <span className="text-muted-foreground">Rejeté : <span className="text-destructive font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.totalRejete)} FCFA</span></span>
            <span className="text-foreground font-semibold">Total à rembourser à {beneficiaireLabel} : <span className="text-primary font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totaux.partAssurance)} FCFA</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" onClick={handleClose}>Fermer</Btn>
            {!estAnnulee && (
              <>
                <Btn variant="ghost" onClick={() => setShowAnnuler(true)}><XCircle className="w-4 h-4" />Annuler la déclaration</Btn>
                {remboursement.statut !== "Soumise" && <Btn variant="primary" onClick={handleTerminer}><CheckCircle2 className="w-4 h-4" />Terminer la déclaration</Btn>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
