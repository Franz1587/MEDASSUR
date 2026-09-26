import { useEffect, useState } from "react";
import { Wallet, AlertTriangle, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { getFondsDeRoulement, createFonds, consommerFonds, type FondsUpsertInput } from "@/services/fondsDeRoulement.service";
import { getContrats } from "@/services/contrats.service";
import type { FondsDeRoulement } from "@/types/fondsDeRoulement";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

const statutVariant: Record<string, "success" | "warning" | "danger"> = {
  Normal: "success",
  Alerte: "warning",
  Épuisé: "danger",
};

function emptyForm(): FondsUpsertInput {
  return { contratId: "", montantInitial: 0, seuilAlerte: 0, dateAlimentation: new Date().toLocaleDateString("fr-FR") };
}

export default function FondsDeRoulementView() {
  const [fonds, setFonds] = useState<FondsDeRoulement[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FondsUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => getFondsDeRoulement().then(setFonds);

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
    if (!form.contratId || form.montantInitial <= 0) {
      setFormError("Contrat et montant initial (> 0) sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createFonds(form);
      setShowCreate(false);
      refresh();
      toast.success("Fonds de roulement alimenté.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de saisie.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsommer = async (f: FondsDeRoulement) => {
    const input = window.prompt(`Montant consommé sur le fonds de ${f.clientNom} (FCFA) :`);
    if (!input) return;
    const montant = Number(input);
    if (!montant || montant <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    try {
      await consommerFonds(f.id, montant);
      refresh();
      toast.success("Consommation enregistrée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const enAlerte = fonds.filter((f) => f.statut !== "Normal").length;
  const totalRestant = fonds.reduce((a, b) => a + (b.montantInitial - b.montantConsomme), 0);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Fonds de Roulement" subtitle="Auto-gestion santé — alimentation et consommation par contrat" icon={Wallet}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Alimenter un fonds</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Contrats en auto-gestion" value={String(fonds.length)} icon={Wallet} />
        <StatCard title="Solde restant cumulé" value={`${fmtM(totalRestant)} FCFA`} icon={Wallet} />
        <StatCard title="Sous seuil d'alerte" value={String(enAlerte)} icon={AlertTriangle} accent={enAlerte > 0 ? "bg-red-500/10" : undefined} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fonds.map((f) => {
          const restant = f.montantInitial - f.montantConsomme;
          const pctConsomme = f.montantInitial > 0 ? Math.round((f.montantConsomme / f.montantInitial) * 100) : 0;
          return (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">{f.clientNom}</p>
                <Badge variant={statutVariant[f.statut] ?? "neutral"}>{f.statut}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Police {numeroPolice(contrats.find((c) => c.id === f.contratId))} · Alimenté le {f.dateAlimentation}</p>
              <div className="w-full bg-secondary rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full ${f.statut === "Normal" ? "bg-primary" : "bg-red-500"}`} style={{ width: `${Math.min(pctConsomme, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Consommé {fmtM(f.montantConsomme)} / {fmtM(f.montantInitial)} FCFA ({pctConsomme}%)</span>
                <span className="font-semibold text-foreground med-num">{fmtM(restant)} restants</span>
              </div>
              <button type="button" onClick={() => handleConsommer(f)} className="mt-3 w-full h-8 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/45 inline-flex items-center justify-center gap-1.5"><Minus className="w-3.5 h-3.5" />Enregistrer une consommation</button>
            </div>
          );
        })}
        {fonds.length === 0 && (
          <div className="lg:col-span-2 py-12 text-center text-muted-foreground text-sm">Aucun fonds de roulement enregistré</div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Alimenter un fonds de roulement</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className="text-[12px] text-muted-foreground mb-1.5">Contrat</div>
                <Combobox
                  options={contrats}
                  value={contrats.find((c) => c.id === form.contratId) ?? null}
                  onChange={(c) => setForm((v) => ({ ...v, contratId: c?.id ?? "" }))}
                  getLabel={(c) => numeroPolice(c)} getSubLabel={(c) => c.client} getId={(c) => c.id}
                  placeholder="Rechercher…"
                />
              </label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Montant initial (FCFA)</div><input type="number" value={form.montantInitial} onChange={(e) => setForm((v) => ({ ...v, montantInitial: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Seuil d'alerte (FCFA)</div><input type="number" value={form.seuilAlerte} onChange={(e) => setForm((v) => ({ ...v, seuilAlerte: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
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


