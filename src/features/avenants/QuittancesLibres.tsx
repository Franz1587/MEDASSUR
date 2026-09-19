import { useEffect, useState } from "react";
import { format, parse, addMonths, isValid } from "date-fns";
import { Plus, ChevronDown, ChevronUp, Ban, CheckCircle2, RotateCcw, ReceiptText, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import {
  getQuittancesLibres, createQuittanceLibre, annulerQuittanceLibre, payerTranche, annulerPaiementTranche,
} from "@/services/quittanceLibre.service";
import { openQuittanceTranche } from "@/services/documents.service";
import { getBanques } from "@/services/banques.service";
import type { QuittanceLibre } from "@/types/quittanceLibre";
import type { Contrat } from "@/types/contrats";
import type { Banque } from "@/types/banques";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const statutVariant: Record<string, "neutral" | "info" | "success" | "danger"> = {
  "En cours": "info",
  "Soldée": "success",
  "Annulée": "danger",
};

function todayFr(): string {
  return format(new Date(), "dd/MM/yyyy");
}

function parseFr(value: string): Date | null {
  const d = parse(value, "dd/MM/yyyy", new Date());
  return isValid(d) ? d : null;
}

interface TrancheDraft {
  montant: number;
  dateEcheance: string;
}

interface TranchePersoDraft {
  primeNette: number;
  accessoires: number;
  dateEcheance: string;
}

const INTERVALLES = [
  { label: "Mensuelle", mois: 1 },
  { label: "Trimestrielle", mois: 3 },
  { label: "Semestrielle", mois: 6 },
  { label: "Annuelle", mois: 12 },
];

function repartirEgal(montantTotal: number, nombre: number, premiereEcheance: string, intervalleMois: number): TrancheDraft[] {
  const base = parseFr(premiereEcheance) ?? new Date();
  const montantTranche = Math.floor(montantTotal / nombre);
  const reste = montantTotal - montantTranche * nombre;
  return Array.from({ length: nombre }, (_, i) => ({
    montant: i === nombre - 1 ? montantTranche + reste : montantTranche,
    dateEcheance: format(addMonths(base, i * intervalleMois), "dd/MM/yyyy"),
  }));
}

// Mode "Personnalisée" (2026-08) — voir demande utilisateur : "on doit
// pouvoir saisir librement, manuellement la prime nette et les
// accessoires. Le calcul de la taxe de 8% et la prime TTC doit se faire
// automatiquement dans le respect la règle de calcul d'une prime." Même
// règle que Contrat.montantTaxe (8% de prime nette + accessoires) —
// aperçu client uniquement, le serveur recalcule la même chose comme
// source de vérité (voir QuittancesLibresService.decomposerManuel).
const TAUX_TAXE_GABON = 0.08;
const arrondi2 = (n: number) => Math.round(n * 100) / 100;

function calculerTrancheManuelle(t: TranchePersoDraft) {
  const primeNette = arrondi2(t.primeNette || 0);
  const accessoires = arrondi2(t.accessoires || 0);
  const taxe = arrondi2((primeNette + accessoires) * TAUX_TAXE_GABON);
  const montant = arrondi2(primeNette + accessoires + taxe);
  return { primeNette, accessoires, taxe, montant };
}

// Prime TTC réelle d'un contrat (2026-08) — voir demande utilisateur : "il
// ne remonte pas le bon montant... c'est 26 150 000 en TTC" : Contrat.prime
// peut diverger de la vraie prime totale à payer (voir la Quittance
// classique du contrat, DocumentsService.quittanceDonnees) — le total réel
// est TOUJOURS primeNette + accessoires + taxe, jamais le champ `prime` brut
// pris seul. Même formule que le backend (documents.service.ts
// TAUX_TAXE_GABON) pour préremplir "Montant total" avec le même chiffre que
// celui imprimé sur la Quittance du contrat.
function primeTTCReelle(c: Contrat): number {
  const primeNette = c.primeNette ?? c.prime;
  const accessoires = c.montantAccessoires ?? 0;
  const taxe = c.montantTaxe ?? Math.round((primeNette + accessoires) * TAUX_TAXE_GABON);
  return arrondi2(primeNette + accessoires + taxe);
}

function emptyPayerForm() {
  return { dateEncaissement: todayFr(), modePaiement: "", banqueId: "", referencePaiement: "" };
}

// Champs complémentaires selon le mode de paiement (2026-08) — voir demande
// utilisateur : "quand on choisi comme mode de paiement chèque ou Virement
// qu'on puisse choisir la banque et que l'on renseigne la référence...
// après. Pour le mobile money il y a aussi la référence de la transaction.
// Pour l'espèce il n'y a rien a renseigner."
const MODES_AVEC_BANQUE = ["Chèque", "Virement"];
const MODES_AVEC_REFERENCE_SEULE = ["Mobile Money"];

interface Props {
  contrats: Contrat[];
}

// Quittance Libre (2026-08) — voir demande utilisateur : "il faut qu'on
// puisse quittancer librement même au cours d'un exercice sans que cela ne
// soit forcément lié à un avenant... échelonner le paiement d'une prime
// annuelle en plusieurs tranches (égale par le nombre de trimestre, de
// semestre, ou n'importe quel montant)... décompte entre ce qui est payé et
// ce qui reste à payer."
export default function QuittancesLibresTab({ contrats }: Props) {
  const [quittances, setQuittances] = useState<QuittanceLibre[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const toggleExpanded = (id: string) => setExpandedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const [showCreate, setShowCreate] = useState(false);
  const [contratId, setContratId] = useState("");
  const [montantTotal, setMontantTotal] = useState(0);
  const [dateCreation, setDateCreation] = useState(todayFr());
  const [mode, setMode] = useState<"Egales" | "Personnalisee">("Egales");
  const [nombreTranches, setNombreTranches] = useState(4);
  const [intervalleMois, setIntervalleMois] = useState(3);
  const [premiereEcheance, setPremiereEcheance] = useState(todayFr());
  const [tranchesPerso, setTranchesPerso] = useState<TranchePersoDraft[]>([{ primeNette: 0, accessoires: 0, dateEcheance: todayFr() }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [payerTrancheId, setPayerTrancheId] = useState<string | null>(null);
  const [payerForm, setPayerForm] = useState(emptyPayerForm());
  const [banques, setBanques] = useState<Banque[]>([]);

  const refresh = () => getQuittancesLibres().then(setQuittances);
  useEffect(() => { refresh(); getBanques().then(setBanques); }, []);

  const contrat = contrats.find((c) => c.id === contratId);

  const openCreate = () => {
    setContratId(""); setMontantTotal(0); setDateCreation(todayFr());
    setMode("Egales"); setNombreTranches(4); setIntervalleMois(3); setPremiereEcheance(todayFr());
    setTranchesPerso([{ primeNette: 0, accessoires: 0, dateEcheance: todayFr() }]);
    setFormError(null);
    setShowCreate(true);
  };

  const handleContratChange = (id: string) => {
    setContratId(id);
    const c = contrats.find((x) => x.id === id);
    setMontantTotal(c ? primeTTCReelle(c) : 0);
  };

  const tranchesEgales = mode === "Egales" && montantTotal > 0 && nombreTranches > 0
    ? repartirEgal(montantTotal, nombreTranches, premiereEcheance, intervalleMois)
    : [];
  const tranchesPersoCalc = tranchesPerso.map(calculerTrancheManuelle);
  const montantTotalPersonnalise = arrondi2(tranchesPersoCalc.reduce((s, t) => s + t.montant, 0));

  const ajouterTranchePerso = () => setTranchesPerso((ts) => [...ts, { primeNette: 0, accessoires: 0, dateEcheance: todayFr() }]);
  const supprimerTranchePerso = (i: number) => setTranchesPerso((ts) => ts.filter((_, x) => x !== i));
  const majTranchePerso = (i: number, patch: Partial<TranchePersoDraft>) =>
    setTranchesPerso((ts) => ts.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  const handleCreate = async () => {
    if (!contratId || !dateCreation) {
      setFormError("Contrat et date de création sont obligatoires.");
      return;
    }
    if (mode === "Egales" && !montantTotal) {
      setFormError("Montant total obligatoire.");
      return;
    }
    if (mode === "Personnalisee" && montantTotalPersonnalise <= 0) {
      setFormError("Renseignez au moins une tranche avec une prime nette.");
      return;
    }
    try {
      setSubmitting(true);
      if (mode === "Egales") {
        await createQuittanceLibre({ contratId, montantTotal, dateCreation, tranches: tranchesEgales });
      } else {
        await createQuittanceLibre({
          contratId, montantTotal: montantTotalPersonnalise, dateCreation,
          tranches: tranchesPerso.map((t, i) => ({
            primeNette: tranchesPersoCalc[i].primeNette, accessoires: tranchesPersoCalc[i].accessoires,
            montant: tranchesPersoCalc[i].montant, dateEcheance: t.dateEcheance,
          })),
        });
      }
      setShowCreate(false);
      refresh();
      toast.success("Quittance libre créée avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création de la quittance libre.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnnuler = async (q: QuittanceLibre) => {
    const motif = window.prompt(`Motif d'annulation de la quittance libre ${q.id} :`);
    if (!motif) return;
    try {
      await annulerQuittanceLibre(q.id, motif);
      refresh();
      toast.success("Quittance libre annulée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    }
  };

  const openPayer = (trancheId: string) => {
    setPayerTrancheId(trancheId);
    setPayerForm(emptyPayerForm());
  };

  const handleConfirmerPaiement = async () => {
    if (!payerTrancheId) return;
    try {
      await payerTranche(payerTrancheId, {
        dateEncaissement: payerForm.dateEncaissement,
        modePaiement: payerForm.modePaiement || undefined,
        banqueId: MODES_AVEC_BANQUE.includes(payerForm.modePaiement) ? (payerForm.banqueId || undefined) : undefined,
        referencePaiement: payerForm.modePaiement === "Espèces" ? undefined : (payerForm.referencePaiement || undefined),
      });
      setPayerTrancheId(null);
      refresh();
      toast.success("Tranche marquée payée — encaissement créé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paiement impossible.");
    }
  };

  const handleAnnulerPaiement = async (trancheId: string) => {
    const ok = window.confirm("Annuler le paiement de cette tranche ? L'encaissement lié sera supprimé.");
    if (!ok) return;
    try {
      await annulerPaiementTranche(trancheId);
      refresh();
      toast.success("Paiement de la tranche annulé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation du paiement impossible.");
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle quittance libre</Btn>
      </div>
      <div className="space-y-3">
        {quittances.map((q) => {
          const paye = q.tranches.filter((t) => t.encaissement).reduce((s, t) => s + t.montant, 0);
          const resteAPayer = q.montantTotal - paye;
          return (
            <div key={q.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-primary med-num">{q.id}</span>
                    <Badge variant={statutVariant[q.statut] ?? "neutral"}>{q.statut}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{q.clientNom} · <span className="text-muted-foreground font-normal">{q.compagnieNom}</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Créée le {q.dateCreation} · {q.tranches.length} tranche{q.tranches.length > 1 ? "s" : ""}</p>
                  {q.statut === "Annulée" && q.motifAnnulation && (
                    <p className="text-xs text-destructive mt-1">Motif d'annulation : {q.motifAnnulation}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[15px] font-bold text-foreground med-num">{fmtM(q.montantTotal)}</div>
                  <p className="text-xs mt-1">
                    <span className="text-emerald-500 med-num">{fmtM(paye)} payé</span>
                    {resteAPayer > 0 && <span className="text-amber-400 med-num"> · {fmtM(resteAPayer)} restant</span>}
                  </p>
                </div>
              </div>

              <div className="mt-2">
                <button type="button" onClick={() => toggleExpanded(q.id)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                  {expandedIds.includes(q.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Décompte des tranches
                </button>
                {expandedIds.includes(q.id) && (
                  <div className="mt-2 space-y-1">
                    {q.tranches.map((t) => (
                      <div key={t.id} className="px-3 py-2 rounded-lg bg-secondary/30 text-[11.5px]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium">Tranche {t.numero}</span>
                            <span className="text-muted-foreground med-num">{fmtM(t.montant)}</span>
                            <span className="text-muted-foreground">Échéance {t.dateEcheance}</span>
                          </div>
                          {t.encaissement ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="success"><CheckCircle2 className="w-3 h-3" />Payée le {t.encaissement.dateEncaissement}</Badge>
                              {(t.encaissement.modePaiement || t.encaissement.banqueNom || t.encaissement.referencePaiement) && (
                                <span className="text-muted-foreground">
                                  {[t.encaissement.modePaiement, t.encaissement.banqueNom, t.encaissement.referencePaiement && `n°${t.encaissement.referencePaiement}`].filter(Boolean).join(" · ")}
                                </span>
                              )}
                              {/* Quittance PAR TRANCHE (2026-08) — voir demande utilisateur :
                                  "la quittance libre [doit] réellement remonter le calcul de la
                                  tranche qui a été payée, et non le calcul de la prime annuelle" —
                                  un document distinct par tranche encaissée, jamais le bouton
                                  unique au niveau du plan qui imprimait la prime annuelle entière. */}
                              <button
                                type="button"
                                onClick={() => openQuittanceTranche(t.id).catch((e) => toast.error(e instanceof Error ? e.message : "Erreur de génération."))}
                                title="Télécharger la quittance de cette tranche"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                              {q.statut !== "Annulée" && (
                                <button type="button" onClick={() => handleAnnulerPaiement(t.id)} title="Annuler ce paiement" className="text-muted-foreground hover:text-destructive">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            q.statut !== "Annulée" && (
                              <Btn variant="secondary" onClick={() => openPayer(t.id)}>Marquer payée</Btn>
                            )
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span>Prime nette <span className="med-num text-foreground">{fmtM(t.primeNette)}</span></span>
                          <span>+ Accessoires <span className="med-num text-foreground">{fmtM(t.accessoires)}</span></span>
                          <span>+ Taxe 8% <span className="med-num text-foreground">{fmtM(t.taxe)}</span></span>
                          <span>= <span className="med-num text-foreground font-medium">{fmtM(t.primeNette + t.accessoires + t.taxe)}</span> TTC</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {q.statut === "En cours" && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
                  <Btn variant="ghost" onClick={() => handleAnnuler(q)}><Ban className="w-4 h-4" />Annuler la quittance libre</Btn>
                </div>
              )}
            </div>
          );
        })}
        {quittances.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Aucune quittance libre enregistrée</div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle quittance libre</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <div className={labelCls}>Contrat</div>
                  <Combobox
                    options={contrats}
                    value={contrat ?? null}
                    onChange={(c) => handleContratChange(c?.id ?? "")}
                    getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block"><div className={labelCls}>Date de création</div><DateInput value={dateCreation} onChange={setDateCreation} className={fieldCls} /></label>
              </div>

              <div className="flex items-center gap-1 mt-5 mb-3 bg-secondary/30 rounded-lg p-1 w-fit">
                <button type="button" onClick={() => setMode("Egales")} className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${mode === "Egales" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Tranches égales</button>
                <button type="button" onClick={() => setMode("Personnalisee")} className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${mode === "Personnalisee" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Personnalisée</button>
              </div>

              {mode === "Egales" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="block"><div className={labelCls}>Montant total (FCFA)</div><input type="number" value={montantTotal} onChange={(e) => setMontantTotal(Number(e.target.value))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Nombre de tranches</div><input type="number" min={1} value={nombreTranches} onChange={(e) => setNombreTranches(Number(e.target.value))} className={fieldCls} /></label>
                  <label className="block">
                    <div className={labelCls}>Intervalle</div>
                    <select value={intervalleMois} onChange={(e) => setIntervalleMois(Number(e.target.value))} className={fieldCls}>
                      {INTERVALLES.map((i) => <option key={i.mois} value={i.mois}>{i.label}</option>)}
                    </select>
                  </label>
                  <label className="block"><div className={labelCls}>1ère échéance</div><DateInput value={premiereEcheance} onChange={setPremiereEcheance} className={fieldCls} /></label>
                  <div className="md:col-span-3 space-y-1 mt-1">
                    {tranchesEgales.map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary/30 text-[11.5px]">
                        <span className="text-foreground">Tranche {i + 1}</span>
                        <span className="text-muted-foreground med-num">{fmtM(t.montant)} — échéance {t.dateEcheance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10.5px] text-muted-foreground">Saisissez la prime nette et les accessoires de chaque tranche — la taxe (8%) et le montant TTC sont calculés automatiquement.</p>
                  {tranchesPerso.map((t, i) => {
                    const calc = tranchesPersoCalc[i];
                    return (
                      <div key={i} className="rounded-lg bg-secondary/30 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11.5px] text-muted-foreground w-16 flex-shrink-0">Tranche {i + 1}</span>
                          <input type="number" placeholder="Prime nette" value={t.primeNette} onChange={(e) => majTranchePerso(i, { primeNette: Number(e.target.value) })} className={`${fieldCls} flex-1 min-w-[110px]`} />
                          <input type="number" placeholder="Accessoires" value={t.accessoires} onChange={(e) => majTranchePerso(i, { accessoires: Number(e.target.value) })} className={`${fieldCls} flex-1 min-w-[110px]`} />
                          <DateInput value={t.dateEcheance} onChange={(v) => majTranchePerso(i, { dateEcheance: v })} className={`${fieldCls} flex-1 min-w-[130px]`} />
                          {tranchesPerso.length > 1 && (
                            <button type="button" onClick={() => supprimerTranchePerso(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">✕</button>
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground pl-[72px] flex items-center gap-3 flex-wrap">
                          <span>Taxe 8% <span className="med-num text-foreground">{fmtM(calc.taxe)}</span></span>
                          <span>= <span className="med-num text-foreground font-semibold">{fmtM(calc.montant)}</span> TTC</span>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={ajouterTranchePerso} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1 mt-1"><Plus className="w-3.5 h-3.5" />Ajouter une tranche</button>
                  <div className="text-[13px] font-semibold text-foreground mt-2 med-num">
                    Montant total (TTC, calculé) : {fmtM(montantTotalPersonnalise)}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payerTrancheId && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2"><ReceiptText className="w-4 h-4" />Marquer la tranche payée</h3>
              <button type="button" onClick={() => setPayerTrancheId(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block"><div className={labelCls}>Date d'encaissement</div><DateInput value={payerForm.dateEncaissement} onChange={(v) => setPayerForm((f) => ({ ...f, dateEncaissement: v }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Mode de paiement</div>
                <select value={payerForm.modePaiement} onChange={(e) => setPayerForm({ ...emptyPayerForm(), dateEncaissement: payerForm.dateEncaissement, modePaiement: e.target.value })} className={fieldCls}>
                  <option value="">—</option>
                  <option>Espèces</option><option>Chèque</option><option>Virement</option><option>Mobile Money</option>
                </select>
              </label>
              {MODES_AVEC_BANQUE.includes(payerForm.modePaiement) && (
                <>
                  <label className="block"><div className={labelCls}>Banque</div>
                    <Combobox
                      options={banques}
                      value={banques.find((b) => b.id === payerForm.banqueId) ?? null}
                      onChange={(b) => setPayerForm((f) => ({ ...f, banqueId: b?.id ?? "" }))}
                      getLabel={(b) => b.nom} getSubLabel={(b) => b.codeBanque ?? ""} getId={(b) => b.id}
                      placeholder="Rechercher…"
                    />
                  </label>
                  <label className="block"><div className={labelCls}>{payerForm.modePaiement === "Chèque" ? "N° de chèque" : "Référence du virement"}</div><input value={payerForm.referencePaiement} onChange={(e) => setPayerForm((f) => ({ ...f, referencePaiement: e.target.value }))} className={fieldCls} /></label>
                </>
              )}
              {MODES_AVEC_REFERENCE_SEULE.includes(payerForm.modePaiement) && (
                <label className="block"><div className={labelCls}>Référence de la transaction</div><input value={payerForm.referencePaiement} onChange={(e) => setPayerForm((f) => ({ ...f, referencePaiement: e.target.value }))} className={fieldCls} /></label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPayerTrancheId(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" onClick={handleConfirmerPaiement} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90">Confirmer le paiement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
