import { useEffect, useState } from "react";
import {
  TrendingUp, DollarSign, FileText, AlertTriangle, Users, CreditCard,
  Stethoscope, Wallet, Calendar, Download, RefreshCw, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";
import { Btn } from "@/components/shared/Btn";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getProductionMensuelle, getPortefeuilleBranche, getSinistraliteData } from "@/services/dashboard.service";
import { getSinistres } from "@/services/sinistres.service";
import type { ProductionMensuelle, PortefeuilleBranche, SinistraliteData } from "@/types/dashboard";
import type { Sinistre } from "@/types/sinistres";

export default function DashboardView() {
  const [production, setProduction] = useState<ProductionMensuelle[]>([]);
  const [portefeuille, setPortefeuille] = useState<PortefeuilleBranche[]>([]);
  const [sinistralite, setSinistralite] = useState<SinistraliteData[]>([]);
  const [sinistresRecents, setSinistresRecents] = useState<Sinistre[]>([]);

  useEffect(() => {
    getProductionMensuelle().then(setProduction);
    getPortefeuilleBranche().then(setPortefeuille);
    getSinistraliteData().then(setSinistralite);
    getSinistres().then((data) => setSinistresRecents(data.slice(0, 4)));
  }, []);

  const totalPrime = production.reduce((a, b) => a + b.prime, 0);
  const totalComm = production.reduce((a, b) => a + b.commissions, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble — Exercice 2024 · Zone CIMA · 14 pays</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary"><Calendar className="w-4 h-4" /> Octobre 2024</Btn>
          <Btn variant="primary"><Download className="w-4 h-4" /> Rapport PDF</Btn>
        </div>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Primes Émises (cumulé)" value={`${fmtM(totalPrime)} XAF`} subtitle="Exercice 2024" icon={TrendingUp} trend={{ label: "+18.4%", up: true }} />
        <StatCard title="Commissions Perçues" value={`${fmtM(totalComm)} XAF`} subtitle="Taux moyen 10.2%" icon={DollarSign} trend={{ label: "+12.1%", up: true }} />
        <StatCard title="Contrats Actifs" value="1 247" subtitle="89 à renouveler" icon={FileText} trend={{ label: "+54", up: true }} />
        <StatCard title="Sinistres en Cours" value="68" subtitle="Ratio S/P: 34.2%" icon={AlertTriangle} trend={{ label: "−8", up: true }} accent="bg-red-500/10" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Clients Actifs" value="2 841" subtitle="dont 312 entreprises" icon={Users} trend={{ label: "+127", up: true }} />
        <StatCard title="Taux Recouvrement" value="94.7%" subtitle="Impayés: 14.2M XAF" icon={CreditCard} trend={{ label: "+2.3%", up: true }} />
        <StatCard title="Assurés Santé" value="456" subtitle="48 prises en charge" icon={Stethoscope} trend={{ label: "+23", up: true }} />
        <StatCard title="Trésorerie" value="287.4M XAF" subtitle="vs Budget: +12%" icon={Wallet} trend={{ label: "+5.8%", up: true }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Production Mensuelle 2024</h3>
              <p className="text-xs text-muted-foreground">Primes émises vs Objectif (XAF)</p>
            </div>
            <Badge variant="success">+18.4% vs 2023</Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={production}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mois" tick={{ fill: "#6E8BAD", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} XAF`]} />
              <Area type="monotone" dataKey="prime" name="Primes" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gPrime)" />
              <Area type="monotone" dataKey="objectif" name="Objectif" stroke="#0E7490" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gObj)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-0.5">Répartition Portefeuille</h3>
          <p className="text-xs text-muted-foreground mb-3">Par branche d'assurance</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={portefeuille} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                {portefeuille.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {portefeuille.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart + Recent sinistres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-0.5">Sinistralité par Branche</h3>
          <p className="text-xs text-muted-foreground mb-4">Déclarés · Réglés · Pendants</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sinistralite} barSize={9}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="branche" tick={{ fill: "#6E8BAD", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...ChartTooltipStyle} />
              <Bar dataKey="déclarés" name="Déclarés" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="réglés" name="Réglés" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pendants" name="Pendants" fill="#DC2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Sinistres Récents</h3>
            <button className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <div className="space-y-2">
            {sinistresRecents.map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{s.id}</span>
                    <Badge variant={s.priorite === "Urgent" ? "danger" : s.priorite === "Haute" ? "warning" : "neutral"}>{s.priorite}</Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">{s.description}</p>
                  <p className="text-xs text-muted-foreground">{s.client} · {s.branche}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(s.montant)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-card border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Alertes & Actions Requises</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            { msg: "89 contrats à renouveler dans les 30 prochains jours", icon: RefreshCw, type: "warning" },
            { msg: "14 primes impayées — Recouvrement urgent requis", icon: CreditCard, type: "danger" },
            { msg: "3 dossiers sinistres en attente expertise > 15 jours", icon: AlertTriangle, type: "warning" },
          ].map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${a.type === "danger" ? "bg-red-500/8 border-red-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
              <a.icon className={`w-4 h-4 flex-shrink-0 ${a.type === "danger" ? "text-red-400" : "text-amber-400"}`} />
              <p className="text-xs text-foreground">{a.msg}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
