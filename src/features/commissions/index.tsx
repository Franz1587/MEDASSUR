import { useEffect, useState } from "react";
import { DollarSign, Search } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { getCommissions, reverserCommission } from "@/services/commissions.service";
import type { Commission } from "@/types/commissions";

const fieldCls = "border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const statutVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Reversé": "success",
  "En attente": "warning",
};

// Commissions (2026-08, refonte) — voir demande utilisateur : "c'est le
// courtier qui est le bénéficiaire des commissions et elles sont calculées
// sur la base des taux commissions paramétrés pour chaque branche... et
// calculé sur la base des primes nettes générées par contrat". Les montants
// ne sont plus saisis à la main : cet écran recalcule les commissions
// directement à partir des contrats (même source que le Bordereau de
// Production — voir CommissionsService), la seule action manuelle restante
// est de confirmer qu'une compagnie a bien reversé sa commission au
// courtier pour le mois recherché.
export default function CommissionsView() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [commissions, setCommissions] = useState<Commission[] | null>(null);
  const [recherchant, setRecherchant] = useState(false);

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setCommissions(await getCommissions(du || undefined, au || undefined));
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => { handleRechercher(); }, []);

  const handleReverser = async (c: Commission) => {
    if (!c.periodeMensuelle) {
      toast.error("Filtrez sur un seul mois (Du/Au dans le même mois) pour pouvoir marquer un reversement.");
      return;
    }
    try {
      await reverserCommission(c.compagnieId, c.periodeMensuelle);
      toast.success(`Commission ${c.compagnie} marquée comme reversée.`);
      handleRechercher();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const liste = commissions ?? [];
  const totalCommission = liste.reduce((a, b) => a + b.montantCommission, 0);
  const chartData = liste.map((c) => ({ compagnie: c.compagnie.split(" ")[0], commission: c.montantCommission }));

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Commissions" subtitle="Commissions du courtier, calculées sur les primes nettes générées par contrat — par compagnie" icon={DollarSign} />

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <div className={labelCls}>Du</div>
            <DateInput value={du} onChange={setDu} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Au</div>
            <DateInput value={au} onChange={setAu} className={fieldCls} />
          </label>
          <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}><Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}</Btn>
          <p className="text-[11px] text-muted-foreground max-w-xs">Filtrez sur un seul mois pour pouvoir marquer un reversement (ex. 01/10/2024 au 31/10/2024).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Commissions totales</p>
          <p className="text-2xl font-bold text-foreground med-num">{fmtM(totalCommission)} FCFA</p>
        </div>
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Commissions par compagnie</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="compagnie" tick={{ fill: "#6E8BAD", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} FCFA`]} />
              <Bar dataKey="commission" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Compagnie", "Période", "Primes Nettes", "Taux", "Commission", "Statut", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commissions === null ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            ) : liste.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucune commission pour ces critères.</td></tr>
            ) : liste.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs text-primary font-semibold whitespace-nowrap med-num">{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.periode}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap med-num">{fmtM(c.primeNette)}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap med-num">{c.tauxCommission}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap med-num">{fmtM(c.montantCommission)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[c.statut] ?? "neutral"}>{c.statut}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.statut !== "Reversé" && (
                    <button type="button" onClick={() => handleReverser(c)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Marquer reversé</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
