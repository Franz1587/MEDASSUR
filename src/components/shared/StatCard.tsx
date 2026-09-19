import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface StatCardBreakdownItem {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "danger" | "warning";
}

const TONE_CLS: Record<NonNullable<StatCardBreakdownItem["tone"]>, string> = {
  neutral: "bg-secondary/60 text-foreground",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  danger: "bg-red-500/12 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
};

export function StatCard({
  title, value, subtitle, icon: Icon, trend, accent, onClick, breakdown,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; trend?: { label: string; up: boolean }; accent?: string;
  // Accès rapide (2026-08) — voir demande utilisateur : "les boutons
  // contrats et participant du dashboard doivent être des boutons d'accès
  // rapide". Optionnel : sans onClick, la carte reste purement informative
  // (comportement historique, cursor-default), comme partout ailleurs dans
  // l'application.
  onClick?: () => void;
  // Répartition compacte (2026-09) — voir demande utilisateur : "faire un
  // rendu de... total ou enregistré, actif, inactif" — des chiffres à part,
  // lisibles d'un coup d'œil, plutôt qu'une phrase dense dans le sous-titre.
  breakdown?: StatCardBreakdownItem[];
}) {
  const cls = `w-full text-left bg-card/90 border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-[0_14px_30px_rgba(17,66,102,0.12)] transition-all group ${onClick ? "cursor-pointer" : "cursor-default"}`;
  const contenu = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${accent || "bg-primary/12"}`}>
          <Icon className={`w-5 h-5 ${accent ? "text-white" : "text-primary"}`} />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trend.up ? "text-emerald-600" : "text-red-500"}`}>
            {trend.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/60 mt-0.5">{subtitle}</p>}
      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {breakdown.map((b) => (
            <span key={b.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLS[b.tone ?? "neutral"]}`}>
              <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{b.value}</span>{b.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>{contenu}</button>
  ) : (
    <div className={cls}>{contenu}</div>
  );
}
