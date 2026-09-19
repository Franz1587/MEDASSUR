import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, X } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { useAuth } from "@/auth/AuthContext";
import { roles } from "@/auth/roles";
import { viewLabels, viewIcons, type View } from "@/layout/navConfig";
import {
  getPortailUtilisateurs, createPortailUtilisateur, updateModulesPortailUtilisateur, deletePortailUtilisateur,
  type PortailUtilisateur, type CreatePortailUtilisateurInput,
} from "@/services/portailClientUtilisateurs.service";

const fieldCls = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground";
const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";

// Ensemble complet des rubriques du portail, dans un ordre stable (voir
// roles.ts client_entreprise.allowedModules) — sert à la fois de liste de
// cases à cocher et à préserver un ordre cohérent dans la sidebar,
// indépendamment de l'ordre dans lequel l'admin les a cochées.
const RUBRIQUES_PORTAIL = roles.client_entreprise.allowedModules;

function emptyForm(): CreatePortailUtilisateurInput {
  return { nom: "", email: "", initiales: "", motDePasse: "", modules: ["portailDashboard"] };
}

// Gestion des utilisateurs & droits du portail client (2026-08) — voir
// demande utilisateur : "une fonctionnalité permettant de créer d'autres
// utilisateurs et de leur donner des droits sur les rubriques du menu...
// elle servira surtout à l'admin côté client". Un utilisateur ne peut
// jamais accorder une rubrique qu'il ne détient pas lui-même (vérifié
// aussi côté serveur, voir PortailClientUtilisateursService).
export default function PortailUtilisateursView() {
  const { currentUser } = useAuth();
  const [liste, setListe] = useState<PortailUtilisateur[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreatePortailUtilisateurInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [droitsOuvert, setDroitsOuvert] = useState<PortailUtilisateur | null>(null);
  const [droitsSelection, setDroitsSelection] = useState<Set<string>>(new Set());
  const [droitsSubmitting, setDroitsSubmitting] = useState(false);

  const mesModules = currentUser?.modules ?? [];
  const rubriquesAccordables = RUBRIQUES_PORTAIL.filter((r) => mesModules.includes(r));

  const refresh = () => getPortailUtilisateurs().then(setListe);
  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setErreur(null);
    setShowCreate(true);
  };

  const toggleModuleForm = (m: View) => setForm((v) => {
    const set = new Set(v.modules);
    if (set.has(m)) set.delete(m); else set.add(m);
    return { ...v, modules: RUBRIQUES_PORTAIL.filter((r) => set.has(r)) };
  });

  const handleCreate = async () => {
    if (!form.nom.trim() || !form.email.trim() || !form.initiales.trim()) { setErreur("Nom, email et initiales sont obligatoires."); return; }
    if (form.motDePasse.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); return; }
    try {
      setSubmitting(true);
      await createPortailUtilisateur(form);
      setShowCreate(false);
      refresh();
      toast.success("Utilisateur créé.");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: PortailUtilisateur) => {
    if (!window.confirm(`Supprimer l'utilisateur "${u.nom}" ?`)) return;
    try {
      await deletePortailUtilisateur(u.id);
      toast.success("Utilisateur supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const openDroits = (u: PortailUtilisateur) => {
    setDroitsOuvert(u);
    setDroitsSelection(new Set(u.modules));
  };

  const toggleDroit = (m: string) => setDroitsSelection((v) => {
    const next = new Set(v);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });

  const handleSaveDroits = async () => {
    if (!droitsOuvert) return;
    try {
      setDroitsSubmitting(true);
      await updateModulesPortailUtilisateur(droitsOuvert.id, RUBRIQUES_PORTAIL.filter((r) => droitsSelection.has(r)));
      toast.success("Droits mis à jour.");
      setDroitsOuvert(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setDroitsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[1.35rem] font-bold text-foreground">Utilisateurs & droits</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Comptes du portail rattachés à votre entreprise, et leurs accès par rubrique</p>
        </div>
        <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvel utilisateur</Btn>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Utilisateur</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Rubriques accordées</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {liste.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/25">
                <td className="px-4 py-2.5 font-semibold text-foreground">
                  {u.nom} {u.id === currentUser?.id && <span className="text-[10.5px] font-normal text-muted-foreground">(vous)</span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5 text-foreground">{u.modules.length} / {RUBRIQUES_PORTAIL.length}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button type="button" onClick={() => openDroits(u)} className="h-7 px-2.5 rounded-lg border border-border text-[11.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />Droits</button>
                    {u.id !== currentUser?.id && (
                      <button type="button" onClick={() => handleDelete(u)} className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {liste.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aucun utilisateur.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvel utilisateur</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2"><div className={labelCls}>Nom complet</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Initiales</div><input value={form.initiales} onChange={(e) => setForm((v) => ({ ...v, initiales: e.target.value.toUpperCase() }))} className={fieldCls} maxLength={3} /></label>
                <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone ?? ""} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
                <label className="block col-span-2"><div className={labelCls}>Email</div><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                <label className="block col-span-2"><div className={labelCls}>Mot de passe initial</div><input type="password" value={form.motDePasse} onChange={(e) => setForm((v) => ({ ...v, motDePasse: e.target.value }))} className={fieldCls} placeholder="6 caractères minimum" /></label>
              </div>
              <div>
                <div className={labelCls}>Rubriques accessibles</div>
                <div className="space-y-1.5">
                  {rubriquesAccordables.map((m) => {
                    const Icon = viewIcons[m];
                    const checked = form.modules.includes(m);
                    return (
                      <label key={m} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-secondary/30">
                        <input type="checkbox" checked={checked} onChange={() => toggleModuleForm(m)} className="w-4 h-4 accent-primary" />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[13px] text-foreground">{viewLabels[m]}</span>
                      </label>
                    );
                  })}
                </div>
                {mesModules.length < RUBRIQUES_PORTAIL.length && (
                  <p className="text-[11px] text-muted-foreground mt-2">Vous ne pouvez accorder que les rubriques auxquelles vous avez vous-même accès.</p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{erreur ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {droitsOuvert && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold text-foreground">Droits de {droitsOuvert.nom}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Rubriques du menu accessibles à cet utilisateur</p>
            </div>
            <div className="p-5 space-y-1.5">
              {RUBRIQUES_PORTAIL.map((m) => {
                const Icon = viewIcons[m];
                const accordable = mesModules.includes(m);
                const checked = droitsSelection.has(m);
                return (
                  <label key={m} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border ${accordable ? "cursor-pointer hover:bg-secondary/30" : "opacity-50 cursor-not-allowed"}`}>
                    <input type="checkbox" checked={checked} disabled={!accordable} onChange={() => toggleDroit(m)} className="w-4 h-4 accent-primary" />
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[13px] text-foreground">{viewLabels[m]}</span>
                    {!accordable && <Badge variant="neutral">Non accordable</Badge>}
                  </label>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDroitsOuvert(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={droitsSubmitting} onClick={handleSaveDroits} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
