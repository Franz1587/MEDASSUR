import { useEffect, useState } from "react";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import {
  getGarantieCatalogue, createGarantieCatalogueItem, deleteGarantieCatalogueItem,
  type GarantieCatalogueUpsertInput,
} from "@/services/garantieCatalogue.service";
import type { GarantieCatalogueItem } from "@/types/garantieCatalogue";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): GarantieCatalogueUpsertInput {
  return { branche: "Maladie", categorie: "", libelle: "", tauxAssureDefaut: undefined, tauxAyantsDroitDefaut: undefined, plafondDefaut: "" };
}

export default function GarantiesCatalogueView() {
  const [items, setItems] = useState<GarantieCatalogueItem[]>([]);
  const [brancheFilter, setBrancheFilter] = useState<"Maladie" | "Assistance">("Maladie");
  const [form, setForm] = useState<GarantieCatalogueUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getGarantieCatalogue().then(setItems);
  useEffect(() => { refresh(); }, []);

  const itemsVisibles = items.filter((i) => i.branche === brancheFilter);
  const familles = [...new Set(itemsVisibles.map((i) => i.categorie))].sort();
  const parCategorie = itemsVisibles.reduce<Record<string, GarantieCatalogueItem[]>>((acc, item) => {
    (acc[item.categorie] ??= []).push(item);
    return acc;
  }, {});

  const handleSubmit = async () => {
    if (!form.categorie.trim() || !form.libelle.trim()) {
      toast.error("Famille (catégorie) et libellé de la rubrique sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createGarantieCatalogueItem(form);
      toast.success("Rubrique ajoutée au catalogue — disponible sur les contrats de cette branche.");
      setForm(emptyForm());
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: GarantieCatalogueItem) => {
    const ok = window.confirm(`Retirer "${item.libelle}" du catalogue ?`);
    if (!ok) return;
    try {
      await deleteGarantieCatalogueItem(item.id);
      toast.success("Rubrique retirée du catalogue.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Catalogue de garanties"
        subtitle="Familles et rubriques de garanties réutilisables — chaque rubrique créée ici peut être rattachée à un contrat de la même branche depuis l'onglet Garanties."
        icon={ShieldCheck}
      />

      <div className="flex border border-border rounded-xl overflow-hidden w-fit">
        {(["Maladie", "Assistance"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrancheFilter(b)}
            className={`px-4 py-2 text-sm transition-colors ${brancheFilter === b ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {familles.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">
              Aucune rubrique {brancheFilter} dans le catalogue — créez-en une avec le formulaire ci-contre.
            </p>
          )}
          {familles.map((famille) => (
            <div key={famille} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-secondary/30 border-b border-border text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">{famille}</div>
              <div className="divide-y divide-border/50">
                {parCategorie[famille].map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[13px] text-foreground font-medium">{item.libelle}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.branche === "Assistance"
                          ? (item.plafondDefaut ?? "—")
                          : <>
                              {item.tauxAssureDefaut !== undefined ? `${item.tauxAssureDefaut}% Structures Privées` : "—"}
                              {" · "}
                              {item.tauxAyantsDroitDefaut !== undefined ? `${item.tauxAyantsDroitDefaut}% Structures Publiques` : "—"}
                              {item.plafondDefaut ? ` · ${item.plafondDefaut}` : ""}
                            </>}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleDelete(item)} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground">Nouvelle famille / rubrique</h3>
          <label className="block">
            <div className={labelCls}>Branche</div>
            <select value={form.branche} onChange={(e) => setForm((v) => ({ ...v, branche: e.target.value as "Maladie" | "Assistance" }))} className={fieldCls}>
              <option value="Maladie">Maladie</option>
              <option value="Assistance">Assistance</option>
            </select>
          </label>
          <label className="block">
            <div className={labelCls}>Famille (catégorie)</div>
            <input list="familles-existantes" value={form.categorie} onChange={(e) => setForm((v) => ({ ...v, categorie: e.target.value }))} className={fieldCls} placeholder="ex: Consultation/Divers, ou une nouvelle famille" />
            <datalist id="familles-existantes">
              {familles.map((f) => <option key={f} value={f} />)}
            </datalist>
          </label>
          <label className="block">
            <div className={labelCls}>Rubrique</div>
            <input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className={fieldCls} placeholder="ex: Consultation Généraliste" />
          </label>
          {form.branche === "Assistance" ? (
            <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2">Le contrat d'Assistance ne nécessite pas de taux de couverture — seuls la rubrique et le plafond sont utiles.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className={labelCls}>% Structures Privées (défaut)</div>
                <input type="number" value={form.tauxAssureDefaut ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAssureDefaut: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>% Structures Publiques (défaut)</div>
                <input type="number" value={form.tauxAyantsDroitDefaut ?? ""} onChange={(e) => setForm((v) => ({ ...v, tauxAyantsDroitDefaut: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} />
              </label>
            </div>
          )}
          <label className="block">
            <div className={labelCls}>Plafond de remboursement</div>
            <input value={form.plafondDefaut ?? ""} onChange={(e) => setForm((v) => ({ ...v, plafondDefaut: e.target.value }))} className={fieldCls} placeholder={form.branche === "Assistance" ? "ex: Prise en charge intégrale" : "ex: 200 000 F CFA / AN"} />
          </label>
          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}><Plus className="w-4 h-4" />Ajouter au catalogue</Btn>
        </div>
      </div>
    </div>
  );
}
