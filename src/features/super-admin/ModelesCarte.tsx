import { useEffect, useState } from "react";
import { IdCard, Plus, Edit, Trash2, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import {
  getModelesCarte, creerModeleCarte, modifierModeleCarte, supprimerModeleCarte,
  uploadImageRectoModeleCarte, uploadImageVersoModeleCarte, supprimerImageRectoModeleCarte, supprimerImageVersoModeleCarte,
  modeleCarteImageUrl,
} from "@/services/modelesCarte.service";
import type { ModeleCarte } from "@/types/modeleCarte";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const ID_CLASSIQUE = "classique";

// Zone d'upload recto/verso — même patron visuel que CompagnieParamsDrawer
// (aperçu carré + "Télécharger"/"Supprimer"), en format carte (rectangle)
// pour rester fidèle au rendu réel (CR80, voir DocumentsService).
function ZoneImage({ titre, url, busy, onUpload, onDelete }: {
  titre: string; url: string | undefined; busy: boolean;
  onUpload: (file: File) => void; onDelete: () => void;
}) {
  return (
    <div>
      <div className={labelCls}>{titre}</div>
      <div className="border border-border rounded-lg p-2.5 space-y-2">
        <div className="w-full aspect-[85.6/53.98] rounded-lg overflow-hidden bg-secondary/40 flex items-center justify-center">
          {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
        </div>
        <label className="block">
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) onUpload(file);
          }} />
          <span className="block text-center h-8 leading-8 rounded-lg bg-emerald-600 text-white text-[11.5px] font-medium cursor-pointer hover:opacity-90">+ Télécharger</span>
        </label>
        {url && (
          <button type="button" onClick={onDelete} disabled={busy} className="w-full h-8 rounded-lg bg-destructive text-destructive-foreground text-[11.5px] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5">
            <Trash2 className="w-3 h-3" />Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

function ModeleModal({ modele, onClose, onSaved }: { modele: ModeleCarte; onClose: () => void; onSaved: () => void }) {
  const [nom, setNom] = useState(modele.nom);
  const [description, setDescription] = useState(modele.description ?? "");
  const [current, setCurrent] = useState(modele);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!nom.trim()) { setError("Le nom du modèle est obligatoire."); return; }
    try {
      setSaving(true);
      setError(null);
      await modifierModeleCarte(current.id, { nom: nom.trim(), description: description.trim() || undefined });
      toast.success("Modèle mis à jour.");
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
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">Modèle — {current.nom}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{error}</p>}
          <label className="block"><div className={labelCls}>Nom *</div><input value={nom} onChange={(e) => setNom(e.target.value)} className={fieldCls} /></label>
          <label className="block"><div className={labelCls}>Description</div><input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldCls} placeholder="Notes internes, facultatif" /></label>
          {current.id === ID_CLASSIQUE ? (
            <p className="text-[12px] text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2">
              Le modèle « Classique » est le dessin généré par l'application — aucune image à importer, toujours disponible par défaut.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <ZoneImage
                titre="Recto" url={modeleCarteImageUrl(current.imageRecto)} busy={busy}
                onUpload={async (file) => { setBusy(true); try { setCurrent(await uploadImageRectoModeleCarte(current.id, file)); toast.success("Recto mis à jour."); } catch (err) { toast.error(err instanceof Error ? err.message : "Envoi impossible."); } finally { setBusy(false); } }}
                onDelete={async () => { setBusy(true); try { setCurrent(await supprimerImageRectoModeleCarte(current.id)); toast.success("Recto supprimé."); } catch (err) { toast.error(err instanceof Error ? err.message : "Suppression impossible."); } finally { setBusy(false); } }}
              />
              <ZoneImage
                titre="Verso" url={modeleCarteImageUrl(current.imageVerso)} busy={busy}
                onUpload={async (file) => { setBusy(true); try { setCurrent(await uploadImageVersoModeleCarte(current.id, file)); toast.success("Verso mis à jour."); } catch (err) { toast.error(err instanceof Error ? err.message : "Envoi impossible."); } finally { setBusy(false); } }}
                onDelete={async () => { setBusy(true); try { setCurrent(await supprimerImageVersoModeleCarte(current.id)); toast.success("Verso supprimé."); } catch (err) { toast.error(err instanceof Error ? err.message : "Suppression impossible."); } finally { setBusy(false); } }}
              />
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>Enregistrer</Btn>
        </div>
      </div>
    </div>
  );
}

// Catalogue des modèles de carte (2026-09) — voir demande utilisateur :
// "on peut importer les modèles et l'application place le modèle comme
// choix pour chaque société. Il reviendra à chaque société à sa création
// de choisir son modèle de carte." Catalogue PARTAGÉ entre toutes les
// sociétés, géré exclusivement ici — voir ParametresEntreprise.
// modeleCarteId côté société, DocumentsService.ajouterCarteRectoVerso
// pour l'utilisation réelle (fond plein cadre + champs dynamiques
// superposés aux mêmes positions qu'aujourd'hui, quel que soit le modèle).
export default function SuperAdminModelesCarteView() {
  const [modeles, setModeles] = useState<ModeleCarte[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<ModeleCarte | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [nomCreation, setNomCreation] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    setLoading(true);
    getModelesCarte().then(setModeles).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement impossible.")).finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const handleCreate = async () => {
    if (!nomCreation.trim()) return;
    try {
      setCreating(true);
      const cree = await creerModeleCarte({ nom: nomCreation.trim() });
      toast.success("Modèle créé — ajoutez ses images recto/verso.");
      setShowCreate(false);
      setNomCreation("");
      refresh();
      setTarget(cree);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActif = async (m: ModeleCarte) => {
    try {
      await modifierModeleCarte(m.id, { actif: !m.actif });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    }
  };

  const handleDelete = async (m: ModeleCarte) => {
    if (!window.confirm(`Supprimer le modèle "${m.nom}" ?`)) return;
    try {
      await supprimerModeleCarte(m.id);
      toast.success("Modèle supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader
        title="Modèles de carte" subtitle="Modèles de carte d'assurance importables — chaque société choisit le sien à sa création"
        icon={IdCard}
        actions={<Btn variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Nouveau modèle</Btn>}
      />
      {loading && <p className="text-center text-muted-foreground text-xs py-6">Chargement…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modeles.map((m) => (
          <div key={m.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="aspect-[85.6/53.98] bg-secondary/40 flex items-center justify-center overflow-hidden">
              {modeleCarteImageUrl(m.imageRecto)
                ? <img src={modeleCarteImageUrl(m.imageRecto)} alt="" className="w-full h-full object-cover" />
                : <IdCard className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground text-sm">{m.nom}</span>
                <Badge variant={m.actif ? "success" : "neutral"}>{m.actif ? "Actif" : "Inactif"}</Badge>
              </div>
              {m.description && <p className="text-[11.5px] text-muted-foreground">{m.description}</p>}
              <div className="flex items-center justify-between pt-1.5">
                <button type="button" onClick={() => handleToggleActif(m)} className="text-[11.5px] text-muted-foreground hover:text-foreground underline">
                  {m.actif ? "Désactiver" : "Activer"}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setTarget(m)} title="Modifier" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                  {m.id !== ID_CLASSIQUE && (
                    <button type="button" onClick={() => handleDelete(m)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouveau modèle de carte</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <label className="block"><div className={labelCls}>Nom *</div><input value={nomCreation} onChange={(e) => setNomCreation(e.target.value)} className={fieldCls} placeholder="ex. Modèle bleu horizontal" /></label>
              <p className="text-[11px] text-muted-foreground mt-2">Vous pourrez ajouter les images recto/verso juste après.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={creating} onClick={handleCreate}>Créer</Btn>
            </div>
          </div>
        </div>
      )}

      {target && <ModeleModal modele={target} onClose={() => setTarget(null)} onSaved={refresh} />}
    </div>
  );
}
