import { useState } from "react";
import { ChevronLeft, ChevronUp, ChevronDown, Shield, LogOut } from "lucide-react";
import { navGroups, type View } from "@/layout/navConfig";
import { useAuth } from "@/auth/AuthContext";

export function Sidebar({
  current, onNavigate, collapsed, onToggle,
}: { current: View; onNavigate: (v: View) => void; collapsed: boolean; onToggle: () => void }) {
  const { currentUser, currentRole, logout } = useAuth();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((g) => [g.label, true])),
  );

  const allowed = new Set(currentRole?.allowedModules ?? []);
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.id)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={`flex flex-col bg-card border-r border-border transition-all duration-300 flex-shrink-0 ${collapsed ? "w-16" : "w-60"}`} style={{ height: "100vh" }}>
      {/* Brand */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border flex-shrink-0">
        {collapsed ? (
          <button onClick={onToggle} className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto hover:bg-primary/30 transition-colors">
            <Shield className="w-5 h-5 text-primary" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>CIS</p>
                <p className="text-xs text-muted-foreground leading-tight">Zone CIMA · ERP v2.0</p>
              </div>
            </div>
            <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => setOpen((p) => ({ ...p, [group.label]: !p[group.label] }))}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground transition-colors"
              >
                {group.label}
                {open[group.label] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {(collapsed || open[group.label]) && group.items.map((item) => {
              const active = current === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-all mb-0.5 ${collapsed ? "justify-center p-2.5" : "px-2.5 py-2"} ${active ? "bg-primary/15 text-primary border border-primary/20 font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.id === "ia" && (
                    <span className="ml-auto text-xs bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded-full leading-none font-bold">AI</span>
                  )}
                  {!collapsed && item.id === "comparateur" && (
                    <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full leading-none font-bold">OCR</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="border-t border-border px-3 py-3 flex-shrink-0">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">{currentUser?.initiales ?? "—"}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{currentUser?.nom ?? "Invité"}</p>
                <p className="text-xs text-muted-foreground truncate">{currentRole?.label ?? ""}</p>
              </div>
              <button onClick={logout} title="Changer de profil" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
