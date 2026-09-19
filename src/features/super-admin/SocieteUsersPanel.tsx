import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { viewLabels } from "@/layout/navConfig";
import { GROUPES_MODULES } from "@/auth/moduleGroups";
import { roleList } from "@/auth/roles";
import {
  getSocieteUsers, creerSocieteUser, modifierSocieteUser, modifierSocieteUserModules,
  reinitialiserMotDePasseSocieteUser, supprimerSocieteUser,
} from "@/services/societes.service";
import type { SocieteUser, CreerSocieteUserInput } from "@/types/societes";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Rôles internes proposables par le Super Admin pour un compte de société
// (jamais super_admin lui-même, ni les rôles "externe" qui dépendent d'un
// rattachement — client/assuré/prestataire/médecin — géré depuis l'écran
// dédié de la société elle-même, pas depuis ce panneau générique).
const ROLES_ASSIGNABLES = roleList.filter((r) => r.family === "interne" && r.id !== "super_admin");

function initiales(nom: string): string {
  return nom.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function emptyForm(): CreerSocieteUserInput {
  return { nom: "", email: "", initiales: "", roleId: "commercial", modules: ["dashboard"] };
}

// Panneau "Utilisateurs" d'une société, pour le Super Admin (2026-09) —
// voir demande utilisateur : "il doit pouvoir créer et gérer des
// utilisateurs pour chaque société et affecter [des droits]." Chaque
// module coché est plafonné côté serveur à l'abonnement de LA société
// choisie (voir SocieteUsersService.plafonner) — les cases hors abonnement
// sont grisées ici pour ne jamais laisser croire qu'elles seront retenues.
export function SocieteUsersPanel({ societeId, modulesAutorises }: { societeId: string; modulesAutorises: string[] }) {
  const [users, setUsers] = useState<SocieteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState<SocieteUser | null>(null);
  const [form, setForm] = useState<CreerSocieteUserInput>(emptyForm());
  const [selection, setSelection] = useState<Set<string>>(new Set(["dashboard"]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    getSocieteUsers(societeId).then(setUsers).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement impossible.")).finally(() => setLoading(false));
  };
  useEffect(refresh, [societeId]);

  const openCreate = () => {
    setTarget(null);
    setForm(emptyForm());
    setSelection(new Set(["dashboard"]));
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u: SocieteUser) => {
    setTarget(u);
    setForm({ nom: u.nom, email: u.email, initiales: u.initiales, roleId: u.roleId, telephone: u.telephone ?? "", adresse: u.adresse ?? "" });
    setSelection(new Set(u.modules));
    setError(null);
    setShowModal(true);
  };

  const toggle = (v: string) => setSelection((s) => {
    const next = new Set(s);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  const handleSave = async () => {
    if (!form.nom.trim() || !form.email.trim()) { setError("Nom et email sont obligatoires."); return; }
    try {
      setSaving(true);
      setError(null);
      if (target) {
        await modifierSocieteUser(societeId, target.id, { ...form });
        await modifierSocieteUserModules(societeId, target.id, [...selection]);
        toast.success("Utilisateur mis à jour.");
      } else {
        await creerSocieteUser(societeId, { ...form, initiales: form.initiales.trim() || initiales(form.nom), modules: [...selection] });
        toast.success("Utilisateur créé — mot de passe initial : medassur2024.");
      }
      setShowModal(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: SocieteUser) => {
    if (!window.confirm(`Supprimer le compte de ${u.nom} ?`)) return;
    try {
      await supprimerSocieteUser(societeId, u.id);
      toast.success("Utilisateur supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleReset = async (u: SocieteUser) => {
    if (!window.confirm(`Réinitialiser le mot de passe de ${u.nom} ?`)) return;
    try {
      const { motDePasse, smsEnvoye } = await reinitialiserMotDePasseSocieteUser(societeId, u.id);
      toast.success(smsEnvoye ? `Mot de passe réinitialisé et envoyé par SMS : ${motDePasse}` : `Mot de passe réinitialisé : ${motDePasse} (numéro absent/invalide — à relayer manuellement)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Réinitialisation impossible.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{users.length} compte(s)</p>
        <Btn variant="secondary" onClick={openCreate}><Plus className="w-3.5 h-3.5" />Nouvel utilisateur</Btn>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {loading && <p className="text-[12px] text-muted-foreground text-center py-6">Chargement…</p>}
        {!loading && users.length === 0 && <p className="text-[12px] text-muted-foreground text-center py-6">Aucun compte.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">{u.nom}</p>
              <p className="text-[11.5px] text-muted-foreground">{u.email} · {roleList.find((r) => r.id === u.roleId)?.label ?? u.roleId} · {u.modules.length} module(s)</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={() => handleReset(u)} title="Réinitialiser le mot de passe" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><KeyRound className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => openEdit(u)} title="Modifier" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => handleDelete(u)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[96] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">{target ? `Utilisateur — ${target.nom}` : "Nouvel utilisateur"}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {error && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Nom *</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Email *</div><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Initiales</div><input value={form.initiales} onChange={(e) => setForm((v) => ({ ...v, initiales: e.target.value.toUpperCase() }))} maxLength={3} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Rôle</div>
                  <select value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))} className={fieldCls}>
                    {ROLES_ASSIGNABLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
              </div>
              <div className={labelCls}>DROITS ({selection.size} module(s), plafonnés à l'abonnement de la société)</div>
              <div className="space-y-3">
                {GROUPES_MODULES.map((g) => (
                  <div key={g.label}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.label}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {g.views.map((v) => {
                        const verrouille = !modulesAutorises.includes(v);
                        return (
                          <label key={v} className={`flex items-center gap-2 py-0.5 ${verrouille ? "opacity-45 cursor-not-allowed" : ""}`} title={verrouille ? "Non inclus dans l'abonnement de cette société" : undefined}>
                            <input type="checkbox" checked={selection.has(v)} disabled={verrouille} onChange={() => toggle(v)} className="rounded border-border" />
                            <span className="text-[12.5px] text-foreground">{viewLabels[v]}</span>
                            {verrouille && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowModal(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={saving} onClick={handleSave}>{target ? "Enregistrer" : "Créer"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
