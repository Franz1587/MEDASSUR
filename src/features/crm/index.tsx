import { useEffect, useMemo, useState } from "react";
import { Target, Plus, FileDown, FileSpreadsheet, History, TrendingUp, Award, Users2, LayoutGrid, BarChart3, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { DateInput } from "@/components/shared/DateInput";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import {
  getProspects, getProspect, getCrmKanban, createProspect, updateProspect, deleteProspect,
  ajouterNoteProspect, lierClientProspect, getSuggestionsCommission, getStatistiquesProspection,
  type ProspectUpsertInput,
} from "@/services/crm.service";
import { getClients } from "@/services/clients.service";
import { openTableauProspection } from "@/services/documents.service";
import type { Prospect, ProspectDetail, SuggestionsCommissionProspect, StatistiquesProspection } from "@/types/crm";
import type { Client } from "@/types/clients";

const etapeStyle: Record<string, string> = {
  "Nouveau": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Qualifié": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Proposition envoyée": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Négociation": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Gagné": "text-green-400 bg-green-500/10 border-green-500/20",
  "Perdu": "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

const etapes = ["Nouveau", "Qualifié", "Proposition envoyée", "Négociation", "Gagné", "Perdu"] as const;

const OPTIONS_TYPE_CONTRAT: { valeur: "MaladieEtAssistance" | "MaladieSeule"; label: string }[] = [
  { valeur: "MaladieEtAssistance", label: "Maladie et Assistance" },
  { valeur: "MaladieSeule", label: "Maladie seule" },
];

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionHeaderCls = "flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-primary mb-3";

function emptyForm(commercial: string): ProspectUpsertInput {
  return {
    nom: "", type: "Entreprise", source: "", etape: "Nouveau", valeurEstimee: 0,
    commercial, dernierContact: new Date().toLocaleDateString("fr-FR"),
    contactNom: "", contactFonction: "", contactTelephone: "", contactEmail: "",
    typeContrat: "MaladieEtAssistance",
  };
}

export default function CrmView() {
  const { currentUser } = useAuth();
  const [vue, setVue] = useState<"Kanban" | "Statistiques">("Kanban");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [kanban, setKanban] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ProspectUpsertInput>(emptyForm(currentUser?.nom ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Fiche prospect (édition) — analyse commission, historique, conversion client ──
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionsCommissionProspect | null>(null);
  const [noteSaisie, setNoteSaisie] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientChoisi, setClientChoisi] = useState<Client | null>(null);
  const [liaisonSubmitting, setLiaisonSubmitting] = useState(false);

  // ── Statistiques d'évolution ──────────────────────────────────────────
  const [exerciceStats, setExerciceStats] = useState(String(new Date().getFullYear()));
  const [stats, setStats] = useState<StatistiquesProspection | null>(null);

  const refresh = () => {
    getProspects().then(setProspects);
    getCrmKanban().then(setKanban);
  };

  useEffect(() => {
    refresh();
    getClients().then(setClients);
  }, []);

  useEffect(() => {
    if (vue === "Statistiques") getStatistiquesProspection(exerciceStats).then(setStats).catch(() => setStats(null));
  }, [vue, exerciceStats]);

  const pipelineValue = prospects
    .filter((p) => p.etape !== "Gagné" && p.etape !== "Perdu")
    .reduce((a, b) => a + b.valeurEstimee, 0);
  const gagnes = prospects.filter((p) => p.etape === "Gagné").length;
  const tauxTransfo = prospects.length ? Math.round((gagnes / prospects.length) * 100) : 0;

  const openCreate = () => {
    setForm(emptyForm(currentUser?.nom ?? ""));
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (p: Prospect) => {
    setSelected(p);
    setForm({
      nom: p.nom, type: p.type as ProspectUpsertInput["type"], source: p.source,
      etape: p.etape as ProspectUpsertInput["etape"], valeurEstimee: p.valeurEstimee,
      commercial: p.commercial, dernierContact: p.dernierContact,
      contactNom: p.contactNom ?? "", contactFonction: p.contactFonction ?? "",
      contactTelephone: p.contactTelephone ?? "", contactEmail: p.contactEmail ?? "",
      typeContrat: p.typeContrat ?? "MaladieEtAssistance",
    });
    setFormError(null);
    setDetail(null);
    setSuggestion(null);
    setNoteSaisie("");
    setClientChoisi(null);
    setShowEdit(true);
    getProspect(p.id).then(setDetail).catch(() => setDetail(null));
    getSuggestionsCommission(p.id).then(setSuggestion).catch(() => setSuggestion(null));
  };

  const closeModals = () => {
    setShowCreate(false);
    setShowEdit(false);
    setFormError(null);
  };

  const validate = () => {
    if (!form.nom || !form.source || !form.commercial) return "Nom, source et commercial sont obligatoires.";
    return null;
  };

  const handleCreate = async () => {
    const error = validate();
    if (error) { setFormError(error); return; }
    try {
      setSubmitting(true);
      await createProspect(form);
      closeModals();
      refresh();
      toast.success("Prospect créé avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création du prospect.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    const error = validate();
    if (error) { setFormError(error); return; }
    try {
      setSubmitting(true);
      await updateProspect(selected.id, form);
      closeModals();
      refresh();
      toast.success("Prospect mis à jour.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de mise à jour.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = window.confirm(`Supprimer le prospect ${selected.nom} ?`);
    if (!ok) return;
    try {
      await deleteProspect(selected.id);
      closeModals();
      setSelected(null);
      refresh();
      toast.success("Prospect supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleAjouterNote = async () => {
    if (!selected || !noteSaisie.trim()) return;
    try {
      setNoteSubmitting(true);
      const maj = await ajouterNoteProspect(selected.id, noteSaisie.trim());
      setDetail(maj);
      setNoteSaisie("");
      toast.success("Note ajoutée à l'historique.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout de la note impossible.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleLierClient = async () => {
    if (!selected || !clientChoisi) return;
    try {
      setLiaisonSubmitting(true);
      const maj = await lierClientProspect(selected.id, clientChoisi.id);
      setDetail(maj);
      setClientChoisi(null);
      refresh();
      toast.success(`Dossier rattaché au client ${maj.clientNom}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liaison impossible.");
    } finally {
      setLiaisonSubmitting(false);
    }
  };

  const clientsDisponibles = useMemo(() => clients.filter((c) => !prospects.some((p) => p.clientId === c.id && p.id !== selected?.id)), [clients, prospects, selected]);

  return (
    <div className="p-6">
      <ModuleHeader title="CRM & Prospection" subtitle="Pipeline commercial et suivi des opportunités" icon={Target}
        actions={
          <>
            <Btn variant="secondary" onClick={() => openTableauProspection("xlsx").catch(() => toast.error("Export impossible."))}><FileSpreadsheet className="w-4 h-4" />Excel</Btn>
            <Btn variant="secondary" onClick={() => openTableauProspection("pdf").catch(() => toast.error("Export impossible."))}><FileDown className="w-4 h-4" />Tableau de prospection</Btn>
            <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouveau prospect</Btn>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Pipeline actif" value={`${fmtM(pipelineValue)} FCFA`} icon={Target} />
        <StatCard title="Prospects en cours" value={String(prospects.filter((p) => p.etape !== "Gagné" && p.etape !== "Perdu").length)} icon={Target} />
        <StatCard title="Taux de transformation" value={`${tauxTransfo}%`} icon={Target} />
        <StatCard title="Affaires gagnées" value={String(gagnes)} icon={Target} accent="bg-green-500/10" />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 w-fit mb-4">
        <button type="button" onClick={() => setVue("Kanban")} className={`px-3.5 py-1.5 text-[12.5px] rounded-md inline-flex items-center gap-1.5 transition-colors ${vue === "Kanban" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-3.5 h-3.5" />Pipeline</button>
        <button type="button" onClick={() => setVue("Statistiques")} className={`px-3.5 py-1.5 text-[12.5px] rounded-md inline-flex items-center gap-1.5 transition-colors ${vue === "Statistiques" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}><BarChart3 className="w-3.5 h-3.5" />Statistiques</button>
      </div>

      {vue === "Kanban" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {Object.entries(kanban).map(([etape, ids]) => (
              <div key={etape} className="w-60 flex-shrink-0">
                <div className={`px-3 py-2 rounded-lg mb-3 border text-xs font-semibold flex items-center justify-between ${etapeStyle[etape]}`}>
                  <span>{etape}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const p = prospects.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <div
                        key={id}
                        onClick={() => openEdit(p)}
                        className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-primary med-num">{p.id}</span>
                          <Badge variant={p.type === "Entreprise" ? "gold" : "info"}>{p.type}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{p.nom}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.contactNom || p.source}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-foreground med-num">{fmtM(p.valeurEstimee)}</span>
                          <span className="text-xs text-muted-foreground">{p.commercial}</span>
                        </div>
                        {p.etape === "Gagné" && (
                          <div className="mt-1.5">
                            {p.clientId ? <Badge variant="success">Client : {p.clientNom}</Badge> : <Badge variant="warning">À rattacher à un client</Badge>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <label className="text-[12.5px] text-muted-foreground">Exercice</label>
            <input type="number" value={exerciceStats} onChange={(e) => setExerciceStats(e.target.value)} className="w-28 border border-border rounded-lg px-3 py-1.5 bg-background text-[13px] text-foreground" />
          </div>
          {stats && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Dossiers créés" value={String(stats.prospectsCrees)} icon={Users2} />
                <StatCard title="Gagnés" value={String(stats.gagnes.total)} icon={Award} accent="bg-green-500/10" />
                <StatCard title="Valeur gagnée" value={`${fmtM(stats.gagnes.valeurTotale)} FCFA`} icon={TrendingUp} accent="bg-green-500/10" />
                <StatCard title="Perdus" value={String(stats.perdus.total)} icon={Target} accent="bg-slate-500/10" />
                <StatCard title="Convertis en client" value={String(stats.gagnes.convertisEnClient)} icon={Link2} accent="bg-primary/10" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Affaires gagnées — {stats.exercice}</h3></div>
                  <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                    {stats.gagnes.liste.map((l) => (
                      <div key={l.prospectId} className="px-4 py-2.5 flex items-center justify-between text-[12.5px]">
                        <div>
                          <p className="font-medium text-foreground">{l.nom}</p>
                          <p className="text-muted-foreground">{new Date(l.date).toLocaleDateString("fr-FR")}{l.convertiEnClient ? " · Client créé" : " · Client non encore rattaché"}</p>
                        </div>
                        <span className="font-semibold text-foreground med-num">{fmtM(l.valeurEstimee)}</span>
                      </div>
                    ))}
                    {stats.gagnes.liste.length === 0 && <p className="text-xs text-center text-muted-foreground py-6">Aucune affaire gagnée sur cet exercice</p>}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Affaires perdues — {stats.exercice}</h3></div>
                  <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                    {stats.perdus.liste.map((l) => (
                      <div key={l.prospectId} className="px-4 py-2.5 flex items-center justify-between text-[12.5px]">
                        <div>
                          <p className="font-medium text-foreground">{l.nom}</p>
                          <p className="text-muted-foreground">{new Date(l.date).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <span className="font-semibold text-destructive med-num">{fmtM(l.valeurEstimee)}</span>
                      </div>
                    ))}
                    {stats.perdus.liste.length === 0 && <p className="text-xs text-center text-muted-foreground py-6">Aucune affaire perdue sur cet exercice</p>}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Par commercial</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">{["Commercial", "Créés", "Gagnés", "Perdus"].map((h) => <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.parCommercial.map((c) => (
                      <tr key={c.commercial} className="border-b border-border/50">
                        <td className="px-4 py-2.5 font-medium text-foreground">{c.commercial}</td>
                        <td className="px-4 py-2.5">{c.crees}</td>
                        <td className="px-4 py-2.5 text-green-500 font-semibold">{c.gagnes}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.perdus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {(showCreate || showEdit) && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[92vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">{showCreate ? "Créer un prospect" : `${selected?.nom} — ${selected?.id}`}</h3>
              <button type="button" onClick={closeModals} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div>
                <div className={sectionHeaderCls}>Informations générales</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block"><div className={labelCls}>Nom</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Type</div><select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value as ProspectUpsertInput["type"] }))} className={fieldCls}><option>Entreprise</option><option>Particulier</option></select></label>
                  <label className="block"><div className={labelCls}>Source</div><input value={form.source} onChange={(e) => setForm((v) => ({ ...v, source: e.target.value }))} className={fieldCls} placeholder="Site web, recommandation…" /></label>
                  <label className="block"><div className={labelCls}>Étape</div><select value={form.etape} onChange={(e) => setForm((v) => ({ ...v, etape: e.target.value as ProspectUpsertInput["etape"] }))} className={fieldCls}>{etapes.map((e) => <option key={e}>{e}</option>)}</select></label>
                  <label className="block"><div className={labelCls}>Valeur estimée — prime nette (FCFA)</div><input type="number" value={form.valeurEstimee} onChange={(e) => setForm((v) => ({ ...v, valeurEstimee: Number(e.target.value) }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Commercial</div><input value={form.commercial} onChange={(e) => setForm((v) => ({ ...v, commercial: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Dernier contact</div><DateInput value={form.dernierContact} onChange={(v) => setForm((f) => ({ ...f, dernierContact: v }))} className={fieldCls} /></label>
                  <label className="block">
                    <div className={labelCls}>Type de contrat envisagé</div>
                    <div className="flex gap-2">
                      {OPTIONS_TYPE_CONTRAT.map((o) => (
                        <button key={o.valeur} type="button" onClick={() => setForm((v) => ({ ...v, typeContrat: o.valeur }))}
                          className={`h-9 flex-1 px-2 rounded-lg border text-[12px] font-medium ${form.typeContrat === o.valeur ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                        >{o.label}</button>
                      ))}
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <div className={sectionHeaderCls}>Personne ressource</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block"><div className={labelCls}>Nom</div><input value={form.contactNom} onChange={(e) => setForm((v) => ({ ...v, contactNom: e.target.value }))} className={fieldCls} placeholder="Nom de l'interlocuteur" /></label>
                  <label className="block"><div className={labelCls}>Fonction</div><input value={form.contactFonction} onChange={(e) => setForm((v) => ({ ...v, contactFonction: e.target.value }))} className={fieldCls} placeholder="DRH, gérant…" /></label>
                  <label className="block"><div className={labelCls}>Téléphone</div><input value={form.contactTelephone} onChange={(e) => setForm((v) => ({ ...v, contactTelephone: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.contactEmail} onChange={(e) => setForm((v) => ({ ...v, contactEmail: e.target.value }))} className={fieldCls} /></label>
                </div>
              </div>

              {showEdit && suggestion && suggestion.suggestions.length > 0 && (
                <div>
                  <div className={sectionHeaderCls}><TrendingUp className="w-3.5 h-3.5" />Analyse — commission possible par compagnie</div>
                  <div className="space-y-1.5">
                    {suggestion.suggestions.map((s, i) => (
                      <div key={s.compagnieId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"}`}>
                        <div className="flex items-center gap-2">
                          {i === 0 && <Badge variant="success">Suggérée</Badge>}
                          <span className="text-[13px] font-medium text-foreground">{s.compagnieNom}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {s.tauxCommissionMaladie != null && `Maladie ${s.tauxCommissionMaladie}%`}
                            {s.tauxCommissionAssistance != null && ` · Assistance ${s.tauxCommissionAssistance}%`}
                          </span>
                        </div>
                        <span className="text-[13px] font-bold text-foreground med-num">{fmtM(s.montantCommissionEstime)} FCFA</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 mt-2 rounded-lg border border-border bg-secondary/30">
                    <span className="text-[12px] font-semibold text-muted-foreground">Commission moyenne estimée (toutes compagnies)</span>
                    <span className="text-[13px] font-bold text-primary med-num">{fmtM(suggestion.commissionMoyenneEstimee)} FCFA</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Estimation indicative sur la valeur de prime nette renseignée — à confirmer lors de la Cotation réelle.</p>
                </div>
              )}

              {showEdit && selected?.etape === "Gagné" && (
                <div>
                  <div className={sectionHeaderCls}><Link2 className="w-3.5 h-3.5" />Conversion en client</div>
                  {detail?.clientId ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/25 bg-green-500/5">
                      <Badge variant="success">Rattaché</Badge>
                      <span className="text-[13px] text-foreground">{detail.clientNom}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Combobox
                          options={clientsDisponibles} value={clientChoisi} onChange={setClientChoisi}
                          getLabel={(c) => c.nom} getSubLabel={(c) => c.type} getId={(c) => c.id}
                          placeholder="Rechercher le souscripteur créé pour cette affaire…"
                        />
                      </div>
                      <Btn variant="secondary" disabled={!clientChoisi || liaisonSubmitting} onClick={handleLierClient}>Rattacher</Btn>
                    </div>
                  )}
                </div>
              )}

              {showEdit && (
                <div>
                  <div className={sectionHeaderCls}><History className="w-3.5 h-3.5" />Évolution du dossier</div>
                  <div className="flex items-center gap-2 mb-3">
                    <input value={noteSaisie} onChange={(e) => setNoteSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAjouterNote(); }} placeholder="Ajouter une note (appel, relance, réponse du prospect…)" className={fieldCls} />
                    <Btn variant="secondary" disabled={!noteSaisie.trim() || noteSubmitting} onClick={handleAjouterNote}>Ajouter</Btn>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(detail?.historique ?? []).map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-[12px]">
                        <span className="text-muted-foreground whitespace-nowrap mt-0.5">{new Date(h.date).toLocaleDateString("fr-FR")}</span>
                        <div className="flex-1">
                          <span className="text-foreground">{h.description}</span>
                          {h.auteurNom && <span className="text-muted-foreground"> — {h.auteurNom}</span>}
                        </div>
                      </div>
                    ))}
                    {(!detail || detail.historique.length === 0) && <p className="text-xs text-muted-foreground">Aucun événement enregistré.</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="text-[12px] text-destructive">{formError ?? ""}</div>
                {showEdit && <button type="button" onClick={handleDelete} className="h-9 px-4 rounded-lg border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10">Supprimer</button>}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeModals} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={showCreate ? handleCreate : handleEdit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">{showCreate ? "Créer" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
