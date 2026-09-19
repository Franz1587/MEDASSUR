import { useEffect, useState } from "react";
import { Building2, Plus, ShieldAlert, ShieldCheck, X, Search, Layers, LogIn } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { useAuth } from "@/auth/AuthContext";
import { ModulesPicker } from "./ModulesPicker";
import { SocieteUsersPanel } from "./SocieteUsersPanel";
import { TOUS_LES_MODULES } from "@/auth/moduleGroups";
import {
  getSocietes, getSociete, creerSociete, modifierSociete, suspendreSociete, reactiverSociete, getPlansAbonnement,
  getEstimationPrixModules, uploadLogoSociete,
} from "@/services/societes.service";
import { getModelesCarte } from "@/services/modelesCarte.service";
import { fmt } from "@/lib/format";
import type { Societe, SocieteDetail, CreerSocieteInput, PlanAbonnement, CycleFacturation, TypeSociete } from "@/types/societes";
import { CYCLES_FACTURATION, TYPES_SOCIETE } from "@/types/societes";
import type { ModeleCarte } from "@/types/modeleCarte";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const SUR_MESURE = "__sur_mesure__";

function emptyForm(): CreerSocieteInput {
  return { nom: "", email: "", telephone: "", ville: "", pays: "Gabon", type: "Courtier", adminNom: "", adminEmail: "", planAbonnementId: undefined, modules: [], cycleFacturation: "Mensuel", prixAbonnement: undefined, fraisInstallation: undefined };
}

// Badge de type de société (2026-09) — réutilisé dans le tableau et l'aperçu.
const BADGE_TYPE_SOCIETE: Record<TypeSociete, { variant: "info" | "gold" | "neutral"; description: string }> = {
  Courtier: { variant: "info", description: "Place des contrats auprès de plusieurs compagnies, en tire une commission." },
  Mutuelle: { variant: "gold", description: "Gère son propre tiers payant en interne, comme une IPM." },
  Compagnie: { variant: "neutral", description: "Utilise l'application comme son outil métier — travaille avec des courtiers/agents généraux qui placent des contrats en son sein." },
};

// Sélecteur de type de société (2026-09) — voir demande utilisateur : "il
// faut pouvoir dire le type de société qui va utiliser l'application."
function TypeSocieteField({ value, onChange }: { value: TypeSociete; onChange: (t: TypeSociete) => void }) {
  return (
    <div>
      <div className={labelCls}>Type de société</div>
      <div className="grid grid-cols-3 gap-2">
        {TYPES_SOCIETE.map((t) => (
          <button
            key={t} type="button" onClick={() => onChange(t)}
            className={`text-left px-3 py-2 rounded-lg border transition-colors ${value === t ? "border-primary bg-primary/8" : "border-border hover:bg-secondary/30"}`}
          >
            <div className={`text-[13px] font-semibold ${value === t ? "text-primary" : "text-foreground"}`}>{t}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{BADGE_TYPE_SOCIETE[t].description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Modal d'abonnement — création ET modification d'une société partagent le
// même choix de plan + personnalisation des modules (2026-09, voir demande
// utilisateur : "il revient au super Admin de donner accès à ces modules
// là en fonction du type d'abonnement souscrit"). Choisir un plan
// PRÉ-REMPLIT la sélection ; elle reste ensuite librement personnalisable
// avant d'enregistrer, sans devoir créer un nouveau plan nommé pour un cas
// particulier (même principe que RoleModuleTemplate → User.modules).
function AbonnementFields({ plans, planAbonnementId, modules, onChange }: {
  plans: PlanAbonnement[];
  planAbonnementId: string | undefined;
  modules: string[];
  onChange: (planAbonnementId: string | undefined, modules: string[]) => void;
}) {
  // Estimation en direct (2026-09) — voir demande utilisateur : "l'option
  // d'abonnement s'enrichisse en fonction des fonctionnalités cochées" —
  // recalculée à chaque coche/décoche depuis le catalogue ModulePrix (voir
  // TarificationService.calculerPrixModules), converti en FCFA.
  const [estimation, setEstimation] = useState<number | null>(null);
  useEffect(() => {
    let annule = false;
    getEstimationPrixModules(modules).then((r) => { if (!annule) setEstimation(r.prixMensuelXaf); }).catch(() => undefined);
    return () => { annule = true; };
  }, [modules]);

  return (
    <div className="space-y-3">
      <label className="block">
        <div className={labelCls}>Plan d'abonnement</div>
        <select
          value={planAbonnementId ?? SUR_MESURE}
          onChange={(e) => {
            if (e.target.value === SUR_MESURE) { onChange(undefined, modules); return; }
            const plan = plans.find((p) => p.id === e.target.value);
            onChange(e.target.value, plan ? [...plan.modules] : modules);
          }}
          className={fieldCls}
        >
          <option value={SUR_MESURE}>Sur mesure (sans plan nommé)</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.nom} — {p.modules.length} module(s){p.prixMensuel != null ? ` · ${fmt(p.prixMensuel)}/mois` : ""}</option>)}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">Choisir un plan pré-remplit les modules ci-dessous — librement ajustables ensuite pour cette société précise.</p>
      </label>
      <div className="flex items-center justify-between bg-primary/5 border border-primary/25 rounded-lg px-3 py-2">
        <span className="text-[12px] text-muted-foreground">Coût estimé ({modules.length} module{modules.length > 1 ? "s" : ""})</span>
        <span className="text-[14px] font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{estimation != null ? `${fmt(estimation)}/mois` : "…"}</span>
      </div>
      <ModulesPicker
        selection={new Set(modules)}
        onToggle={(v) => onChange(planAbonnementId, modules.includes(v) ? modules.filter((m) => m !== v) : [...modules, v])}
        onSelectAll={() => onChange(planAbonnementId, [...TOUS_LES_MODULES])}
        onSelectNone={() => onChange(planAbonnementId, [])}
      />
    </div>
  );
}

// Champs de facturation (2026-09) — voir demande utilisateur : "gérer... le
// paiement de licence d'utilisation par mois, trimestre, semestre, années
// (selon le mode de souscription)". prixAbonnement laissé vide = dérivé du
// tarif du plan choisi × durée du cycle (voir FactureAbonnementService).
function FacturationFields({ cycleFacturation, prixAbonnement, fraisInstallation, onChange }: {
  cycleFacturation: CycleFacturation | undefined;
  prixAbonnement: number | undefined;
  fraisInstallation: number | undefined;
  onChange: (patch: { cycleFacturation?: CycleFacturation; prixAbonnement?: number; fraisInstallation?: number }) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="block"><div className={labelCls}>Cycle de facturation</div>
        <select value={cycleFacturation ?? "Mensuel"} onChange={(e) => onChange({ cycleFacturation: e.target.value as CycleFacturation })} className={fieldCls}>
          {CYCLES_FACTURATION.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="block"><div className={labelCls}>Prix par cycle (FCFA)</div>
        <input type="number" min={0} placeholder="Dérivé du plan" value={prixAbonnement ?? ""} onChange={(e) => onChange({ prixAbonnement: e.target.value ? Number(e.target.value) : undefined })} className={fieldCls} />
      </label>
      <label className="block"><div className={labelCls}>Frais d'installation (FCFA)</div>
        <input type="number" min={0} placeholder="0" value={fraisInstallation ?? ""} onChange={(e) => onChange({ fraisInstallation: e.target.value ? Number(e.target.value) : undefined })} className={fieldCls} />
      </label>
    </div>
  );
}

// Gestion des Sociétés (2026-09) — voir demande utilisateur : "c'est lui
// [le Super Admin] qui crée les sociétés d'assurances qui vont utiliser
// l'application comme outil métier... il revient au super Admin de donner
// accès à ces modules là en fonction du type d'abonnement souscrit... il
// doit pouvoir accéder dans chaque interface dédiée aux société en mode
// assistance... créer et gérer des utilisateurs pour chaque société."
export default function SuperAdminSocietesView() {
  const navigate = useNavigate();
  const { startAssistance } = useAuth();
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [plans, setPlans] = useState<PlanAbonnement[]>([]);
  const [modeles, setModeles] = useState<ModeleCarte[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SocieteDetail | null>(null);
  const [tab, setTab] = useState<"apercu" | "utilisateurs">("apercu");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreerSocieteInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuspendre, setShowSuspendre] = useState(false);
  const [motifSuspension, setMotifSuspension] = useState("");
  const [busy, setBusy] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [creds, setCreds] = useState<{ email: string; motDePasse: string; smsEnvoye: boolean } | null>(null);
  const [showAbonnement, setShowAbonnement] = useState(false);
  const [abonnementDraft, setAbonnementDraft] = useState<{ planAbonnementId: string | undefined; modules: string[]; cycleFacturation: CycleFacturation; prixAbonnement: number | undefined; fraisInstallation: number | undefined }>(
    { planAbonnementId: undefined, modules: [], cycleFacturation: "Mensuel", prixAbonnement: undefined, fraisInstallation: undefined },
  );

  const refresh = () => {
    setLoading(true);
    getSocietes().then(setSocietes).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); getPlansAbonnement().then(setPlans).catch(() => undefined); getModelesCarte().then(setModeles).catch(() => undefined); }, []);

  const filtered = societes.filter((s) => !recherche.trim() || (s.nom + " " + (s.ville ?? "")).toLowerCase().includes(recherche.trim().toLowerCase()));

  const openDetail = async (id: string) => {
    try {
      setSelected(await getSociete(id));
      setTab("apercu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible.");
    }
  };

  const openCreate = () => {
    const defaut = plans[0];
    setForm({ ...emptyForm(), planAbonnementId: defaut?.id, modules: defaut ? [...defaut.modules] : [] });
    setLogoFile(null);
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.nom.trim() || !form.adminNom.trim() || !form.adminEmail.trim()) {
      setFormError("Nom de la société, nom et email de l'administrateur sont obligatoires.");
      return;
    }
    if (!form.modules?.length) {
      setFormError("Choisissez au moins un module — sans cela, l'administrateur de cette société ne verra aucune fonctionnalité à sa connexion.");
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);
      const res = await creerSociete(form);
      // Logo — upload différé (2026-09) — la société doit exister avant
      // qu'un fichier puisse lui être rattaché (voir uploadLogoSociete).
      // Best-effort : une société créée sans logo reste pleinement
      // utilisable, l'admin peut l'ajouter ensuite depuis son propre écran
      // Paramètres de l'entreprise.
      if (logoFile) {
        await uploadLogoSociete(res.societe.id, logoFile).catch((err) => toast.error(err instanceof Error ? err.message : "Société créée, mais l'envoi du logo a échoué — réessayez depuis son écran Paramètres."));
      }
      setShowCreate(false);
      setCreds({ email: res.admin.email, motDePasse: res.motDePasseInitial, smsEnvoye: res.smsEnvoye });
      toast.success(`Société "${res.societe.nom}" créée.`);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAbonnement = () => {
    if (!selected) return;
    setAbonnementDraft({
      planAbonnementId: selected.planAbonnementId ?? undefined, modules: [...selected.modules],
      cycleFacturation: selected.cycleFacturation, prixAbonnement: selected.prixAbonnement ?? undefined, fraisInstallation: selected.fraisInstallation ?? undefined,
    });
    setShowAbonnement(true);
  };

  const handleSaveAbonnement = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      const maj = await modifierSociete(selected.id, {
        planAbonnementId: abonnementDraft.planAbonnementId ?? null, modules: abonnementDraft.modules,
        cycleFacturation: abonnementDraft.cycleFacturation, prixAbonnement: abonnementDraft.prixAbonnement, fraisInstallation: abonnementDraft.fraisInstallation,
      });
      setSelected((s) => (s ? { ...s, ...maj } : s));
      setShowAbonnement(false);
      toast.success("Abonnement mis à jour — les comptes de cette société sont plafonnés en conséquence.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleSuspendre = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      const maj = await suspendreSociete(selected.id, motifSuspension.trim() || undefined);
      setSelected((s) => (s ? { ...s, ...maj } : s));
      setShowSuspendre(false);
      setMotifSuspension("");
      toast.success("Société suspendue — tous ses comptes sont bloqués à la connexion.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suspension impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleReactiver = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      const maj = await reactiverSociete(selected.id);
      setSelected((s) => (s ? { ...s, ...maj } : s));
      toast.success("Société réactivée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Réactivation impossible.");
    } finally {
      setBusy(false);
    }
  };

  // Mode assistance (2026-09) — voir demande utilisateur : "le Super Admin
  // doit pouvoir accéder dans chaque interface dédiée aux société en mode
  // assistance." Bascule la session courante et redirige vers le shell
  // interne de la société — le bandeau AssistanceBanner (monté globalement,
  // voir App.tsx) permet ensuite de revenir au Super Admin.
  const handleAssistance = async () => {
    if (!selected) return;
    try {
      setAssisting(true);
      await startAssistance(selected.id);
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de démarrer l'assistance.");
    } finally {
      setAssisting(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader
        title="Sociétés" subtitle="Sociétés d'assurance utilisant MedAssur comme outil métier" icon={Building2}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle société</Btn>}
      />

      <div className="flex-1 relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          placeholder="Rechercher une société…" value={recherche} onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Sociétés ({filtered.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Société", "Abonnement", "Comptes", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} onClick={() => openDetail(s.id)} className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === s.id ? "bg-primary/8" : "hover:bg-secondary/30"}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground text-sm">{s.nom}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{s.ville ?? "—"}</span>
                      <Badge variant={BADGE_TYPE_SOCIETE[s.type].variant}>{s.type}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.planAbonnement?.nom ?? "Sur mesure"} · {s.modules.length} module(s)</td>
                  <td className="px-4 py-3 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s._count.users}</td>
                  <td className="px-4 py-3"><Badge variant={s.statut === "Actif" ? "success" : "danger"}>{s.statut}</Badge></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune société — cliquez sur "Nouvelle société" pour commencer.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground text-center py-16">Sélectionnez une société pour voir le détail.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-base">{selected.nom}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant={selected.statut === "Actif" ? "success" : "danger"}>{selected.statut}</Badge>
                    <Badge variant={BADGE_TYPE_SOCIETE[selected.type].variant}>{selected.type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Btn variant="secondary" onClick={handleAssistance} disabled={assisting || selected.statut !== "Actif"}>
                    <LogIn className="w-4 h-4" />{assisting ? "…" : "Assistance"}
                  </Btn>
                  {selected.statut === "Actif" ? (
                    <Btn variant="secondary" onClick={() => setShowSuspendre(true)}><ShieldAlert className="w-4 h-4" />Suspendre</Btn>
                  ) : (
                    <Btn variant="secondary" onClick={handleReactiver} disabled={busy}><ShieldCheck className="w-4 h-4" />Réactiver</Btn>
                  )}
                </div>
              </div>
              {selected.motifSuspension && <p className="text-[12px] text-red-600 bg-red-500/10 border border-red-500/25 rounded-lg px-2.5 py-1.5">Motif : {selected.motifSuspension}</p>}

              <div className="flex items-center gap-2 border-b border-border/70">
                {(["apercu", "utilisateurs"] as const).map((t) => (
                  <button
                    key={t} type="button" onClick={() => setTab(t)}
                    className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {t === "apercu" ? "Aperçu" : `Utilisateurs (${selected.users.length})`}
                  </button>
                ))}
              </div>

              {tab === "apercu" ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div><div className={labelCls}>Email</div><div className="text-foreground">{selected.email ?? "—"}</div></div>
                    <div><div className={labelCls}>Téléphone</div><div className="text-foreground">{selected.telephone ?? "—"}</div></div>
                    <div><div className={labelCls}>Ville</div><div className="text-foreground">{selected.ville ?? "—"}</div></div>
                    <div><div className={labelCls}>Pays</div><div className="text-foreground">{selected.pays}</div></div>
                  </div>

                  <div className="border border-border rounded-lg p-3 bg-secondary/20 flex items-center justify-between gap-3">
                    <div>
                      <div className={labelCls}>Abonnement & facturation</div>
                      <p className="text-[13px] font-semibold text-foreground">{selected.planAbonnement?.nom ?? "Sur mesure"} · {selected.modules.length} module(s)</p>
                      <p className="text-[11.5px] text-muted-foreground">{selected.cycleFacturation} — {selected.prixAbonnement != null ? fmt(selected.prixAbonnement) : selected.planAbonnement?.prixMensuel != null ? `dérivé du plan (${fmt(selected.planAbonnement.prixMensuel)}/mois)` : "tarif non défini"}</p>
                    </div>
                    <Btn variant="secondary" onClick={openAbonnement}><Layers className="w-4 h-4" />Gérer</Btn>
                  </div>
                </>
              ) : (
                <SocieteUsersPanel societeId={selected.id} modulesAutorises={selected.modules} />
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle société</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {formError && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{formError}</p>}
              <div className={labelCls}>SOCIÉTÉ</div>
              <label className="block"><div className={labelCls}>Nom *</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
              <TypeSocieteField value={form.type ?? "Courtier"} onChange={(type) => setForm((v) => ({ ...v, type }))} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Email</div><input value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Ville</div><input value={form.ville} onChange={(e) => setForm((v) => ({ ...v, ville: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Pays</div><input value={form.pays} onChange={(e) => setForm((v) => ({ ...v, pays: e.target.value }))} className={fieldCls} /></label>
              </div>

              <div className={labelCls}>IDENTITÉ & CARTE</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className={labelCls}>Logo</div>
                  <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className={`${fieldCls} py-1.5`} />
                  {logoFile && <p className="text-[11px] text-muted-foreground mt-1">{logoFile.name}</p>}
                </label>
                <label className="block">
                  <div className={labelCls}>Modèle de carte</div>
                  <select value={form.modeleCarteId ?? "classique"} onChange={(e) => setForm((v) => ({ ...v, modeleCarteId: e.target.value === "classique" ? undefined : e.target.value }))} className={fieldCls}>
                    {modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className={labelCls}>Préfixe matricule</div>
                  <input value={form.prefixeMatricule ?? ""} onChange={(e) => setForm((v) => ({ ...v, prefixeMatricule: e.target.value.toUpperCase() }))} className={fieldCls} placeholder="ex. LRX — laisser vide pour le préfixe générique" />
                </label>
              </div>

              <div className={labelCls}>PREMIER COMPTE ADMINISTRATEUR</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Nom *</div><input value={form.adminNom} onChange={(e) => setForm((v) => ({ ...v, adminNom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Email *</div><input type="email" value={form.adminEmail} onChange={(e) => setForm((v) => ({ ...v, adminEmail: e.target.value }))} className={fieldCls} /></label>
              </div>
              <div className={labelCls}>FACTURATION</div>
              <FacturationFields
                cycleFacturation={form.cycleFacturation} prixAbonnement={form.prixAbonnement} fraisInstallation={form.fraisInstallation}
                onChange={(patch) => setForm((v) => ({ ...v, ...patch }))}
              />
              <div className={labelCls}>ABONNEMENT — MODULES ACCESSIBLES À CETTE SOCIÉTÉ</div>
              <AbonnementFields
                plans={plans}
                planAbonnementId={form.planAbonnementId}
                modules={form.modules ?? []}
                onChange={(planAbonnementId, modules) => setForm((v) => ({ ...v, planAbonnementId, modules }))}
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={submitting} onClick={handleCreate}>{submitting ? "Création…" : "Créer la société"}</Btn>
            </div>
          </div>
        </div>
      )}

      {showAbonnement && selected && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Abonnement — {selected.nom}</h3>
                <p className="text-[11px] text-muted-foreground">Plafonne ce que les administrateurs de cette société peuvent accorder à leurs propres utilisateurs.</p>
              </div>
              <button type="button" onClick={() => setShowAbonnement(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className={labelCls}>FACTURATION</div>
              <FacturationFields
                cycleFacturation={abonnementDraft.cycleFacturation} prixAbonnement={abonnementDraft.prixAbonnement} fraisInstallation={abonnementDraft.fraisInstallation}
                onChange={(patch) => setAbonnementDraft((v) => ({ ...v, ...patch }))}
              />
              <div className={labelCls}>MODULES</div>
              <AbonnementFields
                plans={plans}
                planAbonnementId={abonnementDraft.planAbonnementId}
                modules={abonnementDraft.modules}
                onChange={(planAbonnementId, modules) => setAbonnementDraft((v) => ({ ...v, planAbonnementId, modules }))}
              />
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowAbonnement(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={busy} onClick={handleSaveAbonnement}>Enregistrer</Btn>
            </div>
          </div>
        </div>
      )}

      {showSuspendre && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border"><h3 className="text-[15px] font-semibold text-foreground">Suspendre la société</h3></div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-muted-foreground">Tous les comptes de cette société seront bloqués à la connexion, sans suppression de données.</p>
              <label className="block"><div className={labelCls}>Motif (facultatif)</div><input value={motifSuspension} onChange={(e) => setMotifSuspension(e.target.value)} className={fieldCls} /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowSuspendre(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={busy} onClick={handleSuspendre}>Suspendre</Btn>
            </div>
          </div>
        </div>
      )}

      {creds && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border"><h3 className="text-[15px] font-semibold text-foreground">Société créée</h3></div>
            <div className="p-5 space-y-3">
              <p className="text-[13px] text-muted-foreground">
                {creds.smsEnvoye
                  ? "Ces identifiants ont été envoyés par SMS/WhatsApp au numéro renseigné pour la société — mot de passe initial, à changer à la première connexion."
                  : "Aucun numéro exploitable n'a été renseigné pour la société — communiquez ces identifiants vous-même. Mot de passe initial, à changer à la première connexion."}
              </p>
              <div className="bg-secondary/40 rounded-lg p-3 text-[13px] space-y-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                <div className="text-foreground">Email : {creds.email}</div>
                <div className="text-foreground">Mot de passe : {creds.motDePasse}</div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex justify-end">
              <Btn variant="primary" onClick={() => setCreds(null)}>Fermer</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
