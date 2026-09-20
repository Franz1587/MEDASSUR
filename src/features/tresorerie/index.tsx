import { useEffect, useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, CheckCircle, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import { getComptesBancaires, getFluxTresorerie, createFlux, rapprocherFlux, type FluxUpsertInput } from "@/services/tresorerie.service";
import type { CompteBancaire, FluxTresorerie } from "@/types/tresorerie";

function emptyForm(): FluxUpsertInput {
  return { date: new Date().toLocaleDateString("fr-FR"), libelle: "", type: "Encaissement", montant: 0, compteId: "" };
}

export default function TresorerieView() {
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [flux, setFlux] = useState<FluxTresorerie[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FluxUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => {
    getComptesBancaires().then(setComptes);
    getFluxTresorerie().then(setFlux);
  };

  useEffect(() => {
    refresh();
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.libelle || !form.compteId || form.montant <= 0) {
      setFormError("Compte, libellé et montant (> 0) sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createFlux(form);
      setShowCreate(false);
      refresh();
      toast.success("Mouvement enregistré.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de saisie.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRapprocher = async (f: FluxTresorerie) => {
    try {
      await rapprocherFlux(f.id);
      refresh();
      toast.success("Mouvement rapproché.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const soldeTotal = comptes.reduce((a, b) => a + b.solde, 0);
  const pagination = usePagination(flux);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Trésorerie" subtitle="Suivi des comptes bancaires, flux et rapprochement" icon={Wallet}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouveau mouvement</Btn>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-primary/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Solde consolidé</p>
          <p className="text-xl font-bold text-primary med-num">{fmtM(soldeTotal)} FCFA</p>
        </div>
        {comptes.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.banque} · {c.pays}</p>
            <p className="text-lg font-bold text-foreground med-num">{fmtM(c.solde)} {c.devise}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Flux récents</h3>
        </div>
        <div className="divide-y divide-border/50">
          {pagination.pageItems.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${f.type === "Encaissement" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  {f.type === "Encaissement" ? <ArrowUpRight className="w-4 h-4 text-green-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.libelle}</p>
                  <p className="text-xs text-muted-foreground">{f.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold med-num ${f.type === "Encaissement" ? "text-green-400" : "text-red-400"}`}>
                  {f.type === "Encaissement" ? "+" : "−"}{fmtM(f.montant)}
                </span>
                {f.rapproche ? (
                  <span title="Rapproché"><CheckCircle className="w-4 h-4 text-green-400" /></span>
                ) : (
                  <button type="button" onClick={() => handleRapprocher(f)} title="Marquer comme rapproché" className="hover:text-foreground">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouveau mouvement</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className="text-[12px] text-muted-foreground mb-1.5">Compte</div>
                <select value={form.compteId} onChange={(e) => setForm((v) => ({ ...v, compteId: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground">
                  <option value="">— Sélectionner —</option>
                  {comptes.map((c) => <option key={c.id} value={c.id}>{c.banque} · {c.pays} ({fmtM(c.solde)} {c.devise})</option>)}
                </select>
              </label>
              <label className="block md:col-span-2"><div className="text-[12px] text-muted-foreground mb-1.5">Libellé</div><input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Type</div><select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value as FluxUpsertInput["type"] }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"><option>Encaissement</option><option>Décaissement</option></select></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Montant (FCFA)</div><input type="number" value={form.montant} onChange={(e) => setForm((v) => ({ ...v, montant: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


