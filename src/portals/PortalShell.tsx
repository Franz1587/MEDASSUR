import { useState } from "react";
import { useTheme } from "next-themes";
import { Shield, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { viewLabels, moduleIcons, type View } from "@/layout/navConfig";
import { viewRegistry } from "@/layout/viewRegistry";
import { Badge } from "@/components/shared/Badge";
import type { PortalMeta } from "@/portals/portalMeta";

export function PortalShell({ meta }: { meta: PortalMeta }) {
  const { currentUser, currentRole, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const modules = currentRole?.allowedModules ?? [];
  const [view, setView] = useState<View>(modules[0] ?? "dashboard");

  const ActiveView = viewRegistry[view] ?? viewRegistry.dashboard;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <meta.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{meta.label}</h1>
                <Badge variant="gold">CIS</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2.5 border-l border-border pl-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{currentUser?.initiales}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-foreground">{currentUser?.nom}</p>
                <p className="text-xs text-muted-foreground">{currentRole?.label}</p>
              </div>
              <button onClick={logout} title="Se déconnecter" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 pb-3 overflow-x-auto">
          {modules.map((m) => {
            const Icon = moduleIcons[m] ?? Shield;
            const active = view === m;
            return (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${active ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {viewLabels[m]}
              </button>
            );
          })}
        </div>
      </div>
      <main className="flex-1 overflow-auto">
        <ActiveView />
      </main>
    </div>
  );
}
