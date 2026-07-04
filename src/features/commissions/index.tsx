import { useEffect, useState } from "react";
import { DollarSign, Filter, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getCommissions } from "@/services/commissions.service";
import type { Commission } from "@/types/commissions";

const statutVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Reversé": "success",
  "À reverser": "warning",
  "En attente": "neutral",
};

export default function CommissionsView() {
  const [commissions, setCommissions] = useState<Commission[]>([]);

  useEffect(() => {
    getCommissions().then(setCommissions);
  }, []);

  const totalCommission = commissions.reduce((a, b) => a + b.montantCommission, 0);
  const chartData = commissions.map((c) => ({ compagnie: c.compagnie.split(" ")[0], commission: c.montantCommission }));

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Commissions" subtitle="Suivi des commissions par compagnie et rapprochement des reversements" icon={DollarSign}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Octobre 2024</Btn>
            <Btn variant="primary"><Download className="w-4 h-4" />Export</Btn>
          </>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Commissions totales — Octobre</p>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalCommission)} XAF</p>
        </div>
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Commissions par compagnie</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="compagnie" tick={{ fill: "#6E8BAD", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} XAF`]} />
              <Bar dataKey="commission" fill="#C9A24A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Compagnie", "Période", "Prime encaissée", "Taux", "Commission", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs text-primary font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.periode}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.primeEncaissee)}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.tauxCommission}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.montantCommission)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[c.statut] ?? "neutral"}>{c.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
