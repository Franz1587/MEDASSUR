import { useEffect, useState } from "react";
import { Layers, Plus, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { ModulesPicker } from "./ModulesPicker";
import { TOUS_LES_MODULES } from "@/auth/moduleGroups";
import {
  getPlansAbonnement, creerPlanAbonnement, modifierPlanAbonnement, supprimerPlanAbonnement,
} from "@/services/societes.service";
import type { PlanAbonnement } from "@/types/societes";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function PlanModal({ plan, onClose, onSaved }: { plan: PlanAbonnement | null; onClose: () => void; onSaved: () => void }) {
  const [nom, setNom] = useState(plan?.nom ?? "");
  const [modules, setModules] = useState<Set<string>>(new Set(plan?.modules ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (v: string) => setModules((s) => {
    const next = new Set(s);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  const handleSave = async () => {
    if (!nom.trim()) { setError("Le nom du plan est obligatoire."); return; }
    try {
      setSaving(true);
      setError(null);
      if (plan) await modifierPlanAbonnement(plan.id, { nom: nom.trim(), modules: [...modules] });
      else await creerPlanAbonnement({ nom: nom.trim(), modules: [...modules] });
      toast.success(plan ? "Plan mis à jour." : "Plan créé.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">{plan ? `Plan — ${plan.nom}` : "Nouveau plan d'abonnement"}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{error}</p>}
          <label className="block"><div className={labelCls}>Nom du plan *</div><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Essentiel, Business, Premium…" className={fieldCls} /></label>
          <div className={labelCls}>MODULES INCLUS ({modules.size})</div>
          <ModulesPicker
            selection={modules}
            onToggle={toggle}
            onSelectAll={() => setModules(new Set(TOUS_LES_MODULES))}
            onSelectNone={() => setModules(new Set())}
          />
        </div>
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>{plan ? "Enregistrer" : "Créer"}</Btn>
        </div>
      </div>
    </div>
  );
}

// Catalogue des plans d'abonnement (2026-09) — voir demande utilisateur :
// "il revient au super Admin de donner accès à ces modules là en fonction
// du type d'abonnement souscrit". Un plan n'est qu'un modèle de départ,
// réutilisé pour pré-remplir l'abonnement d'une société (voir
// Societes.tsx) — modifier un plan existant ne change RIEN aux sociétés
// qui l'utilisent déjà (même principe que RoleModuleTemplate).
export default function SuperAdminPlansView() {
  const [plans, setPlans] = useState<PlanAbonnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<PlanAbonnement | null | undefined>(undefined);

  const refresh = () => {
    setLoading(true);
    getPlansAbonnement().then(setPlans).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement impossible.")).finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const handleDelete = async (p: PlanAbonnement) => {
    if (!window.confirm(`Supprimer le plan "${p.nom}" ?`)) return;
    try {
      await supprimerPlanAbonnement(p.id);
      toast.success("Plan supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader
        title="Plans d'abonnement" subtitle="Types d'abonnement proposés aux sociétés — chacun définit les modules accessibles"
        icon={Layers}
        actions={<Btn variant="primary" onClick={() => setTarget(null)}><Plus className="w-4 h-4" />Nouveau plan</Btn>}
      />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Plan", "Modules", "Sociétés", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">Chargement…</td></tr>}
            {!loading && plans.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucun plan — créez-en un pour commencer.</td></tr>}
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-foreground text-sm">{p.nom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.modules.length} fonctionnalité(s)</td>
                <td className="px-4 py-3 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{p._count?.societes ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" onClick={() => setTarget(p)} title="Modifier" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => handleDelete(p)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target !== undefined && <PlanModal plan={target} onClose={() => setTarget(undefined)} onSaved={refresh} />}
    </div>
  );
}
