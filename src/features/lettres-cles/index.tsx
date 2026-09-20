import { useEffect, useMemo, useState } from "react";
import { Hash, Plus, Trash2, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import { SPECIALITES_SANTE } from "@/lib/specialitesSante";
import {
  getLettresCles, createLettreCle, updateLettreCle, deleteLettreCle,
  type LettreCleUpsertInput,
} from "@/services/lettresCles.service";
import type { LettreCle } from "@/types/lettresCles";
import { CATEGORIES_GARANTIE_LETTRE_CLE } from "@/types/lettresCles";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): LettreCleUpsertInput {
  return { code: "", libelle: "", valeurUnitaire: 0, categoriesGarantie: [], specialites: [], actif: true };
}

// Sélecteur à choix multiple avec option "Toutes" (2026-08) — tableau vide
// = aucune restriction, s'applique à toutes les valeurs possibles (voir
// demande utilisateur : "lier cela à toutes les garanties"/"toutes les
// spécialités"). Cocher "Toutes" vide la sélection et désactive la liste ;
// décocher une valeur individuelle en repart d'une liste vide la réactive.
function SelecteurMultiple({ label, toutesLabel, options, selected, onChange }: {
  label: string; toutesLabel: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  // "Toutes" est un état dérivé (liste vide), jamais un booléen à part —
  // la cocher force la liste à vide ; cocher un élément individuel en sort
  // naturellement (la liste n'est alors plus vide), pas besoin d'inverse.
  const toutes = selected.length === 0;
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  };
  return (
    <div>
      <div className={labelCls}>{label}</div>
      <label className="flex items-center gap-2 mb-1.5">
        <input type="checkbox" checked={toutes} onChange={() => onChange([])} className="rounded border-border" />
        <span className="text-[12px] text-foreground font-medium">{toutesLabel}</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="rounded border-border" />
            <span className="text-[12px] text-foreground">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function LettresClesView() {
  const [lettres, setLettres] = useState<LettreCle[]>([]);
  const [recherche, setRecherche] = useState("");
  const [form, setForm] = useState<LettreCleUpsertInput>(emptyForm());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getLettresCles().then(setLettres);
  useEffect(() => { refresh(); }, []);

  const rechercheNormalisee = recherche.trim().toLowerCase();
  const lettresFiltrees = useMemo(() => lettres.filter((l) => {
    if (!rechercheNormalisee) return true;
    return l.code.toLowerCase().includes(rechercheNormalisee)
      || l.libelle.toLowerCase().includes(rechercheNormalisee)
      || l.specialites.some((s) => s.toLowerCase().includes(rechercheNormalisee));
  }), [lettres, rechercheNormalisee]);
  const pagination = usePagination(lettresFiltrees);

  const startEdit = (l: LettreCle) => {
    setEditingCode(l.code);
    setForm({ code: l.code, libelle: l.libelle, valeurUnitaire: l.valeurUnitaire, categoriesGarantie: l.categoriesGarantie, specialites: l.specialites, actif: l.actif });
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setForm(emptyForm());
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.libelle.trim()) {
      toast.error("Code et libellé sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      if (editingCode) {
        await updateLettreCle(editingCode, { libelle: form.libelle, valeurUnitaire: form.valeurUnitaire, categoriesGarantie: form.categoriesGarantie, specialites: form.specialites, actif: form.actif });
        toast.success("Lettre clé mise à jour.");
      } else {
        await createLettreCle(form);
        toast.success("Lettre clé ajoutée à la nomenclature.");
      }
      cancelEdit();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (l: LettreCle) => {
    const ok = window.confirm(`Retirer "${l.code} — ${l.libelle}" de la nomenclature ?`);
    if (!ok) return;
    try {
      await deleteLettreCle(l.code);
      toast.success("Lettre clé retirée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Nomenclature des lettres clés"
        subtitle="Codification des actes par lettre clé et coefficient (K, KC, KA, K Loc, AMI, AMY…) — montant = coefficient saisi × valeur unitaire de la lettre. Mode de tarification alternatif au catalogue d'actes forfaitaires, utilisé en saisie de facture et de prise en charge."
        icon={Hash}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une lettre clé…"
              className={`${fieldCls} pl-9`}
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-secondary/30 border-b border-border text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Code</th>
                  <th className="text-left px-4 py-2.5">Libellé</th>
                  <th className="text-left px-4 py-2.5">Catégories</th>
                  <th className="text-left px-4 py-2.5">Spécialités</th>
                  <th className="text-right px-4 py-2.5">Valeur unitaire</th>
                  <th className="text-center px-4 py-2.5">Statut</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {lettresFiltrees.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-[12px] text-muted-foreground">Aucune lettre clé ne correspond à cette recherche.</td></tr>
                )}
                {pagination.pageItems.map((l) => (
                  <tr key={l.code} className={!l.actif ? "opacity-50" : ""}>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{l.code}</td>
                    <td className="px-4 py-2.5 text-foreground">{l.libelle}</td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground max-w-[160px]">
                      {l.categoriesGarantie.length === 0 ? <span className="italic">Toutes</span> : l.categoriesGarantie.join(", ")}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground max-w-[180px]">
                      {l.specialites.length === 0 ? <span className="italic">Toutes</span> : l.specialites.join(", ")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.valeurUnitaire)} FCFA</td>
                    <td className="px-4 py-2.5 text-center text-[11px]">
                      {l.actif ? <span className="text-emerald-600 font-medium">Active</span> : <span className="text-muted-foreground">Inactive</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => startEdit(l)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex items-center justify-center">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(l)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">{editingCode ? `Modifier ${editingCode}` : "Nouvelle lettre clé"}</h3>
            {editingCode && (
              <button type="button" onClick={cancelEdit} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <label className="block">
            <div className={labelCls}>Code</div>
            <input value={form.code} disabled={!!editingCode} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} className={`${fieldCls} ${editingCode ? "opacity-60" : ""}`} placeholder="ex: KC" />
          </label>
          <label className="block">
            <div className={labelCls}>Libellé</div>
            <input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className={fieldCls} placeholder="ex: Acte du chirurgien" />
          </label>
          <label className="block">
            <div className={labelCls}>Valeur unitaire (FCFA)</div>
            <input type="number" value={form.valeurUnitaire || ""} onChange={(e) => setForm((v) => ({ ...v, valeurUnitaire: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} />
          </label>
          <SelecteurMultiple
            label="Catégories de garantie liées" toutesLabel="Toutes les catégories (aucune restriction)"
            options={CATEGORIES_GARANTIE_LETTRE_CLE} selected={form.categoriesGarantie ?? []}
            onChange={(v) => setForm((f) => ({ ...f, categoriesGarantie: v }))}
          />
          <SelecteurMultiple
            label="Spécialités médicales liées" toutesLabel="Toutes les spécialités (aucune restriction)"
            options={SPECIALITES_SANTE} selected={form.specialites ?? []}
            onChange={(v) => setForm((f) => ({ ...f, specialites: v }))}
          />
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={form.actif ?? true} onChange={(e) => setForm((v) => ({ ...v, actif: e.target.checked }))} className="rounded border-border" />
            <span className="text-[12px] text-foreground">Active</span>
          </label>
          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}>
            <Plus className="w-4 h-4" />{editingCode ? "Enregistrer les modifications" : "Ajouter à la nomenclature"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
