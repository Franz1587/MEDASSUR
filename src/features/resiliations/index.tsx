import { useEffect, useState } from "react";
import { XCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import {
  getResiliations, createResiliation, validerResiliation, rendreResiliationEffective, deleteResiliation,
  type ResiliationUpsertInput,
} from "@/services/resiliations.service";
import { getContrats } from "@/services/contrats.service";
import type { Resiliation } from "@/types/resiliations";
import type { Contrat } from "@/types/contrats";

const statutVariant: Record<string, "warning" | "info" | "success"> = {
  "Demandée": "warning",
  "Validée": "info",
  "Effective": "success",
};

function emptyForm(initiateur: string): ResiliationUpsertInput {
  return { contratId: "", motif: "Non-paiement", dateEffet: "", ristourne: 0, initiateur, statut: "Demandée" };
}

export default function ResiliationsView() {
  const { currentUser } = useAuth();
  const [resiliations, setResiliations] = useState<Resiliation[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ResiliationUpsertInput>(emptyForm(currentUser?.nom ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const pagination = usePagination(resiliations);

  const refresh = () => getResiliations().then(setResiliations);

  useEffect(() => {
    refresh();
    getContrats().then(setContrats);
  }, []);

  const openCreate = () => {
    setForm(emptyForm(currentUser?.nom ?? ""));
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.contratId || !form.motif || !form.dateEffet) {
      setFormError("Contrat, motif et date d'effet sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createResiliation(form);
      setShowCreate(false);
      refresh();
      toast.success("Demande de résiliation créée.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleValider = async (r: Resiliation) => {
    try {
      await validerResiliation(r.id);
      refresh();
      toast.success("Résiliation validée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation impossible.");
    }
  };

  const handleEffective = async (r: Resiliation) => {
    const ok = window.confirm(`Confirmer la résiliation effective du contrat ${r.contrat} ?`);
    if (!ok) return;
    try {
      await rendreResiliationEffective(r.id);
      refresh();
      toast.success("Résiliation effective — le contrat a été clôturé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const handleDelete = async (r: Resiliation) => {
    const ok = window.confirm(`Supprimer la demande de résiliation ${r.id} ?`);
    if (!ok) return;
    try {
      await deleteResiliation(r.id);
      refresh();
      toast.success("Demande supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Résiliations" subtitle="Traitement des demandes de résiliation et calcul des ristournes" icon={XCircle}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle résiliation</Btn>}
      />
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Contrat", "Client", "Branche", "Motif", "Initiateur", "Date d'effet", "Ristourne", "Statut", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap med-num">{r.id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">{r.contrat}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{r.client}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.branche}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={r.motif === "Fraude" || r.motif === "Non-paiement" ? "danger" : "neutral"}>{r.motif}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.initiateur}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">{r.dateEffet}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap med-num">{r.ristourne > 0 ? fmtM(r.ristourne) : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {r.statut === "Demandée" && <button type="button" onClick={() => handleValider(r)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Valider</button>}
                    {r.statut === "Validée" && <button type="button" onClick={() => handleEffective(r)} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] hover:opacity-90">Rendre effective</button>}
                    {r.statut !== "Effective" && <button type="button" onClick={() => handleDelete(r)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {resiliations.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-muted-foreground text-sm">Aucune résiliation enregistrée</td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Créer une demande de résiliation</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className="text-[12px] text-muted-foreground mb-1.5">Contrat</div>
                <Combobox
                  options={contrats}
                  value={contrats.find((c) => c.id === form.contratId) ?? null}
                  onChange={(c) => setForm((v) => ({ ...v, contratId: c?.id ?? "" }))}
                  getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
                  placeholder="Rechercher…"
                />
              </label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Motif</div><select value={form.motif} onChange={(e) => setForm((v) => ({ ...v, motif: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"><option>Non-paiement</option><option>Demande client</option><option>Non-renouvellement</option><option>Fraude</option><option>Autre</option></select></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date d'effet</div><DateInput value={form.dateEffet} onChange={(v) => setForm((f) => ({ ...f, dateEffet: v }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Ristourne (FCFA)</div><input type="number" value={form.ristourne} onChange={(e) => setForm((v) => ({ ...v, ristourne: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Initiateur</div><input value={form.initiateur} onChange={(e) => setForm((v) => ({ ...v, initiateur: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


