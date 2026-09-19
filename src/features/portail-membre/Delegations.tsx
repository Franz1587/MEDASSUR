import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, X, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { viewLabels, viewIcons, type View } from "@/layout/navConfig";
import {
  getDelegations, getModulesDelegables, accorderDelegation, modifierModulesDelegation, revoquerDelegation,
  type DelegationMembre, type CanalDelegation,
} from "@/services/delegationsFamille.service";

const fieldCls = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground";
const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";

const LABEL_TYPE: Record<string, string> = { CJ: "Conjoint(e)", EF: "Enfant" };
const LABEL_CANAL: Record<CanalDelegation, string> = { matricule: "Matricule", email: "Adresse email", telephone: "Numéro de téléphone" };

interface FormAcces {
  identifiantType: CanalDelegation;
  identifiantValeur: string;
  motDePasse: string;
  modules: Set<View>;
}
function emptyForm(): FormAcces {
  return { identifiantType: "matricule", identifiantValeur: "", motDePasse: "", modules: new Set(["membreDashboard"]) };
}

// Accès famille (2026-08) — voir demande utilisateur : "l'assuré principal
// dans son interface doit pouvoir donner des droits à un des membres de la
// famille en décidant ce que ce dernier doit pouvoir voir. L'accès... doit
// pouvoir se faire par le numéro matricule, l'adresse mail... ou le numéro
// de téléphone... il devra mettre le mot de passe pour accéder à
// l'interface." Réutilise exactement le patron déjà validé côté portail
// client (Utilisateurs.tsx) : anti-élévation de privilège (on ne peut
// accorder que ce qu'on détient soi-même), modules toujours en ordre
// stable.
export default function MembreDelegationsView() {
  const [membres, setMembres] = useState<DelegationMembre[] | null>(null);
  const [modulesDisponibles, setModulesDisponibles] = useState<View[]>([]);
  const [cibleOuverte, setCibleOuverte] = useState<DelegationMembre | null>(null);
  const [form, setForm] = useState<FormAcces>(emptyForm());
  const [erreur, setErreur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getDelegations().then(setMembres);
  useEffect(() => {
    refresh();
    getModulesDelegables().then(setModulesDisponibles);
  }, []);

  const ouvrirAcces = (m: DelegationMembre) => {
    setCibleOuverte(m);
    setErreur(null);
    if (m.compte) {
      setForm({ identifiantType: "matricule", identifiantValeur: "", motDePasse: "", modules: new Set(m.compte.modules as View[]) });
    } else {
      setForm(emptyForm());
    }
  };

  const toggleModule = (m: View) => setForm((v) => {
    const s = new Set(v.modules);
    if (s.has(m)) s.delete(m); else s.add(m);
    return { ...v, modules: s };
  });

  const soumettre = async () => {
    if (!cibleOuverte) return;
    setErreur(null);
    if (!cibleOuverte.compte && form.motDePasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if ((form.identifiantType === "email" || form.identifiantType === "telephone") && !cibleOuverte.compte && !form.identifiantValeur.trim()) {
      setErreur(`${LABEL_CANAL[form.identifiantType]} requis pour ce canal.`);
      return;
    }
    setSubmitting(true);
    try {
      const modules = modulesDisponibles.filter((m) => form.modules.has(m));
      if (cibleOuverte.compte) {
        // Compte déjà existant : on ne touche qu'aux droits (canal et mot
        // de passe déjà fixés à la première délégation, non modifiables
        // depuis cet écran).
        await modifierModulesDelegation(cibleOuverte.id, modules);
      } else {
        await accorderDelegation(cibleOuverte.id, {
          identifiantType: form.identifiantType, identifiantValeur: form.identifiantValeur.trim() || undefined,
          motDePasse: form.motDePasse, modules,
        });
      }
      toast.success(cibleOuverte.compte ? "Droits mis à jour." : "Accès créé.");
      setCibleOuverte(null);
      refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const revoquer = async (m: DelegationMembre) => {
    if (!window.confirm(`Révoquer l'accès de ${m.nom} ${m.prenom ?? ""} ?`)) return;
    try {
      await revoquerDelegation(m.id);
      toast.success("Accès révoqué.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Révocation impossible.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Accès famille</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Donnez à vos ayants droit leur propre accès au portail, et choisissez ce qu'ils peuvent voir</p>
      </div>

      {!membres ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : membres.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun ayant droit rattaché.</div>
      ) : (
        <div className="space-y-2.5">
          {membres.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground truncate">{m.nom} {m.prenom ?? ""}</p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">{LABEL_TYPE[m.typeAssure ?? ""] ?? m.typeAssure ?? "—"} · {m.matricule}</p>
              </div>
              {m.compte ? <Badge variant="success">Accès actif · {m.compte.modules.length} rubrique(s)</Badge> : <Badge variant="neutral">Aucun accès</Badge>}
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => ouvrirAcces(m)} className="h-8 px-2.5 rounded-lg border border-border text-[11.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />{m.compte ? "Droits" : "Donner accès"}
                </button>
                {m.compte && (
                  <button type="button" onClick={() => revoquer(m)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cibleOuverte && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />{cibleOuverte.compte ? "Modifier les droits" : "Donner accès"}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cibleOuverte.nom} {cibleOuverte.prenom ?? ""}</p>
              </div>
              <button type="button" onClick={() => setCibleOuverte(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3.5">
              {!cibleOuverte.compte && (
                <>
                  <div>
                    <div className={labelCls}>Se connecter par</div>
                    <div className="flex gap-2">
                      {(["matricule", "email", "telephone"] as CanalDelegation[]).map((c) => (
                        <button
                          key={c} type="button" onClick={() => setForm((v) => ({ ...v, identifiantType: c }))}
                          className={`flex-1 h-9 rounded-lg border text-[12px] font-medium ${form.identifiantType === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                        >
                          {LABEL_CANAL[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.identifiantType === "matricule" && (
                    <p className="text-[11.5px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">Matricule de connexion : <span className="font-semibold text-foreground">{cibleOuverte.matricule}</span></p>
                  )}
                  {form.identifiantType === "email" && (
                    <label className="block"><div className={labelCls}>Adresse email de {cibleOuverte.prenom || cibleOuverte.nom}</div>
                      <input type="email" value={form.identifiantValeur} onChange={(e) => setForm((v) => ({ ...v, identifiantValeur: e.target.value }))} className={fieldCls} placeholder="exemple@gmail.com" />
                    </label>
                  )}
                  {form.identifiantType === "telephone" && (
                    <label className="block"><div className={labelCls}>Numéro de téléphone de {cibleOuverte.prenom || cibleOuverte.nom}</div>
                      <input value={form.identifiantValeur} onChange={(e) => setForm((v) => ({ ...v, identifiantValeur: e.target.value }))} className={fieldCls} placeholder="+241 ..." />
                      <p className="text-[10.5px] text-muted-foreground mt-1">Doit être différent de votre propre numéro — sinon la connexion par téléphone restera ambiguë.</p>
                    </label>
                  )}
                  <label className="block"><div className={labelCls}>Mot de passe initial</div>
                    <input type="password" value={form.motDePasse} onChange={(e) => setForm((v) => ({ ...v, motDePasse: e.target.value }))} className={fieldCls} placeholder="6 caractères minimum" />
                  </label>
                </>
              )}
              <div>
                <div className={labelCls}>Rubriques accessibles</div>
                <div className="space-y-1.5">
                  {modulesDisponibles.map((m) => {
                    const Icon = viewIcons[m];
                    const checked = form.modules.has(m);
                    return (
                      <label key={m} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-secondary/30">
                        <input type="checkbox" checked={checked} onChange={() => toggleModule(m)} className="w-4 h-4 accent-primary" />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[13px] text-foreground">{viewLabels[m]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{erreur ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCibleOuverte(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={soumettre} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
