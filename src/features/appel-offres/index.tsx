import { useEffect, useState } from "react";
import {
  FileSearch, TrendingUp, Plus, Upload, Trash2, FileDown, Send, Pencil, Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  getAppelsOffres, createAppelOffres, updateAppelOffres,
  ajouterProposition, modifierProposition, supprimerProposition,
  uploaderDocumentAppelOffres, supprimerDocumentAppelOffres, appelOffresDocumentUrl,
} from "@/services/appelOffres.service";
import { getProspects } from "@/services/crm.service";
import { getCompagnies } from "@/services/compagnies.service";
import { openCotationOffre } from "@/services/documents.service";
import type { AppelOffres, AppelOffresUpsertInput, PropositionCommerciale } from "@/types/appelOffres";
import type { Prospect } from "@/types/crm";
import type { Compagnie } from "@/types/compagnies";

const statutVariant: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  "En cours": "info",
  "Proposition envoyée": "warning",
  "Gagné": "success",
  "Perdu": "danger",
};

const CLE_AO_HANDOFF = "medassur:cotation-appel-offres";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyCreateForm(): AppelOffresUpsertInput {
  return { prospectId: "", clientNom: "", cahierCharges: "", garantiesDemandees: "", projectionSP: 0, estimationPepm: 0, estimationFondsRoulement: 0 };
}

export default function AppelOffresView() {
  const { setView } = useShellNavigation();
  const [appelsOffres, setAppelsOffres] = useState<AppelOffres[]>([]);
  const [selected, setSelected] = useState<AppelOffres | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<AppelOffresUpsertInput>(emptyCreateForm());
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [uploadType, setUploadType] = useState("Cahier des charges");
  const [uploadCompagnieId, setUploadCompagnieId] = useState("");
  const [uploading, setUploading] = useState(false);

  const [showPropositionForm, setShowPropositionForm] = useState(false);
  const [editingPropositionId, setEditingPropositionId] = useState<string | null>(null);
  const [propNiveau, setPropNiveau] = useState("");
  const [propDescription, setPropDescription] = useState("");
  const [propPrime, setPropPrime] = useState(0);
  const [propCotationIds, setPropCotationIds] = useState<string[]>([]);
  const [savingProposition, setSavingProposition] = useState(false);

  const refresh = () => getAppelsOffres().then((data) => {
    setAppelsOffres(data);
    setSelected((s) => (s ? data.find((ao) => ao.id === s.id) ?? data[0] ?? null : data[0] ?? null));
  });

  useEffect(() => {
    refresh();
    getProspects().then(setProspects);
    getCompagnies().then(setCompagnies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProspect = (prospectId: string) => {
    const prospect = prospects.find((p) => p.id === prospectId);
    setCreateForm((v) => ({ ...v, prospectId, clientNom: prospect?.nom ?? v.clientNom }));
  };

  const handleCreate = async () => {
    if (!createForm.prospectId || !createForm.cahierCharges || !createForm.garantiesDemandees) {
      toast.error("Prospect, cahier des charges et garanties demandées sont obligatoires.");
      return;
    }
    setSubmittingCreate(true);
    try {
      const created = await createAppelOffres(createForm);
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
      await refresh();
      setSelected(created);
      toast.success("Appel d'offres créé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleChangerStatut = async (statut: string) => {
    if (!selected) return;
    try {
      await updateAppelOffres(selected.id, { statut });
      await refresh();
      toast.success("Statut mis à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    setUploading(true);
    try {
      await uploaderDocumentAppelOffres(selected.id, file, { type: uploadType, compagnieId: uploadCompagnieId || undefined });
      await refresh();
      toast.success("Document importé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setUploading(false);
    }
  };

  const handleSupprimerDocument = async (documentId: string) => {
    if (!selected) return;
    try {
      await supprimerDocumentAppelOffres(selected.id, documentId);
      await refresh();
      toast.success("Document supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const lancerCotation = () => {
    if (!selected) return;
    sessionStorage.setItem(CLE_AO_HANDOFF, JSON.stringify({ id: selected.id, clientNom: selected.clientNom }));
    setView("cotation");
  };

  const cotationsLibres = selected?.cotations.filter((c) => !selected.propositions.some((p) => p.cotations.some((pc) => pc.id === c.id))) ?? [];

  const ouvrirNouvelleProposition = () => {
    setEditingPropositionId(null);
    setPropNiveau("");
    setPropDescription("");
    setPropPrime(0);
    setPropCotationIds([]);
    setShowPropositionForm(true);
  };

  const ouvrirEditionProposition = (p: PropositionCommerciale) => {
    setEditingPropositionId(p.id);
    setPropNiveau(p.niveau);
    setPropDescription(p.descriptionGaranties);
    setPropPrime(p.primeProposee);
    setPropCotationIds(p.cotations.map((c) => c.id));
    setShowPropositionForm(true);
  };

  const toggleCotationSelection = (cotationId: string, primeTTC: number) => {
    setPropCotationIds((ids) => {
      const next = ids.includes(cotationId) ? ids.filter((id) => id !== cotationId) : [...ids, cotationId];
      const cotationsDisponibles = [...cotationsLibres, ...(selected?.propositions.find((p) => p.id === editingPropositionId)?.cotations ?? [])];
      const somme = next.reduce((s, id) => s + (cotationsDisponibles.find((c) => c.id === id)?.primeTTC ?? 0), 0);
      setPropPrime(somme || primeTTC);
      return next;
    });
  };

  const handleSaveProposition = async () => {
    if (!selected || !propNiveau || !propDescription) {
      toast.error("Le libellé et la description sont obligatoires.");
      return;
    }
    setSavingProposition(true);
    try {
      if (editingPropositionId) {
        await modifierProposition(selected.id, editingPropositionId, { niveau: propNiveau, primeProposee: propPrime, descriptionGaranties: propDescription, cotationIds: propCotationIds });
        toast.success("Proposition mise à jour.");
      } else {
        await ajouterProposition(selected.id, { niveau: propNiveau, primeProposee: propPrime, descriptionGaranties: propDescription, cotationIds: propCotationIds });
        toast.success("Proposition créée.");
      }
      await refresh();
      setShowPropositionForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingProposition(false);
    }
  };

  const handleSupprimerProposition = async (propositionId: string) => {
    if (!selected) return;
    const ok = window.confirm("Supprimer cette proposition ?");
    if (!ok) return;
    try {
      await supprimerProposition(selected.id, propositionId);
      await refresh();
      toast.success("Proposition supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const voirDocumentProposition = (p: PropositionCommerciale) => {
    if (p.cotations.length === 0) { toast.error("Aucune cotation rattachée à cette proposition."); return; }
    openCotationOffre(p.cotations.map((c) => c.id)).catch(() => toast.error("Ouverture du document impossible."));
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Appels d'Offres" subtitle="Suivi des appels d'offres, documents, offres reçues et propositions" icon={FileSearch}
        actions={<Btn variant="primary" onClick={() => { setCreateForm(emptyCreateForm()); setShowCreate(true); }}><Plus className="w-4 h-4" />Nouvel appel d'offres</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Appels d'offres ({appelsOffres.length})</h3>
          </div>
          <div className="divide-y divide-border/50">
            {appelsOffres.map((ao) => (
              <div key={ao.id} onClick={() => setSelected(ao)}
                className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === ao.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary med-num">{ao.id}</span>
                  <Badge variant={statutVariant[ao.statut] ?? "neutral"}>{ao.statut}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{ao.clientNom}</p>
              </div>
            ))}
            {appelsOffres.length === 0 && <p className="px-4 py-6 text-center text-muted-foreground text-[12.5px]">Aucun appel d'offres</p>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{selected.clientNom}</h3>
                  <select value={selected.statut} onChange={(e) => handleChangerStatut(e.target.value)} className="h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground">
                    <option>En cours</option>
                    <option>Proposition envoyée</option>
                    <option>Gagné</option>
                    <option>Perdu</option>
                  </select>
                </div>
                <p className="text-sm text-muted-foreground">{selected.cahierCharges}</p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Garanties demandées :</span> {selected.garantiesDemandees}</p>
                {selected.historiqueSinistres && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Historique :</span> {selected.historiqueSinistres}</p>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Projection S/P</p>
                    <p className="text-sm font-bold text-foreground">{selected.projectionSP}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimation PEPM</p>
                    <p className="text-sm font-bold text-foreground med-num">{fmtM(selected.estimationPepm)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fonds de roulement estimé</p>
                    <p className="text-sm font-bold text-foreground med-num">{fmtM(selected.estimationFondsRoulement)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">Documents</h3>
                <div className="space-y-1.5 mb-3">
                  {selected.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-[12.5px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="neutral">{d.type}</Badge>
                        <a href={appelOffresDocumentUrl(d.fichier)} target="_blank" rel="noreferrer" className="text-foreground hover:underline truncate">{d.nom}</a>
                      </div>
                      <button type="button" onClick={() => handleSupprimerDocument(d.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {selected.documents.length === 0 && <p className="text-[12px] text-muted-foreground">Aucun document importé</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground">
                    <option>Cahier des charges</option>
                    <option>Offre compagnie</option>
                    <option>Autre</option>
                  </select>
                  {uploadType === "Offre compagnie" && (
                    <select value={uploadCompagnieId} onChange={(e) => setUploadCompagnieId(e.target.value)} className="h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground">
                      <option value="">— Compagnie —</option>
                      {compagnies.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  )}
                  <label className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />{uploading ? "Import…" : "Importer un fichier"}
                    <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                  </label>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-sm">Offres reçues</h3>
                  <div className="flex items-center gap-2">
                    {selected.cotations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openCotationOffre(selected.cotations.map((c) => c.id)).catch(() => toast.error("Ouverture du document impossible."))}
                        className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <FileDown className="w-3.5 h-3.5" />Document combiné ({selected.cotations.length})
                      </button>
                    )}
                    <Btn variant="secondary" onClick={lancerCotation}><Calculator className="w-4 h-4" />Lancer une cotation pour cet AO</Btn>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {selected.cotations.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-[12.5px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{c.compagnie?.nom ?? "—"}</span>
                        <Badge variant="gold">{c.branche}</Badge>
                        {selected.propositions.some((p) => p.cotations.some((pc) => pc.id === c.id))
                          ? <Badge variant="info">Dans une proposition</Badge>
                          : <Badge variant="neutral">Libre</Badge>}
                      </div>
                      <span className="font-semibold text-foreground med-num">{fmtM(c.primeTTC)} FCFA</span>
                    </div>
                  ))}
                  {selected.cotations.length === 0 && <p className="text-[12px] text-muted-foreground">Aucune offre reçue pour l'instant</p>}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-sm">Propositions</h3>
                  <Btn variant="secondary" onClick={ouvrirNouvelleProposition}><Plus className="w-4 h-4" />Nouvelle proposition</Btn>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selected.propositions.map((p) => (
                    <div key={p.id} className="bg-secondary/20 border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="gold">{p.niveau}</Badge>
                        <Badge variant={p.statut === "Envoyée" ? "info" : "neutral"}>{p.statut}</Badge>
                      </div>
                      <p className="text-xl font-bold text-primary mb-1 med-num">{fmtM(p.primeProposee)} <span className="text-xs text-muted-foreground">FCFA</span></p>
                      <p className="text-xs text-muted-foreground mb-2">{p.descriptionGaranties}</p>
                      {p.cotations.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mb-2">{p.cotations.map((c) => `${c.compagnie?.nom ?? "?"} (${c.branche})`).join(" + ")}</p>
                      )}
                      <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                        <button type="button" onClick={() => voirDocumentProposition(p)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"><FileDown className="w-3.5 h-3.5" />Document</button>
                        <button type="button" onClick={() => ouvrirEditionProposition(p)} className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Éditer</button>
                        <button type="button" onClick={() => handleSupprimerProposition(p.id)} className="text-[11.5px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Supprimer</button>
                      </div>
                    </div>
                  ))}
                  {selected.propositions.length === 0 && <p className="text-[12px] text-muted-foreground sm:col-span-2">Aucune proposition construite pour l'instant</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center py-16 text-center med-empty-state animate-fade-slide">
              <div className="med-empty-icon p-3 mb-3">
                <TrendingUp className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Sélectionnez un appel d'offres</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvel appel d'offres</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className={labelCls}>Prospect</div>
                <Combobox
                  options={prospects}
                  value={prospects.find((p) => p.id === createForm.prospectId) ?? null}
                  onChange={(p) => handleSelectProspect(p?.id ?? "")}
                  getLabel={(p) => p.nom} getId={(p) => p.id}
                  placeholder="Rechercher…"
                />
              </label>
              <label className="block md:col-span-2">
                <div className={labelCls}>Cahier des charges (résumé)</div>
                <textarea rows={2} value={createForm.cahierCharges} onChange={(e) => setCreateForm((v) => ({ ...v, cahierCharges: e.target.value }))} className={fieldCls} />
              </label>
              <label className="block md:col-span-2">
                <div className={labelCls}>Garanties demandées</div>
                <textarea rows={2} value={createForm.garantiesDemandees} onChange={(e) => setCreateForm((v) => ({ ...v, garantiesDemandees: e.target.value }))} className={fieldCls} />
              </label>
              <label className="block md:col-span-2">
                <div className={labelCls}>Historique sinistres (optionnel)</div>
                <input value={createForm.historiqueSinistres ?? ""} onChange={(e) => setCreateForm((v) => ({ ...v, historiqueSinistres: e.target.value }))} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Projection S/P (%)</div>
                <input type="number" value={createForm.projectionSP} onChange={(e) => setCreateForm((v) => ({ ...v, projectionSP: Number(e.target.value) }))} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Estimation PEPM (FCFA)</div>
                <input type="number" value={createForm.estimationPepm} onChange={(e) => setCreateForm((v) => ({ ...v, estimationPepm: Number(e.target.value) }))} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Fonds de roulement estimé (FCFA)</div>
                <input type="number" value={createForm.estimationFondsRoulement} onChange={(e) => setCreateForm((v) => ({ ...v, estimationFondsRoulement: Number(e.target.value) }))} className={fieldCls} />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
              <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submittingCreate} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer</button>
            </div>
          </div>
        </div>
      )}

      {showPropositionForm && selected && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">{editingPropositionId ? "Modifier la proposition" : "Nouvelle proposition"}</h3>
              <button type="button" onClick={() => setShowPropositionForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className={labelCls}>Libellé</div>
                  <input value={propNiveau} onChange={(e) => setPropNiveau(e.target.value)} className={fieldCls} placeholder="ex. Essentiel, Confort, Premium, ou libellé libre" />
                </label>
                <label className="block">
                  <div className={labelCls}>Prime proposée (FCFA)</div>
                  <input type="number" value={propPrime} onChange={(e) => setPropPrime(Number(e.target.value))} className={fieldCls} />
                </label>
                <label className="block md:col-span-2">
                  <div className={labelCls}>Description des garanties</div>
                  <textarea rows={2} value={propDescription} onChange={(e) => setPropDescription(e.target.value)} className={fieldCls} />
                </label>
              </div>
              <div>
                <div className={labelCls}>Offres à combiner dans cette proposition</div>
                <p className="text-[11px] text-muted-foreground mb-2">Cocher pré-remplit la prime proposée avec la somme des offres sélectionnées — reste éditable ensuite.</p>
                <div className="rounded-lg border border-border divide-y divide-border/50 max-h-56 overflow-y-auto">
                  {[...cotationsLibres, ...(selected.propositions.find((p) => p.id === editingPropositionId)?.cotations ?? [])].map((c) => (
                    <label key={c.id} className="flex items-center justify-between px-3 py-2 text-[12.5px] cursor-pointer hover:bg-secondary/30">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={propCotationIds.includes(c.id)} onChange={() => toggleCotationSelection(c.id, c.primeTTC)} className="w-3.5 h-3.5 accent-primary" />
                        <span className="text-foreground">{c.compagnie?.nom ?? "—"}</span>
                        <Badge variant="gold">{c.branche}</Badge>
                      </span>
                      <span className="text-muted-foreground med-num">{fmtM(c.primeTTC)} FCFA</span>
                    </label>
                  ))}
                  {cotationsLibres.length === 0 && !editingPropositionId && (
                    <p className="px-3 py-3 text-center text-[12px] text-muted-foreground">Aucune offre libre — lancez d'abord une cotation pour cet AO.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
              <button type="button" onClick={() => setShowPropositionForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={savingProposition} onClick={handleSaveProposition} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"><Send className="w-4 h-4" />{editingPropositionId ? "Mettre à jour" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
