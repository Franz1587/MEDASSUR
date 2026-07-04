import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronRight, Search, Bell, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { viewLabels, type View } from "@/layout/navConfig";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function TopBar({ current }: { current: View }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground text-xs">CourtEVA+</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
        <span className="text-foreground font-semibold text-sm">{viewLabels[current]}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="pl-8 pr-4 py-2 bg-secondary/40 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors w-52"
            placeholder="Recherche globale…"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <ThemeToggle />
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-l border-border pl-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Exercice 2024</span>
        </div>
        <div className="border-l border-border pl-3">
          <Badge variant="gold">Zone CIMA</Badge>
        </div>
      </div>
    </div>
  );
}
