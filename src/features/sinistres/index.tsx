import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import {
  getSinistres, getSinistresKanban, createSinistre, updateSinistreStatut, deleteSinistre,
  type SinistreUpsertInput,
} from "@/services/sinistres.service";
import { getClients } from "@/services/clients.service";
import type { Sinistre } from "@/types/sinistres";
import type { Client } from "@/types/clients";

const statusStyle: Record<string, string> = {
  "Déclaré": "text-cyan-700 bg-cyan-500/12 border-cyan-500/25",
  "Expert. en cours": "text-amber-700 bg-amber-500/12 border-amber-500/25",
  "Expertise": "text-orange-700 bg-orange-500/12 border-orange-500/25",
  "Recours": "text-violet-700 bg-violet-500/12 border-violet-500/25",
  "Remboursé": "text-emerald-700 bg-emerald-500/12 border-emerald-500/25",
  "Clôturé": "text-slate-700 bg-slate-500/12 border-slate-500/25",
};

const stages = ["Déclaré", "Expert. en cours", "Expertise", "Recours", "Remboursé", "Clôturé"];

function emptyForm(): SinistreUpsertInput {
  return { clientId: "", branche: "Santé", date: new Date().toLocaleDateString("fr-FR"), description: "", montant: 0, statut: "Déclaré", priorite: "Normal" };
}

export default function SinistresView() {
  const [activeTab, setActiveTab] = useState<"liste" | "kanban">("liste");
  const [sinistres, setSinistres] = useState<Sinistre[]>([]);
  const pagination = usePagination(sinistres);
  const [kanbanColumns, setKanbanColumns] = useState<Record<string, string[]>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<SinistreUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => {
    getSinistres().then(setSinistres);
    getSinistresKanban().then(setKanbanColumns);
  };

  useEffect(() => {
    refresh();
    getClients().then(setClients);
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.clientId || !form.description) {
      setFormError("Client et description sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createSinistre(form);
      setShowCreate(false);
      refresh();
      toast.success("Sinistre déclaré avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de déclaration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvancer = async (s: Sinistre) => {
    const idx = stages.indexOf(s.statut);
    const next = stages[idx + 1];
    if (!next) return;
    try {
      await updateSinistreStatut(s.id, next);
      refresh();
      toast.success(`Sinistre ${s.id} → ${next}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const handleDelete = async (s: Sinistre) => {
    const ok = window.confirm(`Supprimer le sinistre ${s.id} ?`);
    if (!ok) return;
    try {
      await deleteSinistre(s.id);
      refresh();
      toast.success("Sinistre supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Gestion des Sinistres" subtitle="Déclaration, expertise, suivi, indemnisation et clôture" icon={AlertTriangle}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Déclarer un sinistre</Btn>}
      />
      <div className="flex gap-2 mb-5">
        {(["liste", "kanban"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-xl transition-colors font-semibold ${activeTab === t ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(13,115,191,0.22)]" : "bg-card/90 border border-border text-muted-foreground"}`}
          >
            {t === "liste" ? "Liste des sinistres" : "Vue Workflow Kanban"}
          </button>
        ))}
      </div>

      {activeTab === "liste" ? (
        <div className="bg-card/92 border border-border/80 rounded-2xl overflow-x-auto shadow-[0_10px_24px_rgba(17,66,102,0.08)]">
          <table className="w-full text-sm med-data-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap med-sticky-col">Référence</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Client</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Branche</th>
                <th className="hidden md:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Description</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Montant estimé</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Date</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Priorité</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap med-num med-col-ref med-sticky-col">
                    {s.id}
                    <div className="md:hidden mt-1 space-y-0.5 text-[10px] leading-4 text-muted-foreground whitespace-normal">
                      <p className="med-num text-foreground">{fmtM(s.montant)} FCFA</p>
                      <p>{s.statut}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.client}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{s.branche}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap med-num med-col-money">{fmtM(s.montant)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num med-col-date">{s.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={s.priorite === "Urgent" ? "danger" : s.priorite === "Haute" ? "warning" : "neutral"}>{s.priorite}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap med-col-status">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${statusStyle[s.statut] || statusStyle["Clôturé"]}`}>
                      {s.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {stages.indexOf(s.statut) < stages.length - 1 && (
                        <button type="button" onClick={() => handleAvancer(s)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Étape suivante</button>
                      )}
                      <button type="button" onClick={() => handleDelete(s)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {Object.entries(kanbanColumns).map(([status, ids]) => (
              <div key={status} className="w-52 flex-shrink-0">
                <div className={`px-3 py-2 rounded-xl mb-3 border text-xs font-semibold flex items-center justify-between ${statusStyle[status] || statusStyle["Clôturé"]}`}>
                  <span>{status}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const s = sinistres.find((x) => x.id === id);
                    return (
                      <div
                        key={id}
                        onClick={() => s && stages.indexOf(s.statut) < stages.length - 1 && handleAvancer(s)}
                        className="bg-card/92 border border-border rounded-xl p-3 cursor-pointer hover:border-primary/35 transition-colors"
                      >
                        <p className="text-xs font-semibold text-primary mb-1 med-num">{id}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s?.description || "Sinistre en traitement"}</p>
                        {s && (
                          <p className="text-xs font-semibold text-foreground mt-1.5 med-num">
                            {fmtM(s.montant)} FCFA
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Déclarer un sinistre</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className="text-[12px] text-muted-foreground mb-1.5">Client</div>
                <Combobox
                  options={clients}
                  value={clients.find((c) => c.id === form.clientId) ?? null}
                  onChange={(c) => setForm((v) => ({ ...v, clientId: c?.id ?? "" }))}
                  getLabel={(c) => c.nom} getId={(c) => c.id}
                  placeholder="Rechercher…"
                />
              </label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Branche</div><input value={form.branche} onChange={(e) => setForm((v) => ({ ...v, branche: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date</div><DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Montant estimé (FCFA)</div><input type="number" value={form.montant} onChange={(e) => setForm((v) => ({ ...v, montant: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Priorité</div><select value={form.priorite} onChange={(e) => setForm((v) => ({ ...v, priorite: e.target.value as SinistreUpsertInput["priorite"] }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"><option>Normal</option><option>Haute</option><option>Urgent</option></select></label>
              <label className="block md:col-span-2"><div className="text-[12px] text-muted-foreground mb-1.5">Description</div><textarea value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Déclarer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


