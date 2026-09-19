import { Badge } from "@/components/shared/Badge";

export function PlaceholderView({ title, icon: Icon, desc }: { title: string; icon: React.ElementType; desc: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center animate-fade-slide" style={{ minHeight: "60vh" }}>
      <div className="p-5 med-empty-icon mb-4">
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-5">{desc}</p>
      <div className="med-empty-state px-4 py-2.5">
        <Badge variant="info">Module disponible en production</Badge>
      </div>
    </div>
  );
}
