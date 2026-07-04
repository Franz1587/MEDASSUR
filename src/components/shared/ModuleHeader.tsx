export function ModuleHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: string; subtitle?: string; icon: React.ElementType; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
