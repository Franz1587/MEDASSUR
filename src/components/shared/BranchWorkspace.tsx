import { useState } from "react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

export interface BranchWorkspaceSection {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
}

/**
 * Generic shell for turning a business branch (Santé, and later IARD/Vie/
 * Flotte) into one autonomous workspace: a single sidebar entry point that
 * opens an internal section-tab bar, instead of scattering the branch's
 * sub-domains across separate top-level nav items.
 */
export function BranchWorkspace({
  title, subtitle, icon, sections, actions,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  sections: BranchWorkspaceSection[];
  actions?: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  const ActiveComponent = active?.component;

  return (
    <div className="p-6">
      <ModuleHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
      <div className="flex gap-2 mb-5 flex-wrap">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
              active?.id === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
