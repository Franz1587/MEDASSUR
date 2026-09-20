import { useEffect, useState } from "react";
import { Plus, Search, Building2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getAgences, createAgence, updateAgence, deleteAgence } from "@/services/agences.service";
import type { Agence, AgenceUpsertInput } from "@/types/agences";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): AgenceUpsertInput {
  return { nom: "", code: "" };
}

// Agences (2026-09) — voir demande utilisateur : "il faut rendre possible
// le fait que l'application permette de lier un agent de saisie à une
// agence du client (compagnie, courtier, mutuelle) afin que ce soit cette
// agence qui remonte sur le décompte." Référentiel léger — l'assignation
// d'un agent à une agence se fait depuis sa fiche (écran Utilisateurs).
export default function AgencesView() {
  const [agences, setAgences] = useState<Agence[]>([]);
  const [recherche, setRecherche] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AgenceUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getAgences().then(setAgences);
  useEffect(() => { refresh(); }, []);

  const agencesFiltrees = agences.filter((a) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return a.nom.toLowerCase().includes(q) || (a.code ?? "").toLowerCase().includes(q);
  });
  const pagination = usePagination(agencesFiltrees);

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (a: Agence) => { setEditId(a.id); setForm({ nom: a.nom, code: a.code ?? "" }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.nom.trim()) { toast.error("Le nom de l'agence est obligatoire."); return; }
    try {
      setSubmitting(true);
      if (editId) await updateAgence(editId, form);
      else await createAgence(form);
      setShowForm(false);
      refresh();
      toast.success(editId ? "Agence modifiée." : "Agence créée avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: Agence) => {
    const ok = window.confirm(`Supprimer l'agence "${a.nom}" ?`);
    if (!ok) return;
    try {
      await deleteAgence(a.id);
      refresh();
      toast.success("Agence supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Agences" subtitle="Succursales de la société — rattachez-y vos agents de saisie pour qu'elle remonte sur le Décompte et le Règlement" icon={Building2}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle agence</Btn>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une agence…" className={`${fieldCls} pl-9`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {pagination.pageItems.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors flex flex-col">
            <p className="text-[14px] font-semibold text-foreground truncate">{a.nom}</p>
            {a.code && <p className="text-[11px] text-muted-foreground med-num">Code {a.code}</p>}
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2">
              <Btn variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" />Modifier</Btn>
              <Btn variant="ghost" onClick={() => handleDelete(a)}><Trash2 className="w-3.5 h-3.5" />Supprimer</Btn>
            </div>
          </div>
        ))}
        {agencesFiltrees.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Aucune agence enregistrée</div>
        )}
      </div>
      <Pagination
        page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
        pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
        onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      />

      {showForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editId ? "Modifier l'agence" : "Nouvelle agence"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3.5">
              <label className="block"><div className={labelCls}>Nom de l'agence</div><input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={fieldCls} placeholder="ex : Agence Libreville" /></label>
              <label className="block"><div className={labelCls}>Code (facultatif)</div><input value={form.code ?? ""} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={fieldCls} placeholder="ex : 212" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submitting} onClick={handleSave} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
