import { useEffect, useState } from "react";
import { Settings, Plus, Edit, ShieldCheck, Trash2, X, RotateCcw, User as UserIcon, Camera, Lock } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { viewLabels, type View } from "@/layout/navConfig";
import { GROUPES_MODULES } from "@/auth/moduleGroups";
import { roles, roleList, type RoleId } from "@/auth/roles";
import { useAuth } from "@/auth/AuthContext";
import {
  getUsers, createUser, updateUser, updateUserModules, deleteUser, computeRoleSummaries,
  uploadUserPhoto, deleteUserPhoto, userPhotoUrl,
  type CreateUserInput,
} from "@/services/admin.service";
import { getRoleTemplates, updateRoleTemplate, type RoleTemplate } from "@/services/role-templates.service";
import { getMonAbonnement } from "@/services/societes.service";
import { getAgences } from "@/services/agences.service";
import type { UserAccount } from "@/types/admin";
import type { Agence } from "@/types/agences";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function initiales(nom: string): string {
  return nom.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// Écran unifié détail utilisateur — voir demande utilisateur : "il faut
// améliorer cet écran, il faut qu'on puisse voir plus de détails d'un
// utilisateur, ajouter les coordonnées personnels, y compris la photo de
// profil, un écran d'accès à ses droits, qu'on puisse ajouter ou retirer
// des droits à un utilisateur depuis cet écran." Fusionne l'ancien
// UserFormModal (identité) + ModulesModal (droits) en un seul modal à
// onglets ; le bouton "Enregistrer" sauvegarde toujours identité ET droits
// ensemble, quel que soit l'onglet actif.
function UserDetailModal({ user, initialTab = "infos", modulesAutorises, onClose, onSaved }: { user: UserAccount | null; initialTab?: "infos" | "droits"; modulesAutorises: string[] | null; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<"infos" | "droits">(initialTab);
  const [form, setForm] = useState<CreateUserInput>(user
    ? { nom: user.nom, email: user.email, initiales: user.initiales, roleId: user.roleId, telephone: user.telephone ?? "", adresse: user.adresse ?? "", agenceId: user.agenceId ?? "" }
    : { nom: "", email: "", initiales: "", roleId: "commercial", telephone: "", adresse: "", agenceId: "" });
  const [selection, setSelection] = useState<Set<string>>(new Set(user?.modules ?? []));
  const [photo, setPhoto] = useState<string | null | undefined>(user?.photo);
  const [saving, setSaving] = useState(false);
  const [reinitialisant, setReinitialisant] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Agence de rattachement (2026-09) — voir demande utilisateur : "lier un
  // agent de saisie à une agence... afin que ce soit cette agence qui
  // remonte sur le décompte".
  const [agences, setAgences] = useState<Agence[]>([]);
  useEffect(() => { getAgences().then(setAgences); }, []);

  // Nouvel utilisateur : la sélection de droits suit le modèle générique du
  // rôle choisi tant que l'admin ne l'a pas ajustée à la main (voir
  // handleReinitialiser pour le cas "utilisateur existant").
  useEffect(() => {
    if (user) return;
    getRoleTemplates().then((modeles) => {
      const m = modeles.find((t) => t.roleId === form.roleId);
      if (m) setSelection(new Set(modulesAutorises ? m.modules.filter((v) => modulesAutorises.includes(v)) : m.modules));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, form.roleId]);

  const toggle = (v: View) => {
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  // Voir demande utilisateur : "on peut créer des champs génériques à
  // attribuer aux types d'utilisateur, mais on peut aussi de façon
  // spécifique donner des droits supplémentaires à un utilisateur bien
  // spécifique" — ce bouton ramène la sélection au modèle GÉNÉRIQUE du
  // rôle (RoleModuleTemplate), sans enregistrer : l'admin garde la main
  // pour ajuster/ajouter des droits spécifiques avant de cliquer
  // "Enregistrer".
  const handleReinitialiser = async () => {
    setReinitialisant(true);
    try {
      const modeles = await getRoleTemplates();
      const modele = modeles.find((m) => m.roleId === form.roleId);
      if (!modele) { toast.error("Aucun modèle trouvé pour ce rôle."); return; }
      setSelection(new Set(modulesAutorises ? modele.modules.filter((v) => modulesAutorises.includes(v)) : modele.modules));
      toast.success(`Sélection réinitialisée au modèle "${roles[form.roleId]?.label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modèle introuvable.");
    } finally {
      setReinitialisant(false);
    }
  };

  const handlePhoto = async (file: File) => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const updated = await uploadUserPhoto(user.id, file);
      setPhoto(updated.photo);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi de la photo impossible.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    try {
      const updated = await deleteUserPhoto(user.id);
      setPhoto(updated.photo);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleSave = async () => {
    if (!form.nom.trim() || !form.email.trim()) { toast.error("Nom et email sont obligatoires."); return; }
    setSaving(true);
    try {
      if (user) {
        await updateUser(user.id, form);
        await updateUserModules(user.id, [...selection]);
        toast.success("Utilisateur mis à jour.");
      } else {
        await createUser({ ...form, initiales: form.initiales.trim() || initiales(form.nom), modules: [...selection] });
        toast.success(`Utilisateur créé — mot de passe initial : medassur2024.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const photoSrc = userPhotoUrl(photo);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">{user ? `Utilisateur — ${user.nom}` : "Nouvel utilisateur"}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-3 flex-shrink-0 flex items-center gap-2 border-b border-border/70">
          {(["infos", "droits"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "infos" ? "Informations" : "Droits"}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === "infos" && (
            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5">
              <div>
                <div className={labelCls}>Photo de profil</div>
                <div className="w-28 h-28 rounded-full overflow-hidden bg-secondary/40 border border-border flex items-center justify-center">
                  {photoSrc ? <img src={photoSrc} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-muted-foreground" />}
                </div>
                {user ? (
                  <div className="mt-2 space-y-1.5">
                    <label className="block">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
                      <span className="block text-center h-8 leading-8 rounded-lg border border-border text-[12px] font-medium cursor-pointer hover:bg-secondary/50 text-foreground inline-flex items-center justify-center gap-1.5 w-full">
                        <Camera className="w-3.5 h-3.5" />{uploadingPhoto ? "Envoi…" : "Changer"}
                      </span>
                    </label>
                    {photo && (
                      <button type="button" onClick={handleDeletePhoto} className="w-full h-8 rounded-lg text-destructive text-[12px] font-medium hover:bg-destructive/10 inline-flex items-center justify-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" />Supprimer
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-2">Disponible après création du compte.</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block"><div className={labelCls}>Nom complet</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Initiales</div><input value={form.initiales} onChange={(e) => setForm((v) => ({ ...v, initiales: e.target.value.toUpperCase() }))} placeholder="ex. AB" maxLength={3} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone ?? ""} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} placeholder="ex. +241 00 00 00 00" className={fieldCls} /></label>
                </div>
                <label className="block"><div className={labelCls}>Adresse</div><input value={form.adresse ?? ""} onChange={(e) => setForm((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Agence de rattachement</div>
                  <Combobox
                    options={agences}
                    value={agences.find((a) => a.id === form.agenceId) ?? null}
                    onChange={(a) => setForm((v) => ({ ...v, agenceId: a?.id ?? "" }))}
                    getLabel={(a) => a.nom} getSubLabel={(a) => a.code ?? ""} getId={(a) => a.id}
                    placeholder="Rechercher une agence…" allowClear clearLabel="Aucune agence"
                  />
                  <p className="text-[10.5px] text-muted-foreground mt-1">Remonte sur le Décompte et le Règlement établis par cet agent.</p>
                </label>
                <label className="block"><div className={labelCls}>Rôle (modèle de droits par défaut)</div>
                  <select value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value as RoleId }))} className={fieldCls}>
                    {roleList.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">Pré-remplit l'onglet "Droits" depuis ce rôle — ajustable ensuite librement dans cet écran.</p>
                </label>
              </div>
            </div>
          )}

          {tab === "droits" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[11px] text-muted-foreground">Fonctionnalités accessibles à cet utilisateur, indépendamment de son rôle ({roles[form.roleId]?.label}).</p>
                <button type="button" onClick={handleReinitialiser} disabled={reinitialisant} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0">
                  <RotateCcw className="w-3.5 h-3.5" />Réinitialiser au modèle du rôle
                </button>
              </div>
              {modulesAutorises && (
                <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2">
                  Votre abonnement inclut {modulesAutorises.length} fonctionnalité(s) — les autres, grisées ci-dessous 🔒, ne sont pas accessibles à vos utilisateurs. Contactez l'éditeur pour les débloquer.
                </p>
              )}
              {GROUPES_MODULES.map((g) => (
                <div key={g.label}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.label}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {g.views.map((v) => {
                      const verrouille = !!modulesAutorises && !modulesAutorises.includes(v);
                      return (
                        <label key={v} className={`flex items-center gap-2 py-0.5 ${verrouille ? "opacity-45 cursor-not-allowed" : ""}`} title={verrouille ? "Non inclus dans votre abonnement" : undefined}>
                          <input type="checkbox" checked={selection.has(v)} disabled={verrouille} onChange={() => toggle(v)} className="rounded border-border" />
                          <span className="text-[12.5px] text-foreground">{viewLabels[v]}</span>
                          {verrouille && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setSelection(new Set(GROUPES_MODULES.flatMap((g) => g.views).filter((v) => !modulesAutorises || modulesAutorises.includes(v))))} className="text-[12px] text-muted-foreground hover:text-foreground">Tout cocher</button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>{user ? "Enregistrer" : "Créer"}</Btn>
        </div>
      </div>
    </div>
  );
}

// Modèle GÉNÉRIQUE par type d'utilisateur (rôle) — voir demande utilisateur :
// "on peut créer des champs génériques à attribuer aux types d'utilisateur".
// Ne touche à AUCUN utilisateur déjà créé : sert uniquement de pré-remplissage
// à la création d'un nouveau compte de ce rôle, et de point de départ pour le
// bouton "Réinitialiser au modèle du rôle" de UserDetailModal.
function RoleTemplateModal({ template, modulesAutorises, onClose, onSaved }: { template: RoleTemplate; modulesAutorises: string[] | null; onClose: () => void; onSaved: () => void }) {
  const [selection, setSelection] = useState<Set<string>>(new Set(template.modules));
  const [saving, setSaving] = useState(false);

  const toggle = (v: View) => {
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRoleTemplate(template.roleId, [...selection]);
      toast.success(`Modèle mis à jour pour "${roles[template.roleId]?.label}".`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[88vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Modèle de droits — {roles[template.roleId]?.label}</h3>
            <p className="text-[11px] text-muted-foreground">Droits par défaut proposés à la création d'un nouvel utilisateur de ce rôle. Ne change rien pour les utilisateurs déjà créés (voir "Réinitialiser au modèle du rôle" dans l'écran "Droits" de chacun).</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {modulesAutorises && (
            <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2">
              Votre abonnement inclut {modulesAutorises.length} fonctionnalité(s) — les autres, grisées ci-dessous 🔒, ne sont pas accessibles.
            </p>
          )}
          {GROUPES_MODULES.map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.label}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {g.views.map((v) => {
                  const verrouille = !!modulesAutorises && !modulesAutorises.includes(v);
                  return (
                    <label key={v} className={`flex items-center gap-2 py-0.5 ${verrouille ? "opacity-45 cursor-not-allowed" : ""}`} title={verrouille ? "Non inclus dans votre abonnement" : undefined}>
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
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-between items-center">
          <button type="button" onClick={() => setSelection(new Set(GROUPES_MODULES.flatMap((g) => g.views).filter((v) => !modulesAutorises || modulesAutorises.includes(v))))} className="text-[12px] text-muted-foreground hover:text-foreground">Tout cocher</button>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn variant="primary" disabled={saving} onClick={handleSave}>Enregistrer</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminView() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [chargement, setChargement] = useState(true);
  // Un seul modal pour identité + coordonnées + droits (voir
  // UserDetailModal) — detailTarget.user === null signifie "nouvel
  // utilisateur" (le modal reste monté, showDetail contrôle sa visibilité).
  const [showDetail, setShowDetail] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ user: UserAccount | null; tab: "infos" | "droits" }>({ user: null, tab: "infos" });
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [templateTarget, setTemplateTarget] = useState<RoleTemplate | null>(null);
  // Abonnement de la société (2026-09) — voir demande utilisateur : "il
  // revient au super Admin de donner accès à ces modules là en fonction du
  // type d'abonnement souscrit". null tant que non chargé (aucun message
  // affiché, pour ne pas suggérer une limite avant de savoir laquelle).
  const [modulesAutorises, setModulesAutorises] = useState<string[] | null>(null);

  const refresh = () => {
    setChargement(true);
    getUsers().then(setUsers).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement des utilisateurs impossible.")).finally(() => setChargement(false));
  };
  const refreshTemplates = () => {
    getRoleTemplates().then(setTemplates).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement des modèles impossible."));
  };
  useEffect(() => {
    refresh(); refreshTemplates();
    getMonAbonnement().then((a) => setModulesAutorises(a.modules)).catch(() => undefined);
  }, []);

  const roleSummaries = computeRoleSummaries(users);

  const handleDelete = async (u: UserAccount) => {
    if (u.id === currentUser?.id) { toast.error("Impossible de supprimer votre propre compte."); return; }
    if (!window.confirm(`Supprimer le compte de ${u.nom} ?`)) return;
    try {
      await deleteUser(u.id);
      toast.success("Utilisateur supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Administration Système" subtitle="Utilisateurs, rôles et droits par fonctionnalité" icon={Settings}
        actions={<Btn variant="primary" onClick={() => { setDetailTarget({ user: null, tab: "infos" }); setShowDetail(true); }}><Plus className="w-4 h-4" />Nouvel utilisateur</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Utilisateurs ({users.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Utilisateur", "Rôle", "Droits", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chargement && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">Chargement…</td></tr>}
              {!chargement && users.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">Aucun utilisateur.</td></tr>}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setDetailTarget({ user: u, tab: "infos" }); setShowDetail(true); }}
                        className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 overflow-hidden"
                      >
                        {userPhotoUrl(u.photo) ? <img src={userPhotoUrl(u.photo)} alt="" className="w-full h-full object-cover" /> : u.initiales}
                      </button>
                      <button type="button" onClick={() => { setDetailTarget({ user: u, tab: "infos" }); setShowDetail(true); }} className="text-left">
                        <p className="font-semibold text-foreground text-sm hover:underline">{u.nom}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{roles[u.roleId]?.label ?? u.roleId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.modules.length} fonctionnalité(s)</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => { setDetailTarget({ user: u, tab: "droits" }); setShowDetail(true); }} title="Droits" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><ShieldCheck className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => { setDetailTarget({ user: u, tab: "infos" }); setShowDetail(true); }} title="Modifier" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleDelete(u)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Rôles (modèle par défaut)</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Champ générique par type d'utilisateur — pré-remplit les droits à la création, modifiable ici. Chaque utilisateur reste ensuite ajustable individuellement via "Droits".</p>
          </div>
          <div className="divide-y divide-border/50">
            {roleSummaries.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{r.label}</p>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary med-num">{r.nombreUtilisateurs}</p>
                    <p className="text-xs text-muted-foreground">utilisateur(s)</p>
                  </div>
                  <button
                    type="button"
                    title="Modifier le modèle de droits"
                    onClick={() => {
                      const t = templates.find((m) => m.roleId === r.id);
                      if (t) setTemplateTarget(t);
                    }}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDetail && (
        <UserDetailModal
          user={detailTarget.user}
          initialTab={detailTarget.tab}
          modulesAutorises={modulesAutorises}
          onClose={() => setShowDetail(false)}
          onSaved={refresh}
        />
      )}
      {templateTarget && <RoleTemplateModal template={templateTarget} modulesAutorises={modulesAutorises} onClose={() => setTemplateTarget(null)} onSaved={refreshTemplates} />}
    </div>
  );
}
