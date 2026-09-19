import { useEffect, useRef, useState } from "react";
import { ScrollText, Plus, Trash2, Pencil, X, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import {
  getReglesConsignes, createRegleConsigne, updateRegleConsigne, deleteRegleConsigne,
  uploadDocumentRegleConsigne, deleteDocumentRegleConsigne, openRegleConsigneDocument,
} from "@/services/reglesConsignes.service";
import type { RegleConsigne, RegleConsigneUpsertInput } from "@/types/reglesConsignes";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): RegleConsigneUpsertInput {
  return { titre: "", contenu: "", ordre: 0, actif: true };
}

// Règles & Consignes (2026-08) — voir demande utilisateur : "on fera
// remonter toutes les règles et consigne pour utiliser l'assurance
// maladie... c'est eux [l'assurance] qui vont mettre en place cela". Liste
// globale (pas de rattachement client/contrat), diffusée en lecture seule
// au portail client (voir src/features/portail-client/ReglesConsignes.tsx).
export default function ReglesConsignesView() {
  const [liste, setListe] = useState<RegleConsigne[]>([]);
  const [form, setForm] = useState<RegleConsigneUpsertInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => getReglesConsignes().then(setListe);
  useEffect(() => { refresh(); }, []);

  const startEdit = (r: RegleConsigne) => {
    setEditingId(r.id);
    setForm({ titre: r.titre, contenu: r.contenu, ordre: r.ordre, actif: r.actif });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); };

  const handleSubmit = async () => {
    if (!form.titre.trim()) { toast.error("Le titre est obligatoire."); return; }
    try {
      setSubmitting(true);
      if (editingId) {
        await updateRegleConsigne(editingId, form);
        toast.success("Règle mise à jour.");
      } else {
        await createRegleConsigne(form);
        toast.success("Règle ajoutée.");
      }
      cancelEdit();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r: RegleConsigne) => {
    if (!window.confirm(`Supprimer "${r.titre}" ?`)) return;
    try {
      await deleteRegleConsigne(r.id);
      toast.success("Règle supprimée.");
      if (editingId === r.id) cancelEdit();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleUpload = async (r: RegleConsigne, file: File) => {
    try {
      setUploadingId(r.id);
      await uploadDocumentRegleConsigne(r.id, file);
      toast.success("Document joint.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi du document impossible.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteDocument = async (r: RegleConsigne) => {
    try {
      await deleteDocumentRegleConsigne(r.id);
      toast.success("Document retiré.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Procédures" subtitle="Règles et consignes d'utilisation de l'assurance maladie, diffusées en lecture seule au portail client" icon={ScrollText} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/60">
            {liste.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13.5px] font-semibold text-foreground">{r.titre}</h3>
                      {!r.actif && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Masquée</span>}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground mt-1.5 line-clamp-3" dangerouslySetInnerHTML={{ __html: r.contenu }} />
                    {r.fichier && (
                      <button type="button" onClick={() => openRegleConsigneDocument(r.fichier!)} className="inline-flex items-center gap-1.5 text-[11.5px] text-primary hover:underline mt-2">
                        <Paperclip className="w-3.5 h-3.5" />Document joint
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            {liste.length === 0 && <p className="p-8 text-center text-muted-foreground text-[13px]">Aucune règle enregistrée.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13.5px] font-semibold text-foreground">{editingId ? "Modifier la règle" : "Nouvelle règle"}</h3>
            {editingId && <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>

          <label className="block mb-3"><div className={labelCls}>Titre</div><input value={form.titre} onChange={(e) => setForm((v) => ({ ...v, titre: e.target.value }))} className={fieldCls} placeholder="ex : Procédure de demande d'entente préalable" /></label>

          <div className="mb-3"><div className={labelCls}>Contenu</div><RichTextEditor value={form.contenu} onChange={(html) => setForm((v) => ({ ...v, contenu: html }))} /></div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block"><div className={labelCls}>Ordre d'affichage</div><input type="number" value={form.ordre ?? 0} onChange={(e) => setForm((v) => ({ ...v, ordre: Number(e.target.value) }))} className={fieldCls} /></label>
            <label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={form.actif ?? true} onChange={(e) => setForm((v) => ({ ...v, actif: e.target.checked }))} className="rounded border-border" /><span className="text-[13px] text-foreground">Visible côté client</span></label>
          </div>

          {editingId && (
            <div className="mb-4 p-3 rounded-lg bg-secondary/25 border border-border">
              <p className={labelCls}>Document joint</p>
              {(() => {
                const courant = liste.find((r) => r.id === editingId);
                return courant?.fichier ? (
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => openRegleConsigneDocument(courant.fichier!)} className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline">
                      <Paperclip className="w-3.5 h-3.5" />{courant.fichier}
                    </button>
                    <button type="button" onClick={() => handleDeleteDocument(courant)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingId === editingId}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />Joindre un document
                  </button>
                );
              })()}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const courant = liste.find((r) => r.id === editingId);
                  if (file && courant) handleUpload(courant, file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Btn variant="primary" disabled={submitting} onClick={handleSubmit}><Plus className="w-4 h-4" />{editingId ? "Enregistrer" : "Ajouter"}</Btn>
            {editingId && <button type="button" onClick={cancelEdit} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
