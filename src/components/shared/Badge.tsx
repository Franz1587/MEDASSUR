export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const s: Record<BadgeVariant, string> = {
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    danger: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    info: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    neutral: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    gold: "bg-teal-500/16 text-teal-700 dark:text-teal-300 border-teal-500/35",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${s[variant]}`}>
      {children}
    </span>
  );
}
