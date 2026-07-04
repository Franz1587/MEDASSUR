export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
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
