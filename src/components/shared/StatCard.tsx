import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({
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
