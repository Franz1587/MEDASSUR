import { useEffect, useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { getHonoraires, createHonoraires, facturerHonoraires, type HonorairesUpsertInput } from "@/services/honoraires.service";
import { getContrats } from "@/services/contrats.service";
import type { HonorairesGestion } from "@/types/honoraires";
import type { Contrat } from "@/types/contrats";

const statutVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Facturé": "success",
  "En attente": "warning",
};

function emptyForm(): HonorairesUpsertInput {
  return { contratId: "", periode: "", montantSinistres: 0, tauxHonoraires: 0, plafond: undefined };
}

export default function HonorairesView() {
  const [honoraires, setHonoraires] = useState<HonorairesGestion[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<HonorairesUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => getHonoraires().then(setHonoraires);

  useEffect(() => {
    refresh();
    getContrats().then(setContrats);
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.contratId || !form.periode || form.tauxHonoraires <= 0) {
      setFormError("Contrat, période et taux (> 0) sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createHonoraires(form);
      setShowCreate(false);
      refresh();
      toast.success("Honoraires calculés et enregistrés.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de saisie.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFacturer = async (h: HonorairesGestion) => {
    try {
      await facturerHonoraires(h.id);
      refresh();
      toast.success("Honoraires marqués comme facturés.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const total = honoraires.reduce((a, b) => a + b.montantHonoraires, 0);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Honoraires de Gestion" subtitle="Honoraires = sinistres × taux — auto-gestion santé" icon={DollarSign}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle facturation</Btn>}
      />
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs text-muted-foreground mb-1">Honoraires cumulés</p>
        <p className="text-2xl font-bold text-foreground med-num">{fmtM(total)} FCFA</p>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Client", "Période", "Sinistres", "Taux", "Honoraires", "Plafond", "Statut", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {honoraires.map((h) => (
              <tr key={h.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{h.clientNom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{h.periode}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap med-num">{fmtM(h.montantSinistres)}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap med-num">{h.tauxHonoraires}%</td>
                <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap med-num">{fmtM(h.montantHonoraires)}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap med-num">{h.plafond ? fmtM(h.plafond) : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[h.statut] ?? "neutral"}>{h.statut}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {h.statut !== "Facturé" && (
                    <button type="button" onClick={() => handleFacturer(h)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Facturer</button>
                  )}
                </td>
              </tr>
            ))}
            {honoraires.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">Aucun honoraire enregistré</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle facturation d'honoraires</h3>
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
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Période</div><input value={form.periode} onChange={(e) => setForm((v) => ({ ...v, periode: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" placeholder="Octobre 2024" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Taux (%)</div><input type="number" value={form.tauxHonoraires} onChange={(e) => setForm((v) => ({ ...v, tauxHonoraires: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Montant sinistres (FCFA)</div><input type="number" value={form.montantSinistres} onChange={(e) => setForm((v) => ({ ...v, montantSinistres: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Plafond (FCFA, optionnel)</div><input type="number" value={form.plafond ?? ""} onChange={(e) => setForm((v) => ({ ...v, plafond: e.target.value ? Number(e.target.value) : undefined }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
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


