import { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, Building2, FileText, Search, Bell,
  ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Settings,
  TrendingUp, Shield, Heart, AlertTriangle, CheckCircle, Clock,
  XCircle, Plus, Filter, Download, Upload, Eye, Edit,
  MoreHorizontal, MessageSquare, Sparkles, Send, FileSearch,
  RefreshCw, LogOut, User, ArrowUpRight, ArrowDownRight, Zap,
  Phone, Mail, MapPin, Calendar, CreditCard, Wallet, BookOpen,
  Archive, Brain, BarChart3, Stethoscope, Truck, Activity,
  ScanLine, Target, DollarSign, Star,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────
type View =
  | "dashboard" | "crm" | "clients" | "compagnies" | "devis"
  | "comparateur" | "contrats" | "renouvellements" | "avenants"
  | "resiliations" | "sinistres" | "sante" | "iard" | "vie"
  | "flotte" | "comptabilite" | "commissions" | "recouvrement"
  | "tresorerie" | "ged" | "ia" | "rapports" | "admin";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

// ── Formatters ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}
function fmtM(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "Md";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

// ── Mock Data ──────────────────────────────────────────────────────────
const productionMensuelle = [
  { mois: "Jan", prime: 45_200_000, objectif: 40_000_000, commissions: 4_520_000 },
  { mois: "Fév", prime: 52_800_000, objectif: 45_000_000, commissions: 5_280_000 },
  { mois: "Mar", prime: 61_500_000, objectif: 55_000_000, commissions: 6_150_000 },
  { mois: "Avr", prime: 58_200_000, objectif: 55_000_000, commissions: 5_820_000 },
  { mois: "Mai", prime: 72_400_000, objectif: 65_000_000, commissions: 7_240_000 },
  { mois: "Jun", prime: 68_900_000, objectif: 65_000_000, commissions: 6_890_000 },
  { mois: "Jul", prime: 79_300_000, objectif: 75_000_000, commissions: 7_930_000 },
  { mois: "Aoû", prime: 83_600_000, objectif: 80_000_000, commissions: 8_360_000 },
  { mois: "Sep", prime: 91_200_000, objectif: 85_000_000, commissions: 9_120_000 },
  { mois: "Oct", prime: 87_500_000, objectif: 90_000_000, commissions: 8_750_000 },
  { mois: "Nov", prime: 95_800_000, objectif: 95_000_000, commissions: 9_580_000 },
  { mois: "Déc", prime: 108_400_000, objectif: 100_000_000, commissions: 10_840_000 },
];

const portefeuilleBranche = [
  { name: "Automobile", value: 35, color: "#C9A24A" },
  { name: "IARD", value: 22, color: "#0E7490" },
  { name: "Santé", value: 18, color: "#16A34A" },
  { name: "Vie", value: 12, color: "#7C3AED" },
  { name: "Flotte", value: 8, color: "#DC2626" },
  { name: "Autres", value: 5, color: "#78716C" },
];

const sinistraliteData = [
  { branche: "Auto", déclarés: 145, réglés: 112, pendants: 33 },
  { branche: "IARD", déclarés: 67, réglés: 54, pendants: 13 },
  { branche: "Santé", déclarés: 234, réglés: 201, pendants: 33 },
  { branche: "Vie", déclarés: 12, réglés: 10, pendants: 2 },
  { branche: "Flotte", déclarés: 89, réglés: 71, pendants: 18 },
];

const mockClients = [
  { id: "CLI-001", nom: "SABC SA", type: "Entreprise", pays: "Cameroun", contact: "Jean-Pierre Mballa", tel: "+237 699 123 456", email: "jp.mballa@sabc.cm", contrats: 8, prime: 45_200_000, statut: "Actif" },
  { id: "CLI-002", nom: "Groupe CFAO", type: "Entreprise", pays: "Côte d'Ivoire", contact: "Amadou Konaté", tel: "+225 07 12 34 56", email: "a.konate@cfao.ci", contrats: 12, prime: 87_500_000, statut: "Actif" },
  { id: "CLI-003", nom: "Marie-Claire Diallo", type: "Particulier", pays: "Sénégal", contact: "Marie-Claire Diallo", tel: "+221 77 456 78 90", email: "mc.diallo@gmail.com", contrats: 2, prime: 1_200_000, statut: "Actif" },
  { id: "CLI-004", nom: "BGFI Bank Gabon", type: "Entreprise", pays: "Gabon", contact: "Henri Obiang", tel: "+241 06 78 90 12", email: "h.obiang@bgfibank.ga", contrats: 5, prime: 32_600_000, statut: "Actif" },
  { id: "CLI-005", nom: "Kofi Asante", type: "Particulier", pays: "Togo", contact: "Kofi Asante", tel: "+228 90 12 34 56", email: "k.asante@yahoo.fr", contrats: 1, prime: 850_000, statut: "Inactif" },
  { id: "CLI-006", nom: "MTN Cameroun", type: "Entreprise", pays: "Cameroun", contact: "Patricia Nguemo", tel: "+237 677 234 567", email: "p.nguemo@mtn.cm", contrats: 15, prime: 124_000_000, statut: "Actif" },
  { id: "CLI-007", nom: "Fatou Sow", type: "Particulier", pays: "Sénégal", contact: "Fatou Sow", tel: "+221 76 345 67 89", email: "f.sow@hotmail.fr", contrats: 3, prime: 2_100_000, statut: "Actif" },
  { id: "CLI-008", nom: "SOGEA-SATOM CI", type: "Entreprise", pays: "Côte d'Ivoire", contact: "Luc Koffi Mensah", tel: "+225 05 23 45 67", email: "l.mensah@sogea.ci", contrats: 6, prime: 56_800_000, statut: "Actif" },
];

const mockContrats = [
  { id: "CTR-2024-001", client: "SABC SA", branche: "Flotte Auto", compagnie: "ACTIVA Assurances", dateDebut: "01/01/2024", dateFin: "31/12/2024", prime: 28_500_000, statut: "Actif", jours: "60 jours" },
  { id: "CTR-2024-002", client: "Groupe CFAO", branche: "IARD", compagnie: "AXA Côte d'Ivoire", dateDebut: "01/03/2024", dateFin: "28/02/2025", prime: 45_200_000, statut: "Actif", jours: "120 jours" },
  { id: "CTR-2024-003", client: "Marie-Claire Diallo", branche: "Automobile", compagnie: "Allianz Sénégal", dateDebut: "15/06/2024", dateFin: "14/06/2025", prime: 850_000, statut: "Actif", jours: "180 jours" },
  { id: "CTR-2024-004", client: "BGFI Bank Gabon", branche: "Santé Collective", compagnie: "NSIA Vie", dateDebut: "01/01/2024", dateFin: "31/12/2024", prime: 32_600_000, statut: "En renouvellement", jours: "15 jours" },
  { id: "CTR-2024-005", client: "MTN Cameroun", branche: "Santé Collective", compagnie: "COLINA Assurances", dateDebut: "01/04/2024", dateFin: "31/03/2025", prime: 98_000_000, statut: "Actif", jours: "210 jours" },
  { id: "CTR-2023-089", client: "Kofi Asante", branche: "Automobile", compagnie: "UAM Togo", dateDebut: "01/07/2023", dateFin: "30/06/2024", prime: 450_000, statut: "Expiré", jours: "—" },
  { id: "CTR-2024-006", client: "SOGEA-SATOM CI", branche: "RC Professionnelle", compagnie: "AXA Côte d'Ivoire", dateDebut: "01/02/2024", dateFin: "31/01/2025", prime: 18_500_000, statut: "Actif", jours: "180 jours" },
];

const mockSinistres = [
  { id: "SIN-2024-0451", client: "SABC SA", branche: "Flotte Auto", date: "15/10/2024", description: "Collision véhicule M-YA 234 CE", montant: 4_500_000, statut: "Expert. en cours", priorite: "Haute" },
  { id: "SIN-2024-0452", client: "Fatou Sow", branche: "Automobile", date: "18/10/2024", description: "Vol partiel — pièces moteur", montant: 1_200_000, statut: "Déclaré", priorite: "Normal" },
  { id: "SIN-2024-0450", client: "Groupe CFAO", branche: "IARD", date: "12/10/2024", description: "Incendie entrepôt Cocody II", montant: 125_000_000, statut: "Expertise", priorite: "Urgent" },
  { id: "SIN-2024-0449", client: "MTN Cameroun", branche: "Santé", date: "10/10/2024", description: "Hospitalisation — P. Essomba", montant: 3_800_000, statut: "Remboursé", priorite: "Normal" },
  { id: "SIN-2024-0448", client: "SOGEA-SATOM CI", branche: "RC Pro", date: "08/10/2024", description: "Accident chantier Bassam V", montant: 8_600_000, statut: "Recours", priorite: "Haute" },
  { id: "SIN-2024-0447", client: "BGFI Bank", branche: "IARD", date: "05/10/2024", description: "Dégâts des eaux — bureau DG", montant: 2_100_000, statut: "Clôturé", priorite: "Normal" },
];

const kanbanColumns: Record<string, string[]> = {
  "Déclaré": ["SIN-2024-0452", "SIN-2024-0453", "SIN-2024-0454"],
  "Expert. en cours": ["SIN-2024-0451", "SIN-2024-0455"],
  "Expertise": ["SIN-2024-0450"],
  "Recours": ["SIN-2024-0448"],
  "Remboursé": ["SIN-2024-0449", "SIN-2024-0456"],
  "Clôturé": ["SIN-2024-0447"],
};

const assuresSante = [
  { id: "ASS-001", nom: "Paul Nguesso", matricule: "MTN-CM-00234", police: "CTR-2024-005", benef: 4, cotisation: 185_000, statut: "Actif" },
  { id: "ASS-002", nom: "Yvette Koffi", matricule: "MTN-CM-00235", police: "CTR-2024-005", benef: 3, cotisation: 142_000, statut: "Actif" },
  { id: "ASS-003", nom: "Bernard Atangana", matricule: "MTN-CM-00236", police: "CTR-2024-005", benef: 2, cotisation: 98_000, statut: "Suspendu" },
];

const priseEnCharges = [
  { id: "PC-2024-0234", assure: "Paul Nguesso", prestataire: "Hôpital Général Yaoundé", type: "Hospitalisation", montant: 3_800_000, statut: "Accordé", date: "10/10/2024" },
  { id: "PC-2024-0233", assure: "Yvette Koffi", prestataire: "Clinique des Eaux-Claires", type: "Consultation", montant: 45_000, statut: "Remboursé", date: "08/10/2024" },
  { id: "PC-2024-0232", assure: "Ibrahim Diallo", prestataire: "Pharmacie Centrale Dakar", type: "Pharmacie", montant: 78_000, statut: "Accordé", date: "07/10/2024" },
];

const journalEntries = [
  { date: "31/10/2024", num: "JNL-001245", libelle: "Primes encaissées — SABC SA", debit: 0, credit: 28_500_000, compte: "701000" },
  { date: "31/10/2024", num: "JNL-001246", libelle: "Commission ACTIVA Assurances — Oct.", debit: 3_420_000, credit: 0, compte: "612000" },
  { date: "30/10/2024", num: "JNL-001244", libelle: "Reversement primes — AXA CI", debit: 0, credit: 45_200_000, compte: "401000" },
  { date: "30/10/2024", num: "JNL-001243", libelle: "Règlement sinistre SIN-2024-0448", debit: 8_600_000, credit: 0, compte: "652000" },
  { date: "29/10/2024", num: "JNL-001242", libelle: "Honoraires expertise — Cabinet Alpha", debit: 850_000, credit: 0, compte: "624000" },
  { date: "28/10/2024", num: "JNL-001241", libelle: "Primes encaissées — MTN Cameroun", debit: 0, credit: 98_000_000, compte: "701000" },
];

const mockCompagnies = [
  { id: "CMP-001", nom: "ACTIVA Assurances", pays: "Cameroun", taux: "12%", contrats: 145, prime: 285_000_000, niveau: "Premium" },
  { id: "CMP-002", nom: "NSIA Assurances", pays: "Côte d'Ivoire", taux: "10%", contrats: 98, prime: 198_000_000, niveau: "Standard" },
  { id: "CMP-003", nom: "AXA Côte d'Ivoire", pays: "Côte d'Ivoire", taux: "11%", contrats: 112, prime: 245_000_000, niveau: "Premium" },
  { id: "CMP-004", nom: "Allianz Sénégal", pays: "Sénégal", taux: "10%", contrats: 67, prime: 134_000_000, niveau: "Standard" },
  { id: "CMP-005", nom: "COLINA Assurances", pays: "Côte d'Ivoire", taux: "9%", contrats: 89, prime: 178_000_000, niveau: "Standard" },
  { id: "CMP-006", nom: "SANLAM Africa", pays: "Pan-Africain", taux: "8%", contrats: 34, prime: 89_000_000, niveau: "Standard" },
];

// ── Shared UI Components ───────────────────────────────────────────────

function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const s: Record<BadgeVariant, string> = {
    success: "bg-green-500/15 text-green-400 border-green-500/25",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    danger: "bg-red-500/15 text-red-400 border-red-500/25",
    info: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
    neutral: "bg-slate-500/15 text-slate-400 border-slate-500/25",
    gold: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${s[variant]}`}>
      {children}
    </span>
  );
}

function StatCard({
  title, value, subtitle, icon: Icon, trend, accent,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; trend?: { label: string; up: boolean }; accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all group cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${accent || "bg-primary/10"}`}>
          <Icon className={`w-5 h-5 ${accent ? "text-white" : "text-primary"}`} />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trend.up ? "text-green-400" : "text-red-400"}`}>
            {trend.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/60 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ModuleHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: string; subtitle?: string; icon: React.ElementType; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function Btn({ children, variant = "secondary", onClick, className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void; className?: string;
}) {
  const base = "flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-all";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick}>{children}</button>;
}

// ── Tooltip customization ──────────────────────────────────────────────
const ChartTooltipStyle = {
  contentStyle: {
    background: "#0D1B2E",
    border: "1px solid rgba(201,162,74,0.2)",
    borderRadius: "8px",
    color: "#DDE6F4",
    fontSize: "12px",
  },
};

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════
function DashboardView() {
  const totalPrime = productionMensuelle.reduce((a, b) => a + b.prime, 0);
  const totalComm = productionMensuelle.reduce((a, b) => a + b.commissions, 0);

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
            <AreaChart data={productionMensuelle}>
              <defs>
                <linearGradient id="gPrime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A24A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#C9A24A" stopOpacity={0} />
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
              <Area type="monotone" dataKey="prime" name="Primes" stroke="#C9A24A" strokeWidth={2} fill="url(#gPrime)" />
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
              <Pie data={portefeuilleBranche} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                {portefeuilleBranche.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {portefeuilleBranche.map((item) => (
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
            <BarChart data={sinistraliteData} barSize={9}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="branche" tick={{ fill: "#6E8BAD", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...ChartTooltipStyle} />
              <Bar dataKey="déclarés" name="Déclarés" fill="#C9A24A" radius={[4, 4, 0, 0]} />
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
            {mockSinistres.slice(0, 4).map((s) => (
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

// ═══════════════════════════════════════════════════════════════════════
// CLIENTS VIEW
// ═══════════════════════════════════════════════════════════════════════
function ClientsView() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Tous" | "Entreprise" | "Particulier">("Tous");
  const [selected, setSelected] = useState<typeof mockClients[0] | null>(null);

  const filtered = useMemo(
    () => mockClients.filter((c) => {
      const q = search.toLowerCase();
      return (
        (c.nom.toLowerCase().includes(q) || c.pays.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)) &&
        (typeFilter === "Tous" || c.type === typeFilter)
      );
    }),
    [search, typeFilter],
  );

  return (
    <div className="p-6">
      <ModuleHeader
        title="Gestion des Clients"
        subtitle={`${mockClients.length} clients enregistrés · ${mockClients.filter((c) => c.statut === "Actif").length} actifs`}
        icon={Users}
        actions={
          <>
            <Btn variant="secondary"><Download className="w-4 h-4" />Export</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouveau client</Btn>
          </>
        }
      />
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="Rechercher par nom, pays, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(["Tous", "Entreprise", "Particulier"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2.5 text-sm transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground font-medium" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Client", "Pays", "Contrats", "Prime Totale", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {c.nom.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.nom}</p>
                        <p className="text-xs text-muted-foreground">{c.type} · {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.pays}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{c.contrats}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.statut === "Actif" ? "success" : "neutral"}>{c.statut}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucun résultat pour votre recherche</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-border">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 ${selected.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                  {selected.nom.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-foreground">{selected.nom}</h3>
                <p className="text-xs text-muted-foreground">{selected.type} · {selected.id}</p>
                <div className="mt-2"><Badge variant={selected.statut === "Actif" ? "success" : "neutral"}>{selected.statut}</Badge></div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: User, label: "Contact", value: selected.contact },
                  { icon: Phone, label: "Téléphone", value: selected.tel },
                  { icon: Mail, label: "Email", value: selected.email },
                  { icon: MapPin, label: "Pays", value: selected.pays },
                  { icon: FileText, label: "Contrats", value: `${selected.contrats} polices actives` },
                  { icon: TrendingUp, label: "Prime totale", value: fmt(selected.prime) },
                ].map(({ icon: I, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <I className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm text-foreground font-medium break-all">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Btn variant="primary" className="flex-1 justify-center"><Eye className="w-4 h-4" />Contrats</Btn>
                <Btn variant="secondary" className="flex-1 justify-center"><Edit className="w-4 h-4" />Éditer</Btn>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un client<br />pour voir le détail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPAGNIES VIEW
// ═══════════════════════════════════════════════════════════════════════
function CompagniesView() {
  return (
    <div className="p-6">
      <ModuleHeader title="Compagnies Partenaires" subtitle="Réseau de compagnies d'assurance — Zone CIMA" icon={Building2}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Ajouter compagnie</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockCompagnies.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <Badge variant={c.niveau === "Premium" ? "gold" : "neutral"}>{c.niveau}</Badge>
            </div>
            <h3 className="font-bold text-foreground mb-0.5">{c.nom}</h3>
            <p className="text-xs text-muted-foreground mb-4">{c.pays}</p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
              <div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{c.contrats}</p>
                <p className="text-xs text-muted-foreground">Contrats</p>
              </div>
              <div>
                <p className="text-sm font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{c.taux}</p>
                <p className="text-xs text-muted-foreground">Commission</p>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</p>
                <p className="text-xs text-muted-foreground">Primes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CONTRATS VIEW
// ═══════════════════════════════════════════════════════════════════════
function ContratsView() {
  const [statusFilter, setStatusFilter] = useState("Tous");
  const statuts = ["Tous", "Actif", "En renouvellement", "Expiré"];
  const filtered = statusFilter === "Tous" ? mockContrats : mockContrats.filter((c) => c.statut === statusFilter);

  return (
    <div className="p-6">
      <ModuleHeader title="Production — Contrats" subtitle="Gestion des polices d'assurance en portefeuille" icon={FileText}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Filtres avancés</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouveau contrat</Btn>
          </>
        }
      />
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {statuts.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
            {s !== "Tous" && <span className="text-xs opacity-70">{mockContrats.filter((c) => c.statut === s).length}</span>}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["N° Police", "Client", "Branche", "Compagnie", "Période", "Prime Annuelle", "Échéance", "Statut", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.client}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.branche}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {c.dateDebut} → {c.dateFin}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className={`text-xs font-semibold ${c.jours.includes("15") ? "text-red-400" : c.jours.includes("60") ? "text-amber-400" : "text-muted-foreground"}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                    {c.jours}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={c.statut === "Actif" ? "success" : c.statut === "En renouvellement" ? "warning" : c.statut === "Expiré" ? "danger" : "neutral"}>{c.statut}</Badge>
                </td>
                <td className="px-4 py-3">
                  <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPARATEUR IA / OCR VIEW
// ═══════════════════════════════════════════════════════════════════════
function ComparateurView() {
  const [step, setStep] = useState<"upload" | "processing" | "result">("upload");
  const [dragging, setDragging] = useState(false);

  const offres = [
    {
      compagnie: "ACTIVA Assurances", prime: 2_850_000,
      garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol complet", "Incendie"],
      franchise: "150 000 XAF", plafond: "50M XAF", score: 94, recommande: true,
    },
    {
      compagnie: "AXA Côte d'Ivoire", prime: 2_620_000,
      garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol partiel", "Bris de glace"],
      franchise: "200 000 XAF", plafond: "30M XAF", score: 78, recommande: false,
    },
    {
      compagnie: "Allianz Sénégal", prime: 3_100_000,
      garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol complet", "Incendie", "Assistance 24h/7j", "Véhicule de remplacement"],
      franchise: "100 000 XAF", plafond: "75M XAF", score: 88, recommande: false,
    },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setStep("processing");
    setTimeout(() => setStep("result"), 1800);
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Comparateur IA — OCR" subtitle="Import et analyse automatique des offres d'assurance multi-compagnies" icon={ScanLine} />

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: "upload", label: "1. Importer les offres" },
          { key: "processing", label: "2. Analyse OCR + IA" },
          { key: "result", label: "3. Comparatif généré" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setStep(s.key as typeof step)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors font-medium ${step === s.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
            >
              {s.label}
            </button>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/3"}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-semibold mb-1">Glissez vos offres ici</p>
                <p className="text-sm text-muted-foreground">Formats: PDF, Word, Excel, images scannées · Max 50 Mo</p>
              </div>
              <button
                onClick={() => { setStep("processing"); setTimeout(() => setStep("result"), 1800); }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-1"
              >
                Parcourir les fichiers
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { icon: FileSearch, title: "OCR Intelligent", desc: "Extraction automatique des garanties, franchises, capitaux et primes depuis tout format de document." },
              { icon: Brain, title: "Analyse IA", desc: "Détection d'incohérences, exclusions cachées et clauses défavorables au client." },
              { icon: BarChart3, title: "Comparatif Auto", desc: "Génération d'un tableau comparatif clair et d'une proposition personnalisée orientant le choix." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
                <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3"><f.icon className="w-4 h-4 text-primary" /></div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-24 space-y-5">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Brain className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-foreground font-semibold">Analyse en cours…</p>
            <p className="text-sm text-muted-foreground">Extraction OCR · Vectorisation · Comparaison · Scoring IA</p>
          </div>
          <div className="flex gap-2">
            {["ACTIVA_offre.pdf", "AXA_conditions.docx", "Allianz_scan.jpg"].map((f) => (
              <span key={f} className="text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-foreground font-medium">3 offres analysées</span>
              <span className="text-muted-foreground">· Flotte Auto 15 véhicules · SABC SA · Yaoundé</span>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary"><Download className="w-4 h-4" />Exporter PDF</Btn>
              <Btn variant="ghost" onClick={() => setStep("upload")}><RefreshCw className="w-4 h-4" />Nouvelle analyse</Btn>
            </div>
          </div>

          {/* AI insight */}
          <div className="bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/15 rounded-lg flex-shrink-0 mt-0.5"><Brain className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">Analyse IA — Synthèse comparative</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Sur la base des garanties, franchises et tarifs analysés, <strong className="text-foreground">ACTIVA Assurances</strong> offre le meilleur rapport garanties/prix (Score: 94/100). L'offre Allianz est plus complète (+2 garanties) mais 8.8% plus chère. <strong className="text-amber-400">Attention:</strong> L'offre AXA exclut le vol partiel — risque élevé en zone urbaine de Yaoundé selon l'historique sinistres.
                </p>
              </div>
            </div>
          </div>

          {/* Offer cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {offres.map((o) => (
              <div key={o.compagnie} className={`bg-card rounded-xl p-5 relative border ${o.recommande ? "border-primary shadow-lg shadow-primary/5" : "border-border"}`}>
                {o.recommande && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full whitespace-nowrap">
                    ★ Recommandé
                  </div>
                )}
                <div className="text-center mb-4 pt-1">
                  <h3 className="font-bold text-foreground text-sm">{o.compagnie}</h3>
                  <div className="text-2xl font-bold text-primary mt-2" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(o.prime)}</div>
                  <p className="text-xs text-muted-foreground">XAF / an</p>
                </div>
                <div className="space-y-1.5 mb-4">
                  {o.garanties.map((g) => (
                    <div key={g} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{g}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Franchise</span>
                    <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{o.franchise}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plafond</span>
                    <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{o.plafond}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted-foreground">Score IA</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-secondary rounded-full h-1.5">
                        <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${o.score}%` }} />
                      </div>
                      <span className="font-bold text-primary text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{o.score}/100</span>
                    </div>
                  </div>
                </div>
                <button className={`w-full mt-4 py-2.5 text-xs rounded-lg font-semibold transition-all ${o.recommande ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                  Sélectionner cette offre
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SINISTRES VIEW
// ═══════════════════════════════════════════════════════════════════════
function SinistresView() {
  const [activeTab, setActiveTab] = useState<"liste" | "kanban">("liste");

  const statusStyle: Record<string, string> = {
    "Déclaré": "text-blue-400 bg-blue-500/10 border-blue-500/20",
    "Expert. en cours": "text-amber-400 bg-amber-500/10 border-amber-500/20",
    "Expertise": "text-orange-400 bg-orange-500/10 border-orange-500/20",
    "Recours": "text-purple-400 bg-purple-500/10 border-purple-500/20",
    "Remboursé": "text-green-400 bg-green-500/10 border-green-500/20",
    "Clôturé": "text-slate-400 bg-slate-500/10 border-slate-500/20",
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Gestion des Sinistres" subtitle="Déclaration, expertise, suivi, indemnisation et clôture" icon={AlertTriangle}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Déclarer un sinistre</Btn>}
      />
      <div className="flex gap-2 mb-5">
        {(["liste", "kanban"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            {t === "liste" ? "Liste des sinistres" : "Vue Workflow Kanban"}
          </button>
        ))}
      </div>

      {activeTab === "liste" ? (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Référence", "Client", "Branche", "Description", "Montant estimé", "Date", "Priorité", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockSinistres.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.client}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{s.branche}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(s.montant)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={s.priorite === "Urgent" ? "danger" : s.priorite === "Haute" ? "warning" : "neutral"}>{s.priorite}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${statusStyle[s.statut] || statusStyle["Clôturé"]}`}>
                      {s.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {Object.entries(kanbanColumns).map(([status, ids]) => (
              <div key={status} className="w-52 flex-shrink-0">
                <div className={`px-3 py-2 rounded-lg mb-3 border text-xs font-semibold flex items-center justify-between ${statusStyle[status] || statusStyle["Clôturé"]}`}>
                  <span>{status}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const s = mockSinistres.find((x) => x.id === id);
                    return (
                      <div key={id} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                        <p className="text-xs font-semibold text-primary mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>{id}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s?.description || "Sinistre en traitement"}</p>
                        {s && (
                          <p className="text-xs font-semibold text-foreground mt-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {fmtM(s.montant)} XAF
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SANTÉ VIEW
// ═══════════════════════════════════════════════════════════════════════
function SanteView() {
  return (
    <div className="p-6">
      <ModuleHeader title="Module Santé" subtitle="Assurés, bénéficiaires, prises en charge et remboursements" icon={Stethoscope}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle prise en charge</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Assurés actifs", value: "456", icon: Users, color: "text-primary" },
          { label: "Bénéficiaires totaux", value: "1 248", icon: Heart, color: "text-red-400" },
          { label: "Prises en charge actives", value: "48", icon: Clock, color: "text-amber-400" },
          { label: "Remboursé ce mois", value: "12.4M XAF", icon: CheckCircle, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={`w-5 h-5 mb-2.5 ${s.color}`} />
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Assurés Principaux</h3>
            <button className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Assuré", "Matricule", "Bénéf.", "Cotisation/mois", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assuresSante.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-foreground text-sm">{a.nom}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{a.matricule}</td>
                  <td className="px-4 py-3 text-center text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{a.benef}</td>
                  <td className="px-4 py-3 text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.cotisation)}</td>
                  <td className="px-4 py-3"><Badge variant={a.statut === "Actif" ? "success" : "warning"}>{a.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Prises en Charge Récentes</h3>
            <button className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <div className="p-4 space-y-3">
            {priseEnCharges.map((pc) => (
              <div key={pc.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{pc.id}</span>
                    <Badge variant={pc.type === "Hospitalisation" ? "danger" : "neutral"}>{pc.type}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                  <p className="text-xs text-muted-foreground">{pc.prestataire}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(pc.montant)}</p>
                  <div className="mt-1"><Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge></div>
                  <p className="text-xs text-muted-foreground mt-1">{pc.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPTABILITÉ VIEW
// ═══════════════════════════════════════════════════════════════════════
function ComptabiliteView() {
  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Comptabilité SYSCOHADA" subtitle="Journal général, grand livre et états financiers — Plan OHADA révisé" icon={BookOpen}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Exercice 2024</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle saisie</Btn>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chiffre d'affaires", value: "847.2M", sub: "+18.4% vs N-1", up: true },
          { label: "Commissions perçues", value: "89.4M", sub: "Taux moyen 10.2%", up: true },
          { label: "Charges d'exploitation", value: "234.6M", sub: "Dont sinistres: 189M", up: false },
          { label: "Résultat net", value: "62.8M", sub: "Marge nette: 7.4%", up: true },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
              {k.value} <span className="text-xs text-muted-foreground">XAF</span>
            </p>
            <p className={`text-xs mt-1 ${k.up ? "text-green-400" : "text-muted-foreground"}`}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">Journal Général — Octobre 2024</h3>
            <Badge variant="info">SYSCOHADA révisé</Badge>
          </div>
          <Btn variant="ghost"><Download className="w-4 h-4" />Export</Btn>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "N° Écriture", "Libellé", "Compte", "Débit (XAF)", "Crédit (XAF)"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((j, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{j.date}</td>
                <td className="px-4 py-3 text-xs text-primary font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{j.num}</td>
                <td className="px-4 py-3 text-sm text-foreground">{j.libelle}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{j.compte}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-400 whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {j.debit > 0 ? new Intl.NumberFormat("fr-FR").format(j.debit) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {j.credit > 0 ? new Intl.NumberFormat("fr-FR").format(j.credit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// IA ASSISTANT VIEW
// ═══════════════════════════════════════════════════════════════════════
function IAView() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Bonjour ! Je suis CourtEVA+IA, votre assistant intelligent dédié au courtage zone CIMA. Je peux analyser vos contrats, détecter des incohérences, générer des rapports et courriers, calculer des provisions, ou vous assister sur tout aspect de la gestion de votre portefeuille. Comment puis-je vous aider ?" },
  ]);
  const [input, setInput] = useState("");

  const suggestions = [
    "Analyser les contrats à renouveler ce mois",
    "Détecter les risques de sinistralité élevée",
    "Générer un rapport de production mensuel",
    "Rédiger un courrier de relance impayé",
    "Calculer les provisions pour sinistres pendants",
    "Analyser la rentabilité par branche d'assurance",
    "Vérifier la conformité CIMA du portefeuille",
    "Identifier les clients à fort potentiel de croissance",
  ];

  const mockResponses: Record<string, string> = {
    default: "J'analyse votre demande sur la base des 1 247 contrats actifs et 847.2M XAF de primes du portefeuille CourtEVA+.\n\n**Points clés identifiés:**\n• Le ratio sinistres/primes (34.2%) est dans les normes CIMA (<65%)\n• 89 contrats arrivent à échéance dans 30 jours — priorité de renouvellement\n• La branche Santé présente 48 dossiers ouverts avec une durée moyenne de 12 jours\n\nJe recommande une action immédiate sur les 14 impayés représentant 14.2M XAF. Souhaitez-vous que je génère les courriers de relance automatiquement ?",
  };

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const next = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    setTimeout(() => {
      setMessages([...next, { role: "assistant", content: mockResponses.default }]);
    }, 700);
  };

  return (
    <div className="p-6 h-full flex flex-col" style={{ minHeight: 0 }}>
      <ModuleHeader title="CourtEVA+IA — Assistant Intelligent" subtitle="Analyse de contrats · Détection de fraudes · Génération de documents · Assistance métier" icon={Brain} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 0 }}>
        <div className="lg:col-span-3 bg-card border border-border rounded-xl flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-foreground"}`}>
                  {m.content.split("\n").map((line, j) => (
                    <p key={j} className={line.startsWith("**") ? "font-semibold mb-1 mt-1" : ""}>{line.replace(/\*\*/g, "")}</p>
                  ))}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                className="flex-1 px-4 py-2.5 bg-secondary/40 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Posez votre question ou demandez une analyse…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button onClick={() => handleSend()} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Suggestions rapides</h3>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Capacités IA</h3>
            <div className="space-y-2">
              {[
                { icon: FileSearch, text: "Analyse contrats & polices" },
                { icon: AlertTriangle, text: "Détection fraudes & anomalies" },
                { icon: MessageSquare, text: "Génération de courriers" },
                { icon: BarChart3, text: "Rapports automatisés" },
                { icon: Shield, text: "Audit conformité CIMA" },
                { icon: Activity, text: "Scoring risques clients" },
              ].map(({ icon: I, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <I className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RAPPORTS VIEW
// ═══════════════════════════════════════════════════════════════════════
function RapportsView() {
  const rapports = [
    { title: "Rapport de Production — Octobre 2024", date: "31/10/2024", type: "Production", statut: "Généré", taille: "1.4 Mo" },
    { title: "État du Portefeuille — T3 2024", date: "30/09/2024", type: "Portefeuille", statut: "Généré", taille: "2.1 Mo" },
    { title: "Sinistralité Automobile — Oct.", date: "28/10/2024", type: "Sinistres", statut: "Généré", taille: "890 Ko" },
    { title: "Tableau de Bord Commissions Oct.", date: "31/10/2024", type: "Finance", statut: "En cours", taille: "—" },
    { title: "Rapport Conformité CIMA 2024", date: "15/10/2024", type: "Conformité", statut: "Généré", taille: "3.2 Mo" },
    { title: "Analyse Rentabilité par Branche", date: "01/11/2024", type: "Finance", statut: "Planifié", taille: "—" },
  ];

  const kpis = [
    { title: "Taux de Transformation", value: "34.8%", target: "Cible: 35%", ok: true },
    { title: "Ratio Combiné", value: "89.2%", target: "Cible: < 95%", ok: true },
    { title: "Prime Moy./Contrat", value: "679K XAF", target: "+5% YoY", ok: true },
    { title: "Durée Moy. Sinistre", value: "22 jours", target: "Cible: < 30j", ok: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Reporting & KPIs" subtitle="Indicateurs de performance et rapports d'activité — Zone CIMA" icon={BarChart3}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Générer un rapport</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.title} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{k.target}</span>
            </div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.title}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Bibliothèque de Rapports</h3>
        </div>
        <div className="divide-y divide-border/50">
          {rapports.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><FileSearch className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.type} · {r.date} {r.taille !== "—" && `· ${r.taille}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={r.statut === "Généré" ? "success" : r.statut === "En cours" ? "warning" : "neutral"}>{r.statut}</Badge>
                {r.statut === "Généré" && (
                  <button className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════════════════════════════
function AdminView() {
  const users = [
    { nom: "Aristide Bengono", role: "Administrateur", email: "a.bengono@courteva.cm", statut: "Actif", login: "Aujourd'hui 08:42" },
    { nom: "Nadège Fotso", role: "Directeur Commercial", email: "n.fotso@courteva.cm", statut: "Actif", login: "Aujourd'hui 09:15" },
    { nom: "Eric Kabila", role: "Gest. Production", email: "e.kabila@courteva.cm", statut: "Actif", login: "Hier 17:30" },
    { nom: "Solange Abiodun", role: "Gest. Sinistres", email: "s.abiodun@courteva.cm", statut: "Actif", login: "Aujourd'hui 07:55" },
    { nom: "Théodore Nguema", role: "Comptable", email: "t.nguema@courteva.cm", statut: "Inactif", login: "Il y a 3 jours" },
    { nom: "Cécile Koné", role: "Commercial", email: "c.kone@courteva.cm", statut: "Actif", login: "Aujourd'hui 10:02" },
  ];

  const roles = [
    { nom: "Administrateur", desc: "Accès complet système", n: 1 },
    { nom: "Direction", desc: "Lecture totale + approbations", n: 2 },
    { nom: "Gest. Production", desc: "Contrats, Devis, Clients", n: 4 },
    { nom: "Gest. Sinistres", desc: "Sinistres, Expertises, Recours", n: 3 },
    { nom: "Comptable", desc: "Comptabilité, Trésorerie", n: 2 },
    { nom: "Commercial", desc: "CRM, Prospects, Devis", n: 6 },
  ];

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Administration Système" subtitle="Utilisateurs, rôles, permissions et paramètres plateforme" icon={Settings}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvel utilisateur</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Utilisateurs ({users.length})</h3>
            <Btn variant="ghost"><Filter className="w-4 h-4" />Filtrer</Btn>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Utilisateur", "Rôle", "Dernière connexion", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {u.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{u.nom}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.role}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.login}</td>
                  <td className="px-4 py-3"><Badge variant={u.statut === "Actif" ? "success" : "neutral"}>{u.statut}</Badge></td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Rôles & Permissions</h3>
          </div>
          <div className="divide-y divide-border/50">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.nom}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{r.n}</p>
                  <p className="text-xs text-muted-foreground">users</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Placeholder ────────────────────────────────────────────────────────
function PlaceholderView({ title, icon: Icon, desc }: { title: string; icon: React.ElementType; desc: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: "60vh" }}>
      <div className="p-5 bg-primary/10 rounded-2xl border border-primary/20 mb-4">
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-5">{desc}</p>
      <Badge variant="info">Module disponible en production</Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// NAVIGATION DATA
// ═══════════════════════════════════════════════════════════════════════
const navGroups = [
  { label: "Accueil", items: [{ id: "dashboard", label: "Tableau de Bord", icon: LayoutDashboard }] },
  {
    label: "Commercial",
    items: [
      { id: "crm", label: "CRM & Prospection", icon: Target },
      { id: "clients", label: "Clients", icon: Users },
      { id: "compagnies", label: "Compagnies", icon: Building2 },
      { id: "devis", label: "Devis", icon: FileText },
      { id: "comparateur", label: "Comparateur IA", icon: ScanLine },
    ],
  },
  {
    label: "Production",
    items: [
      { id: "contrats", label: "Contrats", icon: FileText },
      { id: "renouvellements", label: "Renouvellements", icon: RefreshCw },
      { id: "avenants", label: "Avenants", icon: Edit },
      { id: "resiliations", label: "Résiliations", icon: XCircle },
    ],
  },
  {
    label: "Branches",
    items: [
      { id: "iard", label: "IARD", icon: Shield },
      { id: "sante", label: "Santé", icon: Stethoscope },
      { id: "vie", label: "Vie & Prévoyance", icon: Activity },
      { id: "flotte", label: "Flottes Auto", icon: Truck },
    ],
  },
  { label: "Sinistres", items: [{ id: "sinistres", label: "Gestion Sinistres", icon: AlertTriangle }] },
  {
    label: "Finance",
    items: [
      { id: "comptabilite", label: "Comptabilité", icon: BookOpen },
      { id: "commissions", label: "Commissions", icon: DollarSign },
      { id: "recouvrement", label: "Recouvrement", icon: CreditCard },
      { id: "tresorerie", label: "Trésorerie", icon: Wallet },
    ],
  },
  {
    label: "Outils",
    items: [
      { id: "ged", label: "GED & Documents", icon: Archive },
      { id: "ia", label: "Assistant IA", icon: Brain },
      { id: "rapports", label: "Reporting & KPIs", icon: BarChart3 },
    ],
  },
  { label: "Système", items: [{ id: "admin", label: "Administration", icon: Settings }] },
];

// ═══════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════
function Sidebar({
  current, onNavigate, collapsed, onToggle,
}: { current: View; onNavigate: (v: View) => void; collapsed: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((g) => [g.label, true])),
  );

  return (
    <div className={`flex flex-col bg-card border-r border-border transition-all duration-300 flex-shrink-0 ${collapsed ? "w-16" : "w-60"}`} style={{ height: "100vh" }}>
      {/* Brand */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border flex-shrink-0">
        {collapsed ? (
          <button onClick={onToggle} className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto hover:bg-primary/30 transition-colors">
            <Shield className="w-5 h-5 text-primary" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>CourtEVA+</p>
                <p className="text-xs text-muted-foreground leading-tight">Zone CIMA · ERP v2.0</p>
              </div>
            </div>
            <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => setOpen((p) => ({ ...p, [group.label]: !p[group.label] }))}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground transition-colors"
              >
                {group.label}
                {open[group.label] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {(collapsed || open[group.label]) && group.items.map((item) => {
              const active = current === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as View)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all mb-0.5 ${collapsed ? "justify-center p-2.5" : "px-2.5 py-2"} ${active ? "bg-primary/15 text-primary border border-primary/20 font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.id === "ia" && (
                    <span className="ml-auto text-xs bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded-full leading-none font-bold">AI</span>
                  )}
                  {!collapsed && item.id === "comparateur" && (
                    <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full leading-none font-bold">OCR</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-border px-3 py-3 flex-shrink-0">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">AB</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">Aristide Bengono</p>
                <p className="text-xs text-muted-foreground truncate">Administrateur · DG</p>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════
const viewLabels: Record<View, string> = {
  dashboard: "Tableau de Bord", crm: "CRM & Prospection", clients: "Gestion Clients",
  compagnies: "Compagnies", devis: "Devis", comparateur: "Comparateur IA",
  contrats: "Production — Contrats", renouvellements: "Renouvellements",
  avenants: "Avenants", resiliations: "Résiliations", sinistres: "Gestion Sinistres",
  sante: "Module Santé", iard: "IARD", vie: "Vie & Prévoyance",
  flotte: "Flottes Auto", comptabilite: "Comptabilité SYSCOHADA",
  commissions: "Commissions", recouvrement: "Recouvrement",
  tresorerie: "Trésorerie", ged: "GED & Documents",
  ia: "Assistant IA", rapports: "Reporting & KPIs", admin: "Administration",
};

function TopBar({ current }: { current: View }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground text-xs">CourtEVA+</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
        <span className="text-foreground font-semibold text-sm">{viewLabels[current]}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="pl-8 pr-4 py-2 bg-secondary/40 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors w-52"
            placeholder="Recherche globale…"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Exercice 2024</span>
        </div>
        <div className="border-l border-border pl-3">
          <Badge variant="gold">Zone CIMA</Badge>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "clients": return <ClientsView />;
      case "compagnies": return <CompagniesView />;
      case "contrats": return <ContratsView />;
      case "comparateur": return <ComparateurView />;
      case "sinistres": return <SinistresView />;
      case "sante": return <SanteView />;
      case "comptabilite": return <ComptabiliteView />;
      case "ia": return <IAView />;
      case "rapports": return <RapportsView />;
      case "admin": return <AdminView />;
      case "crm": return <PlaceholderView title="CRM & Prospection" icon={Target} desc="Pipeline commercial, scoring prospects, relances automatiques et suivi des opportunités en temps réel." />;
      case "devis": return <PlaceholderView title="Module Devis" icon={FileText} desc="Création de devis multi-compagnies, simulation tarifaire et envoi électronique sécurisé." />;
      case "renouvellements": return <PlaceholderView title="Renouvellements" icon={RefreshCw} desc="Gestion proactive des renouvellements avec alertes automatiques et suivi du taux de fidélisation." />;
      case "avenants": return <PlaceholderView title="Avenants" icon={Edit} desc="Modification des contrats en vigueur, traçabilité des avenants et génération automatique des documents." />;
      case "resiliations": return <PlaceholderView title="Résiliations" icon={XCircle} desc="Traitement des demandes de résiliation, calcul des ristournes et archivage CIMA." />;
      case "iard": return <PlaceholderView title="IARD — Incendie Accidents Risques Divers" icon={Shield} desc="Gestion des polices IARD: habitation, RC, multirisques entreprises, risques industriels et agricoles." />;
      case "vie": return <PlaceholderView title="Vie & Prévoyance" icon={Activity} desc="Contrats vie entière, épargne retraite, prévoyance collective et décès invalidité pour entreprises." />;
      case "flotte": return <PlaceholderView title="Flottes Automobiles" icon={Truck} desc="Gestion des flottes de véhicules, suivi individuel par immatriculation, sinistres et renouvellements groupés." />;
      case "commissions": return <PlaceholderView title="Commissions" icon={DollarSign} desc="Suivi des commissions par compagnie et commercial, rapprochement automatique et états de compte." />;
      case "recouvrement": return <PlaceholderView title="Recouvrement" icon={CreditCard} desc="Gestion des impayés, relances automatisées multi-canaux, échéanciers et intégration Mobile Money." />;
      case "tresorerie": return <PlaceholderView title="Trésorerie" icon={Wallet} desc="Suivi des flux, rapprochement bancaire automatique, prévisions et intégration API bancaires CIMA." />;
      case "ged": return <PlaceholderView title="GED & Documents" icon={Archive} desc="Gestion électronique des documents avec OCR, signature électronique qualifiée et archivage légal." />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'Outfit', sans-serif" }}>
      <Sidebar current={view} onNavigate={setView} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar current={view} />
        <main className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(201,162,74,0.15) transparent" }}>
          {renderView()}
        </main>
      </div>
    </div>
  );
}
