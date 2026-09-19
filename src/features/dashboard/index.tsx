import { useEffect, useState } from "react";
import {
  TrendingUp, DollarSign, FileText, AlertTriangle, Users, CreditCard,
  Stethoscope, Wallet, Download, RefreshCw, Zap, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getPilotageAssurance, openRapportPilotage } from "@/services/dashboard.service";
import { getSinistres } from "@/services/sinistres.service";
import type { PilotageAssurance } from "@/types/dashboard";
import type { View } from "@/layout/navConfig";
import type { Sinistre } from "@/types/sinistres";

// Pilotage Assurance (2026-08) — voir demande utilisateur : "le tableau de
// bord ne doit pas être codé en dur mais interactif et réel." Chaque
// chiffre affiché ici vient de DashboardService.pilotage() (backend), qui
// interroge les vraies données de l'application — plus aucune valeur
// écrite en dur dans ce fichier. Le sélecteur d'année est réellement
// interactif (recharge les données), et "Rapport PDF" génère un vrai
// document au lieu d'un simple toast.
export default function DashboardView() {
  const { setView } = useShellNavigation();
  const [pilotage, setPilotage] = useState<PilotageAssurance | null>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [sinistresRecents, setSinistresRecents] = useState<Sinistre[]>([]);
  const [generationRapport, setGenerationRapport] = useState(false);

  const charger = (a?: number) => {
    setChargement(true);
    getPilotageAssurance(a)
      .then((data) => { setPilotage(data); setAnnee(data.annee); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Chargement du tableau de bord impossible."))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    charger();
    getSinistres().then((data) => setSinistresRecents(data.slice(0, 4))).catch(() => undefined);
  }, []);

  const handleChangerAnnee = (a: number) => { setAnnee(a); charger(a); };

  const handleRapportPdf = async () => {
    setGenerationRapport(true);
    try {
      await openRapportPilotage(annee ?? undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération du rapport impossible.");
    } finally {
      setGenerationRapport(false);
    }
  };

  if (chargement && !pilotage) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement du tableau de bord…</div>;
  }
  if (!pilotage) return null;
  const p = pilotage;
  const naviguer = (view: View) => setView(view);

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-7">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-[linear-gradient(130deg,rgba(13,115,191,0.16),rgba(23,164,135,0.14))] p-4 md:p-5 animate-rise-in shadow-[0_10px_24px_rgba(13,115,191,0.1)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pilotage Assurance</h1>
            <p className="text-sm text-muted-foreground mt-1">Vue d'ensemble portefeuille, performance commerciale et sinistralité santé.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-36">
              <Combobox
                options={p.anneesDisponibles.map((a) => ({ id: a, libelle: `Exercice ${a}` }))}
                value={annee ? { id: annee, libelle: `Exercice ${annee}` } : null}
                onChange={(o) => o && handleChangerAnnee(o.id)}
                getLabel={(o) => o.libelle} getId={(o) => String(o.id)}
              />
            </div>
            <Btn variant="primary" disabled={generationRapport} onClick={handleRapportPdf}>
              <Download className="w-4 h-4" /> {generationRapport ? "Génération…" : "Rapport PDF"}
            </Btn>
          </div>
        </div>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-fade">
        <StatCard
          title="Primes Émises (cumulé)" value={`${fmtM(p.primesEmisesCumule)} FCFA`} subtitle={`Exercice ${p.annee}`}
          icon={TrendingUp} onClick={() => naviguer("contrats")}
          trend={p.variationPrimesPct !== null ? { label: `${p.variationPrimesPct >= 0 ? "+" : ""}${p.variationPrimesPct.toFixed(1)}%`, up: p.variationPrimesPct >= 0 } : undefined}
        />
        <StatCard title="Commissions Perçues" value={`${fmtM(p.commissionsPercues)} FCFA`} subtitle={`Taux moyen ${p.tauxCommissionMoyen.toFixed(1)}%`} icon={DollarSign} onClick={() => naviguer("commissions")} />
        <StatCard
          title="Contrats Actifs" value={String(p.contratsActifs)}
          subtitle={`${p.contratsARenouveler} à renouveler`}
          icon={FileText} onClick={() => naviguer("contrats")}
          breakdown={[
            { label: "enregistrés", value: p.contratsTotal, tone: "neutral" },
            { label: "actifs", value: p.contratsActifs, tone: "success" },
            { label: "inactifs", value: p.contratsInactifs, tone: "danger" },
          ]}
        />
        <StatCard title="Sinistres en Cours" value={String(p.sinistresEnCours)} subtitle={`Ratio S/P : ${p.sinistresRatioSP}%`} icon={AlertTriangle} accent="bg-red-500/15" onClick={() => naviguer("sinistres")} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-fade">
        <StatCard title="Clients Actifs" value={String(p.clientsActifs)} subtitle={`dont ${p.clientsEntreprises} entreprises`} icon={Users} onClick={() => naviguer("clients")} />
        <StatCard title="Taux Recouvrement" value={p.tauxRecouvrement !== null ? `${p.tauxRecouvrement}%` : "—"} subtitle={p.tauxRecouvrement !== null ? `Impayés : ${fmtM(p.montantImpayes)} FCFA` : "Aucun contrat actif"} icon={CreditCard} onClick={() => naviguer("recouvrement")} />
        <StatCard
          title="Assurés Santé" value={String(p.assuresSanteTotal)}
          subtitle={`${p.prisesEnChargeEnAttente} prise(s) en charge en attente`}
          icon={Stethoscope} onClick={() => naviguer("accordPrealable")}
          breakdown={[
            { label: "enregistrés", value: p.assuresSanteTotal, tone: "neutral" },
            { label: "actifs", value: p.assuresSante, tone: "success" },
            { label: "inactifs", value: p.assuresSanteInactifs, tone: "danger" },
          ]}
        />
        <StatCard title="Trésorerie" value={`${fmtM(p.tresorerie)} FCFA`} icon={Wallet} onClick={() => naviguer("tresorerie")} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Production Mensuelle {p.annee}</h3>
              <p className="text-xs text-muted-foreground">Primes émises vs {p.annee - 1} (FCFA)</p>
            </div>
            {p.variationPrimesPct !== null && (
              <Badge variant={p.variationPrimesPct >= 0 ? "success" : "danger"}>{p.variationPrimesPct >= 0 ? "+" : ""}{p.variationPrimesPct.toFixed(1)}% vs {p.annee - 1}</Badge>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={p.productionMensuelle}>
              <defs>
                <linearGradient id="gPrime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gObj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0E7490" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0E7490" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(12,43,46,0.09)" />
              <XAxis dataKey="mois" tick={{ fill: "#537175", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#537175", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} FCFA`]} />
              <Area type="monotone" dataKey="prime" name={`Primes ${p.annee}`} stroke="var(--chart-1)" strokeWidth={2} fill="url(#gPrime)" />
              <Area type="monotone" dataKey="primeAnneePrecedente" name={`Primes ${p.annee - 1}`} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gObj)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-0.5">Répartition Portefeuille</h3>
          <p className="text-xs text-muted-foreground mb-3">Par ville — contrats actifs</p>
          {p.portefeuilleParVille.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Aucun contrat actif.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={p.portefeuilleParVille} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {p.portefeuilleParVille.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {p.portefeuilleParVille.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground med-num">{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Consommation mensuelle, tous contrats (2026-09) — voir demande
          utilisateur : "faire remonter les données de consommation sans
          distinction de contrat... au niveau du tableau de bord". */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Consommation Mensuelle {p.annee}</h3>
            <p className="text-xs text-muted-foreground">Montants remboursés — toutes rubriques, tous contrats confondus (FCFA)</p>
          </div>
          <Badge variant="neutral">Total {p.annee} : {fmtM(p.consommationTotaleAnnee)} FCFA</Badge>
        </div>
        {p.consommationMensuelle.every((m) => m.montant === 0 && m.montantAnneePrecedente === 0) ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Aucune prise en charge enregistrée sur {p.annee} ou {p.annee - 1}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={p.consommationMensuelle}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(12,43,46,0.09)" />
              <XAxis dataKey="mois" tick={{ fill: "#537175", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#537175", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} FCFA`]} />
              <Bar dataKey="montant" name={`Consommation ${p.annee}`} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="montantAnneePrecedente" name={`Consommation ${p.annee - 1}`} fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart + Recent sinistres */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-0.5">Sinistralité par Type de Soins</h3>
          <p className="text-xs text-muted-foreground mb-4">Déclarés · Réglés · Pendants</p>
          {p.sinistraliteParType.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Aucune prise en charge enregistrée.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={p.sinistraliteParType} barSize={9}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(12,43,46,0.09)" />
                <XAxis dataKey="branche" tick={{ fill: "#537175", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#537175", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...ChartTooltipStyle} />
                <Bar dataKey="déclarés" name="Déclarés" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="réglés" name="Réglés" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendants" name="Pendants" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Sinistres Récents</h3>
            <button type="button" onClick={() => setView("sinistres")} className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <div className="space-y-2">
            {sinistresRecents.map((s) => (
              <div key={s.id} onClick={() => setView("sinistres")} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/45 hover:bg-secondary/75 transition-colors cursor-pointer border border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold text-primary med-num">{s.id}</span>
                    <Badge variant={s.priorite === "Urgent" ? "danger" : s.priorite === "Haute" ? "warning" : "neutral"}>{s.priorite}</Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">{s.description}</p>
                  <p className="text-xs text-muted-foreground">{s.client} · {s.branche}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-foreground med-num">{fmtM(s.montant)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.date}</p>
                </div>
              </div>
            ))}
            {sinistresRecents.length === 0 && <p className="text-xs text-muted-foreground py-8 text-center">Aucun sinistre enregistré.</p>}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-card border border-amber-500/25 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Alertes & Actions Requises</h3>
        </div>
        {p.alertes.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />Aucune alerte — rien ne requiert d'action immédiate.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {p.alertes.map((a, i) => (
              <div
                key={i}
                onClick={() => setView(a.view as View)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${a.type === "danger" ? "bg-red-500/8 border-red-500/20" : "bg-amber-500/8 border-amber-500/20"}`}
              >
                {a.view === "renouvellements" ? <RefreshCw className={`w-4 h-4 flex-shrink-0 ${a.type === "danger" ? "text-red-400" : "text-amber-400"}`} />
                  : a.view === "recouvrement" ? <CreditCard className={`w-4 h-4 flex-shrink-0 ${a.type === "danger" ? "text-red-400" : "text-amber-400"}`} />
                  : <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.type === "danger" ? "text-red-400" : "text-amber-400"}`} />}
                <p className="text-xs text-foreground">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
