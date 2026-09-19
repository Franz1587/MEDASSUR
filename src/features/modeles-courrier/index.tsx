import { useEffect, useState } from "react";
import { FileText, Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import {
  getCourrierTypes, createCourrierType, updateCourrierType, deleteCourrierType,
  type CourrierType, type CourrierTypeUpsertInput,
} from "@/services/courrier.service";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const MODELE_VIDE = "<p>{{DATE}}</p><p><br></p><p>À l'attention de {{DESTINATAIRE}},</p><p><br></p><p>Objet : {{OBJET}}</p><p><br></p><p>Réf. {{REFERENCE}}</p><p><br></p><p>Madame, Monsieur,</p><p><br></p><p><br></p><p>Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>";

function emptyForm(): CourrierTypeUpsertInput {
  return { libelle: "", corpsModele: MODELE_VIDE, actif: true };
}

// Admin des modèles de courrier (2026-08, voir demande utilisateur :
// "rendre paramétrable les options de courrier") — même structure que
// l'écran Lettres Clés (liste + formulaire d'édition en panneau latéral).
export default function ModelesCourrierView() {
  const [types, setTypes] = useState<CourrierType[]>([]);
  const [form, setForm] = useState<CourrierTypeUpsertInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getCourrierTypes().then(setTypes);
  useEffect(() => { refresh(); }, []);

  const startEdit = (t: CourrierType) => {
    setEditingId(t.id);
    setForm({ libelle: t.libelle, corpsModele: t.corpsModele, actif: t.actif });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); };

  const handleSubmit = async () => {
    if (!form.libelle.trim()) { toast.error("Le libellé est obligatoire."); return; }
    try {
      setSubmitting(true);
      if (editingId) {
        await updateCourrierType(editingId, form);
        toast.success("Modèle de courrier mis à jour.");
      } else {
        await createCourrierType(form);
        toast.success("Modèle de courrier ajouté.");
      }
      cancelEdit();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: CourrierType) => {
    if (!window.confirm(`Supprimer le modèle "${t.libelle}" ?`)) return;
    try {
      await deleteCourrierType(t.id);
      toast.success("Modèle supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Modèles de courrier"
        subtitle="Modèles paramétrables pour l'éditeur Courrier Maladie — jetons disponibles : {{DESTINATAIRE}}, {{DATE}}, {{REFERENCE}}, {{OBJET}}"
        icon={FileText}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          {types.length === 0 && <p className="text-[13px] text-muted-foreground py-6 text-center">Aucun modèle de courrier.</p>}
          {types.map((t) => (
            <div key={t.id} className={`bg-card border border-border rounded-xl p-4 ${!t.actif ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[13.5px] font-semibold text-foreground">{t.libelle}</h3>
                <div className="flex items-center gap-2">
                  {!t.actif && <span className="text-[11px] text-muted-foreground">Inactif</span>}
                  <button type="button" onClick={() => startEdit(t)} className="h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => handleDelete(t)} className="h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-destructive inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="text-[12px] text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: t.corpsModele }} />
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">{editingId ? "Modifier le modèle" : "Nouveau modèle"}</h3>
            {editingId && <button type="button" onClick={cancelEdit} className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <label className="block">
            <div className={labelCls}>Libellé</div>
            <input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className={fieldCls} placeholder="ex : Relance impayé prestataire" />
          </label>
          <label className="block">
            <div className={labelCls}>Corps du modèle</div>
            <RichTextEditor value={form.corpsModele} onChange={(html) => setForm((v) => ({ ...v, corpsModele: html }))} />
          </label>
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={form.actif ?? true} onChange={(e) => setForm((v) => ({ ...v, actif: e.target.checked }))} className="rounded border-border" />
            <span className="text-[12px] text-foreground">Actif</span>
          </label>
          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}>
            <Plus className="w-4 h-4" />{editingId ? "Enregistrer les modifications" : "Ajouter le modèle"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
