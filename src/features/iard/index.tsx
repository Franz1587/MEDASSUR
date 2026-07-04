import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getPolicesIard, getIardRepartition } from "@/services/iard.service";
import type { PoliceIard, IardRepartition } from "@/types/iard";

export default function IardView() {
  const [polices, setPolices] = useState<PoliceIard[]>([]);
  const [repartition, setRepartition] = useState<IardRepartition[]>([]);
  const [sousBranche, setSousBranche] = useState("Toutes");

  useEffect(() => {
    getPolicesIard().then(setPolices);
    getIardRepartition().then(setRepartition);
  }, []);

  const sousBranches = useMemo(() => ["Toutes", ...Array.from(new Set(polices.map((p) => p.sousBranche)))], [polices]);
  const filtered = sousBranche === "Toutes" ? polices : polices.filter((p) => p.sousBranche === sousBranche);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="IARD — Incendie Accidents Risques Divers" subtitle="Habitation, professionnelle, transport, construction, RC et risques spéciaux" icon={Shield} />

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">Primes par sous-branche</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={repartition} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="branche" tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
            <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} XAF`]} />
            <Bar dataKey="value" fill="#0E7490" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sousBranches.map((s) => (
          <button key={s} onClick={() => setSousBranche(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${sousBranche === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Client", "Sous-branche", "Compagnie", "Capital assuré", "Prime", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{p.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.client}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{p.sousBranche}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.compagnie}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.capitalAssure)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.prime)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={p.statut === "Actif" ? "success" : "warning"}>{p.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
