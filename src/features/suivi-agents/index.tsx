import { useEffect, useState } from "react";
import { Gauge, Search } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { DateInput } from "@/components/shared/DateInput";
import { getStatsAgents } from "@/services/audit.service";
import type { StatAgent } from "@/types/audit";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function SuiviAgentsView() {
  const [stats, setStats] = useState<StatAgent[]>([]);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherchant, setRecherchant] = useState(false);

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setStats(await getStatsAgents({ du: du || undefined, au: au || undefined }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => { handleRechercher(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxTotal = Math.max(1, ...stats.map((s) => s.total));

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Suivi de production par agent"
        subtitle="Capacité de traitement de chaque agent de saisie — nombre de factures et de règlements établis (comptabilisés à leur création, jamais aux modifications ultérieures)."
        icon={Gauge}
      />

      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Période</h3>
        </div>
        <div className="p-4 flex flex-wrap items-end gap-3">
          <label className="block w-40"><div className={labelCls}>Du</div><DateInput value={du} onChange={setDu} className={fieldCls} /></label>
          <label className="block w-40"><div className={labelCls}>Au</div><DateInput value={au} onChange={setAu} className={fieldCls} /></label>
          <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}>
            <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
          </Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Agent", "Factures établies", "Règlements établis", "Total", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.utilisateur} className="border-b border-border/50">
                <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{s.nom}</td>
                <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.factures}</td>
                <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.reglements}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.total}</td>
                <td className="px-4 py-2.5 w-40">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(s.total / maxTotal) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucune facture ou règlement établi sur cette période.</div>}
      </div>
    </div>
  );
}
