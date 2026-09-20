import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import { getCompagnies, createCompagnie } from "@/services/compagnies.service";
import { CompagnieLogo, CompagnieParamsDrawer } from "@/features/compagnies/CompagnieParamsDrawer";
import type { Compagnie } from "@/types/compagnies";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function CompagniesView() {
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [selected, setSelected] = useState<Compagnie | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ nom: "", pays: "Gabon", code: "" });
  const [creating, setCreating] = useState(false);
  const pagination = usePagination(compagnies);

  const refresh = () => {
    getCompagnies().then((data) => {
      setCompagnies(data);
      setSelected((s) => (s ? data.find((c) => c.id === s.id) ?? null : null));
    });
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    if (!createForm.nom.trim() || !createForm.pays.trim()) {
      toast.error("Nom et pays sont obligatoires.");
      return;
    }
    setCreating(true);
    try {
      const c = await createCompagnie(createForm);
      toast.success("Compagnie créée.");
      setShowCreate(false);
      setCreateForm({ nom: "", pays: "Gabon", code: "" });
      await refresh();
      setSelected(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Compagnies Partenaires" subtitle="Réseau de compagnies d'assurance santé au Gabon" icon={Building2}
        actions={<Btn variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Ajouter compagnie</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {pagination.pageItems.map((c) => (
          <div key={c.id} onClick={() => setSelected(c)}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <CompagnieLogo logo={c.logo} taille={48} />
            </div>
            <h3 className="font-bold text-foreground mb-0.5">{c.nom}</h3>
            <p className="text-xs text-muted-foreground mb-4">{c.pays}</p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
              <div>
                <p className="text-sm font-bold text-foreground med-num">{c.contrats}</p>
                <p className="text-xs text-muted-foreground">Contrats</p>
              </div>
              <div>
                <p className="text-sm font-bold text-primary med-num">{c.tauxCommissionMaladie ?? "—"}% / {c.tauxCommissionAssistance ?? "—"}%</p>
                <p className="text-xs text-muted-foreground">Mal. / Assist.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground med-num">{fmtM(c.prime)}</p>
                <p className="text-xs text-muted-foreground">Primes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination
        page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
        pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
        onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      />

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Ajouter une compagnie</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block"><div className={labelCls}>Nom</div><input value={createForm.nom} onChange={(e) => setCreateForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Pays</div><input value={createForm.pays} onChange={(e) => setCreateForm((v) => ({ ...v, pays: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Code compagnie</div><input value={createForm.code} onChange={(e) => setCreateForm((v) => ({ ...v, code: e.target.value }))} className={fieldCls} placeholder="ex: 4595" /></label>
              <p className="text-[11px] text-muted-foreground">Le logo et les règles (commission, accessoires, surprimes d'âge…) se paramètrent ensuite dans la fiche de la compagnie.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={creating} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CompagnieParamsDrawer compagnie={selected} onClose={() => setSelected(null)} onSaved={refresh} />
      )}
    </div>
  );
}
