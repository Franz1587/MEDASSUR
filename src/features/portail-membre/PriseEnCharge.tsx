import { useEffect, useState } from "react";
import { ClipboardCheck, Plus, Upload, Check, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { messageErreur } from "@/lib/http";
import { getReseauSoins, type PrestataireReseau } from "@/services/reseauSoins.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import type { ActeMedical } from "@/types/acteMedical";
import {
  getMesPrisesEnChargePrealables, creerAccordPrealable, uploaderOrdonnanceAccordPrealable, uploaderDevisAccordPrealable, openCertificatDe,
  getMesGaranties,
  type MembreAccordPrealable, type CreateAccordPrealableInput, type LigneAccordPrealableInput,
} from "@/services/portailMembre.service";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2.5 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function decisionVariant(d: string): BadgeVariant {
  return d === "Accordé" ? "success" : d === "Refusé" ? "danger" : "warning";
}

interface EnTeteForm {
  type: CreateAccordPrealableInput["type"];
  dateDemande: string;
  prestataire: string;
  prestataireId?: string;
}
function emptyEnTete(type: string): EnTeteForm {
  return { type, dateDemande: "", prestataire: "" };
}

// Prise en charge (2026-08) — voir demande utilisateur : historique +
// soumission libre-service d'une nouvelle demande, où le prestataire et
// les actes se recherchent/sélectionnent dans le VRAI réseau et le VRAI
// catalogue de l'application (getReseauSoins/getActesMedicaux), au lieu de
// champs libres — "les données doivent remonter depuis les données saisies
// côté assurance... même application, données interconnectées".
export default function MembrePriseEnChargeView() {
  const [dossiers, setDossiers] = useState<MembreAccordPrealable[] | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [categoriesGarantie, setCategoriesGarantie] = useState<string[]>([]);
  const [enTete, setEnTete] = useState<EnTeteForm>(emptyEnTete(""));
  const [prestataireChoisi, setPrestataireChoisi] = useState<PrestataireReseau | null>(null);
  const [lignesForm, setLignesForm] = useState<LigneAccordPrealableInput[]>([]);
  const [acteAAjouter, setActeAAjouter] = useState<ActeMedical | null>(null);
  const [prestataires, setPrestataires] = useState<PrestataireReseau[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [ordonnance, setOrdonnance] = useState<File | null>(null);
  const [devis, setDevis] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const rafraichir = () => getMesPrisesEnChargePrealables().then(setDossiers);
  useEffect(() => {
    rafraichir();
    getReseauSoins().then(setPrestataires);
    getActesMedicaux().then(setActes);
    // Type de la demande = groupe de garantie (2026-08) — voir demande
    // utilisateur : "il faut faire remonter les familles de garanties...
    // groupe de garantie qui sont dans le tableau de garantie", dérivées du
    // VRAI tableau de garanties du contrat de l'assuré, jamais d'une liste
    // figée (voir memory feedback-no-hardcoded-data).
    getMesGaranties().then((garanties) => {
      const categories = [...new Set(garanties.map((g) => g.categorie))];
      setCategoriesGarantie(categories);
      setEnTete((v) => (v.type ? v : { ...v, type: categories[0] ?? "" }));
    });
  }, []);

  // Pas de pré-remplissage par acte.prixDefaut (2026-08) — voir demande
  // utilisateur : "il ne doit pas avoir le montant de l'assurance qui
  // remonte... il doit pouvoir renseigner le montant qui est sur le devis".
  // plafondReference reste transmis (sert au calcul interne de la quote-part,
  // jamais affiché ici) ; montantDevis démarre à 0, saisi par l'assuré.
  const ajouterActe = (acte: ActeMedical | null) => {
    if (!acte) return;
    setLignesForm((v) => [...v, {
      acteMedicalId: acte.id, lettreCleCode: acte.lettreCleCode, coefficient: acte.coefficient,
      description: acte.libelle, plafondReference: acte.prixDefaut, montantDevis: 0,
    }]);
    setActeAAjouter(null);
  };
  const retirerLigne = (i: number) => setLignesForm((v) => v.filter((_, idx) => idx !== i));
  const majMontantLigne = (i: number, montant: number) => setLignesForm((v) => v.map((l, idx) => (idx === i ? { ...l, montantDevis: montant } : l)));

  const totalDevis = lignesForm.reduce((s, l) => s + l.montantDevis, 0);

  const telechargerCertificat = async (d: MembreAccordPrealable) => {
    try {
      await openCertificatDe(d.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Certificat indisponible.");
    }
  };

  // Validation (2026-08) — voir demande utilisateur : "la saisie de l'acte
  // doit être facultative... mais l'ajout du fichier de l'ordonnance ou du
  // devis doit se faire et doit conditionner la demande". La décision reste
  // entièrement du ressort de l'assurance (statut "En attente" jusqu'au
  // traitement, voir AccordPrealableService.create) — l'acte n'est donc
  // qu'une aide facultative à la constitution du dossier, jamais un
  // prérequis.
  const soumettre = async () => {
    if (!enTete.prestataire || !enTete.dateDemande) {
      toast.error("Prestataire et date sont obligatoires.");
      return;
    }
    if (!ordonnance && !devis) {
      toast.error("Merci de joindre l'ordonnance ou le devis.");
      return;
    }
    setEnvoi(true);
    try {
      const cree = await creerAccordPrealable({ ...enTete, lignes: lignesForm });
      if (ordonnance) await uploaderOrdonnanceAccordPrealable(cree.id, ordonnance);
      if (devis) await uploaderDevisAccordPrealable(cree.id, devis);
      toast.success("Demande envoyée.");
      setFormulaireOuvert(false);
      setEnTete(emptyEnTete(categoriesGarantie[0] ?? ""));
      setPrestataireChoisi(null);
      setLignesForm([]);
      setOrdonnance(null);
      setDevis(null);
      rafraichir();
    } catch (err) {
      toast.error(messageErreur(err, "Envoi impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.2rem] font-bold text-foreground">Prise en charge</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Vos demandes d'entente préalable</p>
        </div>
        <Btn variant="primary" onClick={() => setFormulaireOuvert(true)}><Plus className="w-4 h-4" />Nouvelle</Btn>
      </div>

      {!dossiers ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : dossiers.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucune demande pour l'instant.</div>
      ) : (
        <div className="space-y-2.5">
          {dossiers.map((d) => (
            <div key={d.id} className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{d.description}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{d.prestataire} · {d.dateDemande}</p>
                </div>
                <Badge variant={decisionVariant(d.decision)}>{d.decision}</Badge>
              </div>
              {d.montantDevis != null && (
                <p className="text-[12px] text-muted-foreground mt-2">Devis : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(Number(d.montantDevis))} FCFA</span></p>
              )}
              {d.motifDecision && (
                <p className={`text-[12px] mt-1.5 ${d.decision === "Refusé" ? "text-destructive" : "text-muted-foreground"}`}>{d.motifDecision}</p>
              )}
              {d.decision === "Accordé" && (
                <button
                  type="button"
                  onClick={() => telechargerCertificat(d)}
                  className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
                >
                  <FileDown className="w-3.5 h-3.5" />Certificat de prise en charge
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {formulaireOuvert && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[88vh] overflow-y-auto space-y-3.5">
            <p className="text-[14px] font-semibold text-foreground flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" />Nouvelle demande</p>

            <label className="block">
              <div className={labelCls}>Type</div>
              <select value={enTete.type} onChange={(e) => setEnTete((v) => ({ ...v, type: e.target.value }))} className={fieldCls}>
                {categoriesGarantie.length === 0 && <option value="">Chargement…</option>}
                {categoriesGarantie.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <div className={labelCls}>Prestataire *</div>
              <Combobox
                options={prestataires}
                value={prestataireChoisi}
                onChange={(p) => { setPrestataireChoisi(p); setEnTete((v) => ({ ...v, prestataire: p?.nom ?? "", prestataireId: p?.id })); }}
                getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                placeholder="Rechercher un prestataire…"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Date de la demande *</div>
              <DateInput value={enTete.dateDemande} onChange={(v) => setEnTete((f) => ({ ...f, dateDemande: v }))} className={fieldCls} />
            </label>

            <label className="block">
              <div className={labelCls}>Ajouter un acte (facultatif)</div>
              <Combobox
                options={actes}
                value={acteAAjouter}
                onChange={ajouterActe}
                getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
                placeholder="Rechercher un acte à ajouter…"
              />
            </label>

            {lignesForm.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
                {lignesForm.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1 min-w-0 text-[12.5px] text-foreground truncate">{l.description}</span>
                    <input
                      type="number" value={l.montantDevis} onChange={(e) => majMontantLigne(i, Number(e.target.value))}
                      className="w-28 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    />
                    <button type="button" onClick={() => retirerLigne(i)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 font-semibold">
                  <span className="text-[12px] text-foreground">Total devis</span>
                  <span className="text-[12.5px] text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalDevis)} FCFA</span>
                </div>
              </div>
            )}

            <label className="block">
              <div className={labelCls}>Ordonnance {!devis && "*"}</div>
              <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input type="file" onChange={(e) => setOrdonnance(e.target.files?.[0] ?? null)} className="text-[12px] text-muted-foreground w-full" />
                {ordonnance && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              </div>
            </label>
            <label className="block">
              <div className={labelCls}>Devis {!ordonnance && "*"}</div>
              <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input type="file" onChange={(e) => setDevis(e.target.files?.[0] ?? null)} className="text-[12px] text-muted-foreground w-full" />
                {devis && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-1">Ordonnance ou devis obligatoire pour envoyer la demande.</p>
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => setFormulaireOuvert(false)} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <Btn variant="primary" onClick={soumettre} disabled={envoi} className="flex-1 justify-center">{envoi ? "Envoi…" : "Envoyer"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
