import { useEffect, useMemo, useState } from "react";
import { Users, FileText, ClipboardList } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { StatCard } from "@/components/shared/StatCard";
import { useAuth } from "@/auth/AuthContext";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  getPortailDashboard, getPriseEnChargeParRubriqueDuClient,
  type PortailDashboard, type PriseEnChargeParRubriquePayload,
} from "@/services/portailClient.service";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Tableau de bord du portail client (2026-08) — voir demande utilisateur :
// "un écran qui leur permettra de suivre la gestion de leur contrat
// maladie". Chiffres cloisonnés au client connecté (voir
// PortailClientController côté backend, jamais recalculés côté frontend).
// Compteur de prises en charge par rubrique (par an / par mois) ajouté sur
// demande — les cartes Contrats/Participants sont des accès rapides vers
// leurs rubriques respectives.
export default function PortailDashboardView() {
  const { currentUser } = useAuth();
  const { setView } = useShellNavigation();
  const [data, setData] = useState<PortailDashboard | null>(null);
  const [pec, setPec] = useState<PriseEnChargeParRubriquePayload | null>(null);
  const [vue, setVue] = useState<"annee" | "mois">("annee");
  const [annee, setAnnee] = useState<number | null>(null);

  useEffect(() => {
    getPortailDashboard().then(setData);
    getPriseEnChargeParRubriqueDuClient().then((p) => {
      setPec(p);
      setAnnee((a) => a ?? p.annees[0] ?? null);
    });
  }, []);

  const rubriquesActives = useMemo(() => {
    if (!pec || annee === null) return [];
    const parAnnee = pec.parAnnee[annee] ?? [];
    return parAnnee.map((r) => r.rubrique);
  }, [pec, annee]);

  const totalAnnee = useMemo(() => {
    if (!pec || annee === null) return 0;
    return (pec.parAnnee[annee] ?? []).reduce((s, r) => s + r.nombre, 0);
  }, [pec, annee]);

  const colorDe = (rubrique: string) => PALETTE[rubriquesActives.indexOf(rubrique) % PALETTE.length];

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.35rem] font-bold text-foreground">Tableau de bord</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {currentUser ? `Bienvenue, ${currentUser.nom}` : "Vue d'ensemble de votre contrat"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mb-6">
        <StatCard title="Contrats" value={data ? String(data.nombreContrats) : "…"} icon={FileText} onClick={() => setView("portailContrats")} />
        <StatCard title="Participants" value={data ? String(data.nombreParticipants) : "…"} icon={Users} onClick={() => setView("portailParticipants")} />
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Prises en charge par rubrique
        </h2>
        <div className="flex items-center gap-2">
          {pec && pec.annees.length > 0 && (
            <select
              value={annee ?? ""}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
            >
              {pec.annees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-secondary/30">
            {(["annee", "mois"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${vue === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "annee" ? "Par an" : "Par mois"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!pec || annee === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : pec.annees.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucune prise en charge enregistrée.</div>
      ) : vue === "annee" ? (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-[12px] text-muted-foreground mb-4">{totalAnnee} dossier(s) en {annee}</p>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
            <div style={{ height: Math.max(220, (pec.parAnnee[annee]?.length ?? 0) * 42) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pec.parAnnee[annee]} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="rubrique" width={170} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="nombre" name="Prises en charge" radius={[0, 4, 4, 0]}>
                    {(pec.parAnnee[annee] ?? []).map((r) => <Cell key={r.rubrique} fill={colorDe(r.rubrique)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {(pec.parAnnee[annee] ?? []).map((r) => (
                <div key={r.rubrique} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/25">
                  <span className="flex items-center gap-2 text-[12.5px] text-foreground min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorDe(r.rubrique) }} />
                    <span className="truncate">{r.rubrique}</span>
                  </span>
                  <span className="text-[13px] font-bold text-foreground flex-shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pec.parMois[annee]} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {rubriquesActives.map((r) => (
                  <Bar key={r} dataKey={r} name={r} stackId="mois" fill={colorDe(r)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
