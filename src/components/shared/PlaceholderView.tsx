import { Badge } from "@/components/shared/Badge";

export function PlaceholderView({ title, icon: Icon, desc }: { title: string; icon: React.ElementType; desc: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: "60vh" }}>
      <div className="p-5 bg-primary/10 rounded-2xl border border-primary/20 mb-4">
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-5">{desc}</p>
      <Badge variant="info">Module disponible en production</Badge>
    </div>
  );
}
