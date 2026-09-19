import { BackButton } from "@/components/shared/BackButton";

export function ModuleHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: string; subtitle?: string; icon: React.ElementType; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5 rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-[0_10px_24px_rgba(17,66,102,0.08)]">
      <div className="flex items-center gap-3 min-w-0">
        <BackButton className="w-9 h-9 flex-shrink-0 bg-card/85" />
        <div className="p-2.5 bg-primary/12 rounded-xl border border-primary/25 flex-shrink-0 shadow-[0_8px_18px_rgba(13,115,191,0.18)]">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-bold text-foreground leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
