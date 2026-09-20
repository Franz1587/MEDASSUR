import { useEffect, useState } from "react";
import { Edit, Plus, ArrowRight, Trash2, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { DateInput } from "@/components/shared/DateInput";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import {
  getAvenants, createAvenant, updateAvenantStatut, appliquerAvenant, deleteAvenant,
  type AvenantUpsertInput,
} from "@/services/avenants.service";
import { getContrats } from "@/services/contrats.service";
import { openQuittanceAvenant, openAvenantDocument, openTableauGaranties } from "@/services/documents.service";
import QuittancesLibresTab from "@/features/avenants/QuittancesLibres";
import type { Avenant } from "@/types/avenants";
import type { Contrat } from "@/types/contrats";

const statutVariant: Record<string, "neutral" | "info" | "success"> = {
  "Brouillon": "neutral",
  "Validé": "info",
  "Appliqué": "success",
};

function emptyForm(): AvenantUpsertInput {
  return { contratId: "", type: "Ajustement de Prime", description: "", primeAvant: 0, primeApres: 0, dateEffet: "", statut: "Brouillon" };
}

export default function AvenantsView() {
  // Onglet Quittances libres (2026-09) — voir demande utilisateur : "j'ai
  // remarqué qu'il y a des fonctionnalité qu'on avait déjà déployé en local
  // qui ont totalement disparu comme la quittance libre par exemple."
  // QuittancesLibresTab existait déjà, complet côté front et back, mais
  // n'était rendu par aucune route — orpheline depuis sa création. Rebranchée
  // ici en second onglet, sous le même libellé de menu "Quittances et
  // Avenants" (voir navConfig.ts).
  const [tab, setTab] = useState<"avenants" | "quittances">("avenants");
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<AvenantUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const toggleExpanded = (id: string) => setExpandedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const pagination = usePagination(avenants);

  const refresh = () => getAvenants().then(setAvenants);

  useEffect(() => {
    refresh();
    getContrats().then(setContrats);
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowCreate(true);
  };

  const handleContratChange = (contratId: string) => {
    const c = contrats.find((x) => x.id === contratId);
    setForm((v) => ({ ...v, contratId, primeAvant: c?.prime ?? 0, primeApres: c?.prime ?? 0 }));
  };

  const handleCreate = async () => {
    if (!form.contratId || !form.description || !form.dateEffet) {
      setFormError("Contrat, description et date d'effet sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createAvenant(form);
      setShowCreate(false);
      refresh();
      toast.success("Avenant créé avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création de l'avenant.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleValider = async (a: Avenant) => {
    try {
      await updateAvenantStatut(a.id, "Validé");
      refresh();
      toast.success("Avenant validé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation impossible.");
    }
  };

  const handleAppliquer = async (a: Avenant) => {
    try {
      await appliquerAvenant(a.id);
      refresh();
      toast.success("Avenant appliqué — la prime du contrat a été mise à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application impossible.");
    }
  };

  const handleDelete = async (a: Avenant) => {
    const ok = window.confirm(`Supprimer l'avenant ${a.id} ?`);
    if (!ok) return;
    try {
      await deleteAvenant(a.id);
      refresh();
      toast.success("Avenant supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Quittances et Avenants" subtitle="Quittancement libre, modifications de contrats en vigueur et traçabilité des changements" icon={Edit}
        actions={tab === "avenants" ? <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvel avenant</Btn> : undefined}
      />

      <div className="flex items-center gap-1 mb-5 bg-secondary/30 rounded-lg p-1 w-fit">
        <button type="button" onClick={() => setTab("avenants")} className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium ${tab === "avenants" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Avenants</button>
        <button type="button" onClick={() => setTab("quittances")} className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium ${tab === "quittances" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Quittances libres</button>
      </div>

      {tab === "quittances" ? (
        <QuittancesLibresTab contrats={contrats} />
      ) : (
      <div className="space-y-3">
        {pagination.pageItems.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-primary med-num">{a.id}</span>
                  <Badge variant="gold">{a.type}</Badge>
                  <Badge variant={statutVariant[a.statut] ?? "neutral"}>{a.statut}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{a.client} · <span className="text-muted-foreground font-normal">{a.contrat}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground med-num">{fmtM(a.primeAvant)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={`font-semibold med-num ${a.primeApres > a.primeAvant ? "text-amber-400" : "text-foreground"}`}>{fmtM(a.primeApres)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Effet: {a.dateEffet}</p>
              </div>
            </div>

            {a.personnes && a.personnes.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => toggleExpanded(a.id)} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                  {expandedIds.includes(a.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {a.personnes.length} personne{a.personnes.length > 1 ? "s" : ""} — voir le détail
                </button>
                {expandedIds.includes(a.id) && (
                  <div className="mt-2 space-y-1">
                    {a.personnes.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary/30 text-[11.5px]">
                        <span className="text-foreground">{p.nom} {p.prenom ?? ""} {p.matricule ? <span className="text-muted-foreground">· {p.matricule}</span> : null}</span>
                        <span className="text-muted-foreground">{p.typeAssure ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60 flex-wrap">
              {a.statut === "Brouillon" && <Btn variant="secondary" onClick={() => handleValider(a)}>Valider</Btn>}
              {a.statut === "Validé" && <Btn variant="primary" onClick={() => handleAppliquer(a)}>Appliquer au contrat</Btn>}
              <Btn variant="ghost" onClick={() => handleDelete(a)}><Trash2 className="w-4 h-4" />Supprimer</Btn>
              <span className="w-px h-5 bg-border mx-1" />
              <Btn variant="ghost" onClick={() => openQuittanceAvenant(a.id).catch((e) => toast.error(e instanceof Error ? e.message : "Erreur de génération."))}><FileDown className="w-4 h-4" />Quittance</Btn>
              <Btn variant="ghost" onClick={() => openAvenantDocument(a.id).catch((e) => toast.error(e instanceof Error ? e.message : "Erreur de génération."))}><FileDown className="w-4 h-4" />Avenant</Btn>
              {a.type === "Renouvellement" && (
                <Btn variant="ghost" onClick={() => openTableauGaranties(a.contrat).catch((e) => toast.error(e instanceof Error ? e.message : "Erreur de génération."))}><FileDown className="w-4 h-4" />Tableau de garanties</Btn>
              )}
            </div>
          </div>
        ))}
        {avenants.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Aucun avenant enregistré</div>
        )}
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Créer un avenant</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className="text-[12px] text-muted-foreground mb-1.5">Contrat</div>
                <select value={form.contratId} onChange={(e) => handleContratChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground">
                  <option value="">— Sélectionner —</option>
                  {contrats.map((c) => <option key={c.id} value={c.id}>{c.numeroPolice ?? c.id} · {c.client}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Type</div>
                <select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground">
                  <option>Ajustement de Prime</option>
                  <option>Régularisation de Prime</option>
                  <option>Renouvellement</option>
                  <option>Incorporation</option>
                  <option>Retrait</option>
                </select>
                <p className="text-[10.5px] text-muted-foreground mt-1">Incorporation/Retrait se créent normalement depuis l'écran "Gérer les assurés" d'un contrat ; Renouvellement depuis le module Renouvellements.</p>
              </label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date d'effet</div><DateInput value={form.dateEffet} onChange={(v) => setForm((f) => ({ ...f, dateEffet: v }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Prime avant (FCFA)</div><input type="number" value={form.primeAvant} onChange={(e) => setForm((v) => ({ ...v, primeAvant: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Prime après (FCFA)</div><input type="number" value={form.primeApres} onChange={(e) => setForm((v) => ({ ...v, primeApres: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block md:col-span-2"><div className="text-[12px] text-muted-foreground mb-1.5">Description</div><textarea value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
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


