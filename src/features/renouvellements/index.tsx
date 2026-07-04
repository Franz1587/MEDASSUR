import { useEffect, useState } from "react";
import { RefreshCw, Send, Mail } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { getRenouvellements } from "@/services/renouvellements.service";
import type { Renouvellement } from "@/types/renouvellements";

const statutVariant: Record<string, "warning" | "info" | "success" | "danger"> = {
  "À renouveler": "warning",
  "Relancé": "info",
  "Renouvelé": "success",
  "Perdu": "danger",
};

export default function RenouvellementsView() {
  const [items, setItems] = useState<Renouvellement[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const statuts = ["Tous", "À renouveler", "Relancé", "Renouvelé", "Perdu"];

  useEffect(() => {
    getRenouvellements().then(setItems);
  }, []);

  const filtered = statusFilter === "Tous" ? items : items.filter((i) => i.statut === statusFilter);
  const aRenouveler = items.filter((i) => i.statut === "À renouveler").length;
  const tauxRenouvellement = items.length
    ? Math.round((items.filter((i) => i.statut === "Renouvelé").length / items.length) * 100)
    : 0;

  return (
    <div className="p-6">
      <ModuleHeader title="Renouvellements" subtitle="Suivi proactif des échéances et de la fidélisation portefeuille" icon={RefreshCw}
        actions={<Btn variant="primary"><Send className="w-4 h-4" />Lancer les relances</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="À renouveler" value={String(aRenouveler)} subtitle="Sous 30 jours" icon={RefreshCw} accent="bg-amber-500/10" />
        <StatCard title="Taux de renouvellement" value={`${tauxRenouvellement}%`} subtitle="Portefeuille 2024" icon={RefreshCw} trend={{ label: "+2.3%", up: true }} />
        <StatCard title="Prime à renégocier" value={fmtM(items.reduce((a, b) => a + (b.statut === "À renouveler" ? b.primeProposee : 0), 0))} subtitle="XAF cumulés" icon={RefreshCw} />
        <StatCard title="Relances envoyées" value={String(items.filter((i) => i.statut === "Relancé").length)} subtitle="Ce mois" icon={Mail} />
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {statuts.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Client", "Branche", "Compagnie", "Échéance", "Jours", "Prime actuelle", "Prime proposée", "Sinistralité", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{r.client}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.branche}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.dateFin}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-xs font-semibold ${r.joursRestants < 0 ? "text-red-400" : r.joursRestants <= 15 ? "text-amber-400" : "text-muted-foreground"}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                    {r.joursRestants < 0 ? "Échu" : `${r.joursRestants} j`}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.primeActuelle)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.primeProposee)}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.sinistralite}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
