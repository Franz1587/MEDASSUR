import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, X, KeyRound, Lock, ShieldCheck, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { SignatureManager } from "@/components/shared/SignatureManager";
import { viewLabels } from "@/layout/navConfig";
import { GROUPES_MODULES } from "@/auth/moduleGroups";
import { roles, roleList } from "@/auth/roles";
import { getUsers, createUser, updateUser, updateUserModules, deleteUser } from "@/services/admin.service";
import {
  getSocietes, creerSocieteUser, modifierSocieteUser, modifierSocieteUserModules,
  reinitialiserMotDePasseSocieteUser, supprimerSocieteUser,
} from "@/services/societes.service";
import type { UserAccount } from "@/types/admin";
import type { Societe } from "@/types/societes";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Sentinel (2026-09) — un Super Admin n'appartient à AUCUNE société
// (User.societeId reste null, voir schema.prisma) ; ce marqueur distingue
// "aucune société choisie pour l'instant" (formulaire vide) de "créer
// justement un compte Super Admin" dans le select ci-dessous.
const SUPER_ADMIN_SENTINEL = "__super_admin__";

const ROLES_SOCIETE = roleList.filter((r) => r.family === "interne" && r.id !== "super_admin");

function initiales(nom: string): string {
  return nom.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

interface FormState {
  nom: string; email: string; initiales: string; roleId: string;
  telephone?: string; adresse?: string;
}

function emptyForm(): FormState {
  return { nom: "", email: "", initiales: "", roleId: "commercial" };
}

// Gestion des utilisateurs, vue globale Super Admin (2026-09) — voir demande
// utilisateur : "ajouter dans l'écran du superadmin la possibilité de créer
// d'autre superadmin pour l'application ou des utilisateur admin ou simple
// pour le compte des client compagnie, courtier mutuelle... Bref une
// gestion des utilisateur." La création/édition par société existait déjà
// (voir SocieteUsersPanel.tsx, accessible depuis l'écran Sociétés) — cet
// écran l'expose de façon centralisée (tous les comptes, toutes sociétés
// confondues, un seul endroit) et comble la seule vraie lacune : créer un
// AUTRE compte Super Admin (impossible depuis SocieteUsersPanel, qui exclut
// délibérément ce rôle — un Super Admin n'a pas de société à choisir).
export default function SuperAdminUtilisateurs() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreSociete, setFiltreSociete] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState<UserAccount | null>(null);
  const [societeChoisie, setSocieteChoisie] = useState<string>("");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [selection, setSelection] = useState<Set<string>>(new Set(["dashboard"]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([getUsers(), getSocietes()])
      .then(([u, s]) => { setUsers(u); setSocietes(s); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Chargement impossible."))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const societeParId = useMemo(() => new Map(societes.map((s) => [s.id, s])), [societes]);
  const modulesAutorises = societeChoisie && societeChoisie !== SUPER_ADMIN_SENTINEL
    ? societeParId.get(societeChoisie)?.modules ?? []
    : null;

  const usersFiltres = filtreSociete
    ? users.filter((u) => (filtreSociete === SUPER_ADMIN_SENTINEL ? !u.societeId : u.societeId === filtreSociete))
    : users;

  const openCreate = () => {
    setTarget(null);
    setSocieteChoisie("");
    setForm(emptyForm());
    setSelection(new Set(["dashboard"]));
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u: UserAccount) => {
    setTarget(u);
    setSocieteChoisie(u.societeId ?? SUPER_ADMIN_SENTINEL);
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
    if (!societeChoisie) { setError("Choisissez une société, ou \"Super Admin\" pour un compte propriétaire de la plateforme."); return; }
    const estSuperAdmin = societeChoisie === SUPER_ADMIN_SENTINEL;
    try {
      setSaving(true);
      setError(null);
      if (target) {
        if (estSuperAdmin) {
          await updateUser(target.id, { ...form, roleId: "super_admin" as never });
          await updateUserModules(target.id, [...selection]);
        } else {
          await modifierSocieteUser(societeChoisie, target.id, { ...form });
          await modifierSocieteUserModules(societeChoisie, target.id, [...selection]);
        }
        toast.success("Utilisateur mis à jour.");
      } else if (estSuperAdmin) {
        await createUser({
          ...form, roleId: "super_admin" as never,
          initiales: form.initiales.trim() || initiales(form.nom),
          modules: roles.super_admin.allowedModules,
        });
        toast.success("Compte Super Admin créé — mot de passe initial : medassur2024.");
      } else {
        await creerSocieteUser(societeChoisie, { ...form, initiales: form.initiales.trim() || initiales(form.nom), modules: [...selection] });
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

  const handleDelete = async (u: UserAccount) => {
    if (!window.confirm(`Supprimer le compte de ${u.nom} ?`)) return;
    try {
      if (u.societeId) await supprimerSocieteUser(u.societeId, u.id);
      else await deleteUser(u.id);
      toast.success("Utilisateur supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleReset = async (u: UserAccount) => {
    if (!u.societeId) { toast.error("Réinitialisation indisponible pour un compte Super Admin depuis cet écran."); return; }
    if (!window.confirm(`Réinitialiser le mot de passe de ${u.nom} ?`)) return;
    try {
      const { motDePasse } = await reinitialiserMotDePasseSocieteUser(u.societeId, u.id);
      toast.success(`Mot de passe réinitialisé : ${motDePasse}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Réinitialisation impossible.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader
        title="Utilisateurs"
        subtitle="Tous les comptes de la plateforme — Super Admin, administrateurs et collaborateurs de chaque société."
        icon={Users}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvel utilisateur</Btn>}
      />

      <div className="flex items-center gap-2">
        <select value={filtreSociete} onChange={(e) => setFiltreSociete(e.target.value)} className={`${fieldCls} max-w-xs`}>
          <option value="">Toutes les sociétés ({users.length} comptes)</option>
          <option value={SUPER_ADMIN_SENTINEL}>Super Admin uniquement</option>
          {societes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <p className="text-[13px] text-muted-foreground text-center py-10">Chargement…</p>}
        {!loading && usersFiltres.length === 0 && <p className="text-[13px] text-muted-foreground text-center py-10">Aucun compte.</p>}
        {!loading && usersFiltres.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/40 text-[11.5px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Utilisateur</th>
                <th className="text-left px-4 py-2.5 font-semibold">Rôle</th>
                <th className="text-left px-4 py-2.5 font-semibold">Société</th>
                <th className="text-left px-4 py-2.5 font-semibold">Droits</th>
                <th className="text-right px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersFiltres.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-foreground">{u.nom}</p>
                    <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{roles[u.roleId]?.label ?? u.roleId}</td>
                  <td className="px-4 py-2.5">
                    {u.societeId
                      ? <span className="inline-flex items-center gap-1 text-foreground"><Building2 className="w-3.5 h-3.5 text-muted-foreground" />{u.societe?.nom ?? u.societeId}</span>
                      : <Badge variant="info"><ShieldCheck className="w-3 h-3" />Super Admin</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.modules.length} module(s)</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {u.societeId && <button type="button" onClick={() => handleReset(u)} title="Réinitialiser le mot de passe" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><KeyRound className="w-3.5 h-3.5" /></button>}
                      <button type="button" onClick={() => openEdit(u)} title="Modifier" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleDelete(u)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
              <label className="block">
                <div className={labelCls}>Société *</div>
                <select
                  value={societeChoisie} disabled={!!target}
                  onChange={(e) => {
                    setSocieteChoisie(e.target.value);
                    if (e.target.value === SUPER_ADMIN_SENTINEL) setForm((v) => ({ ...v, roleId: "super_admin" }));
                    else if (form.roleId === "super_admin") setForm((v) => ({ ...v, roleId: "commercial" }));
                  }}
                  className={`${fieldCls} disabled:opacity-60`}
                >
                  <option value="" disabled>Choisir…</option>
                  <option value={SUPER_ADMIN_SENTINEL}>— Super Admin (propriétaire de la plateforme, aucune société) —</option>
                  {societes.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.type})</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Nom *</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Email *</div><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Initiales</div><input value={form.initiales} onChange={(e) => setForm((v) => ({ ...v, initiales: e.target.value.toUpperCase() }))} maxLength={3} className={fieldCls} /></label>
                <label className="block">
                  <div className={labelCls}>Rôle</div>
                  {societeChoisie === SUPER_ADMIN_SENTINEL ? (
                    <input value="Super Admin" disabled className={`${fieldCls} opacity-60`} />
                  ) : (
                    <select value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))} className={fieldCls}>
                      {ROLES_SOCIETE.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  )}
                </label>
              </div>
              {target && (
                <div className="border border-border rounded-xl p-4 bg-secondary/20">
                  <SignatureManager userId={target.id} nom={target.nom} />
                </div>
              )}
              {societeChoisie && societeChoisie !== SUPER_ADMIN_SENTINEL && (
                <>
                  <div className={labelCls}>DROITS ({selection.size} module(s), plafonnés à l'abonnement de la société choisie)</div>
                  <div className="space-y-3">
                    {GROUPES_MODULES.map((g) => (
                      <div key={g.label}>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.label}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {g.views.map((v) => {
                            const verrouille = !(modulesAutorises ?? []).includes(v);
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
                </>
              )}
              {societeChoisie === SUPER_ADMIN_SENTINEL && (
                <p className="text-[12.5px] text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                  Un Super Admin a accès à l'intégralité de la console Super Admin — pas de droits à sélectionner individuellement.
                </p>
              )}
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
