import { useEffect, useState } from "react";
import { Building2, ShieldCheck, ShieldAlert, Users2, Wallet, Gauge, Layers, Receipt, Activity } from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { fmt } from "@/lib/format";
import { getSocietes, getResumeFacturation, getPerformanceGlobale } from "@/services/societes.service";
import type { Societe, ResumeFacturation, PerformanceGlobale } from "@/types/societes";

const MOIS_LABELS: Record<string, string> = { "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin", "07": "Juil", "08": "Août", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc" };
const COULEURS_PLAN = ["#0f4c81", "#1f9d55", "#d97706", "#7c3aed", "#0891b2"];

// Tableau de bord Super Admin (2026-09) — voir demande utilisateur : "il
// doit donc avoir son écran qui lui permet de voir et de gérer l'application
// à 360°... un écran vraiment riche... Car le super Admin est comme le dieu
// de l'application." Centre de pilotage : sociétés, revenus de la
// plateforme, usage réel — chaque chiffre vient des vrais services
// (SocietesService/FactureAbonnementService/PerformanceService), rien n'est
// codé en dur.
export default function SuperAdminDashboard() {
  const { setView } = useShellNavigation();
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [resume, setResume] = useState<ResumeFacturation | null>(null);
  const [perf, setPerf] = useState<PerformanceGlobale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSocietes(), getResumeFacturation(), getPerformanceGlobale()])
      .then(([s, r, p]) => { setSocietes(s); setResume(r); setPerf(p); })
      .finally(() => setLoading(false));
  }, []);

  const actives = societes.filter((s) => s.statut === "Actif").length;
  const suspendues = societes.filter((s) => s.statut === "Suspendu").length;
  const totalUtilisateurs = societes.reduce((s, so) => s + so._count.users, 0);

  const tendance = resume?.tendanceMensuelle.map((t) => ({ mois: `${MOIS_LABELS[t.mois.slice(5)]}`, montant: t.montant })) ?? [];
  const parPlan = Object.entries(
    societes.reduce<Record<string, number>>((acc, s) => {
      const label = s.planAbonnement?.nom ?? "Sur mesure";
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([nom, valeur]) => ({ nom, valeur }));

  return (
    <div className="p-6">
      <ModuleHeader
        title="Super Admin"
        subtitle="Propriétaire de la plateforme — pilotage à 360° des sociétés utilisatrices"
        icon={ShieldCheck}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Sociétés" value={loading ? "…" : String(societes.length)} subtitle={`${actives} active(s)`} icon={Building2} onClick={() => setView("superAdminSocietes")} />
        <StatCard title="Comptes utilisateurs" value={loading ? "…" : String(totalUtilisateurs)} subtitle={perf ? `${perf.utilisateursActifs30j} actif(s) sous 30j` : undefined} icon={Users2} />
        <StatCard title="Encaissé" value={loading || !resume ? "…" : fmt(resume.totalEncaisse)} subtitle={resume && resume.totalEnRetard > 0 ? `${fmt(resume.totalEnRetard)} en retard` : "À jour"} icon={Wallet} accent="bg-emerald-500" onClick={() => setView("superAdminFacturation")} />
        <StatCard title="Opérations (30j)" value={loading || !perf ? "…" : String(perf.operations30j)} icon={Activity} accent="bg-primary" onClick={() => setView("superAdminPerformance")} />
      </div>

      {suspendues > 0 && (
        <div className="mb-5 flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-[12.5px] text-amber-700 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {suspendues} société(s) suspendue(s) — <button type="button" onClick={() => setView("superAdminSocietes")} className="underline font-semibold">voir</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Receipt className="w-4 h-4 text-primary" /><h3 className="font-semibold text-foreground text-sm">Revenus de la plateforme — 12 derniers mois</h3></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tendance}>
              <defs>
                <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [fmt(v)]} />
              <Area type="monotone" dataKey="montant" stroke="var(--primary)" fill="url(#dashRevGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-primary" /><h3 className="font-semibold text-foreground text-sm">Répartition par abonnement</h3></div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={parPlan} dataKey="valeur" nameKey="nom" innerRadius={40} outerRadius={65} paddingAngle={2}>
                {parPlan.map((p, i) => <Cell key={p.nom} fill={COULEURS_PLAN[i % COULEURS_PLAN.length]} />)}
              </Pie>
              <Tooltip {...ChartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {parPlan.map((p, i) => (
              <div key={p.nom} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COULEURS_PLAN[i % COULEURS_PLAN.length] }} />
                {p.nom} ({p.valeur})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <button type="button" onClick={() => setView("superAdminPlans")} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-primary/12"><Layers className="w-5 h-5 text-primary" /></div>
          <div><p className="font-semibold text-foreground text-sm">Plans d'abonnement</p><p className="text-[11.5px] text-muted-foreground">Gérer les types d'abonnement</p></div>
        </button>
        <button type="button" onClick={() => setView("superAdminFacturation")} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-primary/12"><Receipt className="w-5 h-5 text-primary" /></div>
          <div><p className="font-semibold text-foreground text-sm">Comptabilité & Facturation</p><p className="text-[11.5px] text-muted-foreground">Frais d'installation, licences</p></div>
        </button>
        <button type="button" onClick={() => setView("superAdminPerformance")} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-primary/12"><Gauge className="w-5 h-5 text-primary" /></div>
          <div><p className="font-semibold text-foreground text-sm">Performance & Usage</p><p className="text-[11.5px] text-muted-foreground">Activité réelle par société</p></div>
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Sociétés récentes</h3>
          <button type="button" onClick={() => setView("superAdminSocietes")} className="text-[12px] text-primary hover:underline">Voir toutes →</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Société", "Ville", "Abonnement", "Comptes", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {societes.slice(0, 6).map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer" onClick={() => setView("superAdminSocietes")}>
                <td className="px-4 py-3 font-semibold text-foreground text-sm">{s.nom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.ville ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.planAbonnement?.nom ?? "Sur mesure"}</td>
                <td className="px-4 py-3 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s._count.users}</td>
                <td className="px-4 py-3"><Badge variant={s.statut === "Actif" ? "success" : "danger"}>{s.statut}</Badge></td>
              </tr>
            ))}
            {!loading && societes.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune société créée pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
