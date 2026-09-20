import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import {
  getActesMedicaux, createActeMedical, updateActeMedical, deleteActeMedical,
  type ActeMedicalUpsertInput,
} from "@/services/acteMedical.service";
import { getLettresCles } from "@/services/lettresCles.service";
import type { ActeMedical } from "@/types/acteMedical";
import type { LettreCle } from "@/types/lettresCles";

// Taxonomie alignée sur le modèle standard (2026-09, voir
// STANDARD_GARANTIES dans contrats/index.tsx et RUBRIQUES_PLAFONNEES/
// TYPES_PRESTATION côté backend) — 13 rubriques précises au lieu de
// l'ancien "Consultation/Divers" fourre-tout.
const CATEGORIES_GARANTIE = ["Consultations", "Actes de Spécialités", "Pharmacie", "Imagerie", "Analyses Médicale", "Petite Chirurgie/Soins", "Hospitalisation", "Soins & Prothèses dentaires", "Optique", "Kinésithérapie & Cure thermale", "Orthophonie", "Orthoptie", "Maternité", "Transport"];

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(famille?: string): ActeMedicalUpsertInput {
  return { libelle: "", famille: famille ?? "", prixDefaut: 0, categorieGarantie: undefined, lettreCleCode: undefined, coefficient: undefined };
}

export default function ActesMedicauxView() {
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [lettresCles, setLettresCles] = useState<LettreCle[]>([]);
  const [recherche, setRecherche] = useState("");
  const [familleActive, setFamilleActive] = useState<string | null>(null);
  const [form, setForm] = useState<ActeMedicalUpsertInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getActesMedicaux().then(setActes);
  useEffect(() => { refresh(); getLettresCles().then(setLettresCles); }, []);

  const lettresActives = useMemo(() => lettresCles.filter((l) => l.actif), [lettresCles]);
  const lettreCleChoisie = useMemo(() => lettresActives.find((l) => l.code === form.lettreCleCode) ?? null, [lettresActives, form.lettreCleCode]);
  const prixCodifie = lettreCleChoisie ? (form.coefficient ?? 0) * lettreCleChoisie.valeurUnitaire : null;

  const familles = useMemo(() => [...new Set(actes.map((a) => a.famille))].sort(), [actes]);

  const recherecheNormalisee = recherche.trim().toLowerCase();
  const actesFiltres = useMemo(() => actes.filter((a) => {
    if (familleActive && a.famille !== familleActive) return false;
    if (!recherecheNormalisee) return true;
    return a.libelle.toLowerCase().includes(recherecheNormalisee) || a.famille.toLowerCase().includes(recherecheNormalisee);
  }), [actes, familleActive, recherecheNormalisee]);

  const parFamille = useMemo(() => actesFiltres.reduce<Record<string, ActeMedical[]>>((acc, a) => {
    (acc[a.famille] ??= []).push(a);
    return acc;
  }, {}), [actesFiltres]);
  const famillesAffichees = Object.keys(parFamille).sort();
  // Pagination par famille (2026-09) — chaque famille est déjà repliable
  // (<details>), la pagination porte donc sur le nombre de FAMILLES
  // affichées par page, pas sur le nombre brut d'actes (qui restent tous
  // consultables en dépliant une famille).
  const pagination = usePagination(famillesAffichees);

  const startEdit = (acte: ActeMedical) => {
    setEditingId(acte.id);
    setForm({
      libelle: acte.libelle, famille: acte.famille, prixDefaut: acte.prixDefaut,
      categorieGarantie: acte.categorieGarantie, lettreCleCode: acte.lettreCleCode, coefficient: acte.coefficient,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSubmit = async () => {
    if (!form.libelle.trim() || !form.famille.trim()) {
      toast.error("Libellé et famille sont obligatoires.");
      return;
    }
    if (!form.lettreCleCode && !form.prixDefaut) {
      toast.error("Un prix par défaut est obligatoire pour un acte non codifié à une lettre clé.");
      return;
    }
    if (form.lettreCleCode && !form.coefficient) {
      toast.error("Le coefficient est obligatoire pour un acte codifié à une lettre clé.");
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        await updateActeMedical(editingId, form);
        toast.success("Acte médical mis à jour.");
      } else {
        await createActeMedical(form);
        toast.success("Acte médical ajouté au catalogue.");
      }
      const famille = form.famille;
      cancelEdit();
      setForm(emptyForm(famille));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (acte: ActeMedical) => {
    const ok = window.confirm(`Retirer "${acte.libelle}" du catalogue ?`);
    if (!ok) return;
    try {
      await deleteActeMedical(acte.id);
      toast.success("Acte retiré du catalogue.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Catalogue des actes médicaux"
        subtitle="Base des actes médicaux et paramédicaux (TARIF 2), regroupés par famille — sert à la saisie des factures, demandes de prise en charge et remboursements, et au rattachement aux plafonds de garanties."
        icon={ClipboardList}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="bg-card border border-border rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Familles ({familles.length})</h3>
          </div>
          <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
            <div
              onClick={() => setFamilleActive(null)}
              className={`px-4 py-2.5 cursor-pointer text-[13px] transition-colors ${!familleActive ? "bg-primary/8 text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/40"}`}
            >
              Toutes les familles
            </div>
            {familles.map((f) => (
              <div
                key={f}
                onClick={() => setFamilleActive(f)}
                className={`px-4 py-2.5 cursor-pointer text-[13px] transition-colors flex items-center justify-between ${familleActive === f ? "bg-primary/8 text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/40"}`}
              >
                <span>{f}</span>
                <span className="text-[11px] text-muted-foreground">{actes.filter((a) => a.famille === f).length}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un acte…"
              className={`${fieldCls} pl-9`}
            />
          </div>

          {famillesAffichees.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">
              Aucun acte ne correspond à cette recherche.
            </p>
          )}

          {pagination.pageItems.map((famille) => (
            <details key={famille} open={famillesAffichees.length <= 3} className="rounded-xl border border-border overflow-hidden">
              <summary className="px-4 py-2 bg-secondary/30 border-b border-border text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground cursor-pointer select-none">
                {famille} <span className="normal-case font-normal">({parFamille[famille].length})</span>
              </summary>
              <div className="divide-y divide-border/50">
                {parFamille[famille].map((acte) => (
                  <div key={acte.id} className={`flex items-center justify-between px-4 py-2.5 ${editingId === acte.id ? "bg-primary/5" : ""}`}>
                    <div>
                      <p className="text-[13px] text-foreground font-medium">{acte.libelle}</p>
                      <div className="flex items-center gap-2">
                        {acte.categorieGarantie && (
                          <p className="text-[11px] text-muted-foreground">{acte.categorieGarantie}</p>
                        )}
                        {acte.lettreCleCode && (
                          <span className="text-[10.5px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">{acte.lettreCleCode} · coef. {acte.coefficient}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(acte.prixDefaut)} FCFA</span>
                      <button type="button" onClick={() => startEdit(acte)} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 inline-flex items-center justify-center">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(acte)} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">{editingId ? "Modifier l'acte" : "Nouvel acte"}</h3>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <label className="block">
            <div className={labelCls}>Famille</div>
            <input list="familles-actes-existantes" value={form.famille} onChange={(e) => setForm((v) => ({ ...v, famille: e.target.value }))} className={fieldCls} placeholder="ex: CONSULTATIONS, ou une nouvelle famille" />
            <datalist id="familles-actes-existantes">
              {familles.map((f) => <option key={f} value={f} />)}
            </datalist>
          </label>
          <label className="block">
            <div className={labelCls}>Libellé de l'acte</div>
            <input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className={fieldCls} placeholder="ex: Consultation Généraliste" />
          </label>
          <label className="block">
            <div className={labelCls}>Catégorie de garantie liée</div>
            <select value={form.categorieGarantie ?? ""} onChange={(e) => setForm((v) => ({ ...v, categorieGarantie: e.target.value || undefined }))} className={fieldCls}>
              <option value="">— Non rattachée —</option>
              {CATEGORIES_GARANTIE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <div className="border-t border-border pt-3">
            <label className="block">
              <div className={labelCls}>Tarification</div>
              <select
                value={form.lettreCleCode ?? ""}
                onChange={(e) => setForm((v) => ({ ...v, lettreCleCode: e.target.value || undefined, coefficient: e.target.value ? v.coefficient : undefined }))}
                className={fieldCls}
              >
                <option value="">Prix forfaitaire (saisi ci-dessous)</option>
                {lettresActives.map((l) => <option key={l.code} value={l.code}>Codifié — {l.code} ({l.libelle})</option>)}
              </select>
            </label>

            {form.lettreCleCode ? (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <div className={labelCls}>Coefficient de l'acte *</div>
                  <input type="number" min={0} step={0.1} value={form.coefficient ?? ""} onChange={(e) => setForm((v) => ({ ...v, coefficient: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} placeholder="ex: 100" />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Prix calculé automatiquement : {form.coefficient ? `${form.coefficient} × ${fmtM(lettreCleChoisie?.valeurUnitaire ?? 0)}` : "—"} = <span className="font-semibold text-foreground">{prixCodifie != null ? `${fmtM(prixCodifie)} FCFA` : "—"}</span>
                </p>
                {form.lettreCleCode === "KC" && (
                  <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">KC génère automatiquement les lignes KA et K Loc liées à la saisie (coefficients dérivés).</p>
                )}
              </div>
            ) : (
              <label className="block mt-2">
                <div className={labelCls}>Prix par défaut (FCFA) *</div>
                <input type="number" value={form.prixDefaut || ""} onChange={(e) => setForm((v) => ({ ...v, prixDefaut: e.target.value ? Number(e.target.value) : 0 }))} className={fieldCls} />
              </label>
            )}
          </div>

          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}>
            <Plus className="w-4 h-4" />{editingId ? "Enregistrer les modifications" : "Ajouter au catalogue"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
