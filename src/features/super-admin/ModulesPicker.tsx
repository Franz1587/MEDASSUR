import { viewLabels } from "@/layout/navConfig";
import { GROUPES_MODULES } from "@/auth/moduleGroups";

// Grille de sélection de modules — réutilisée pour l'abonnement d'une
// société ET pour le catalogue de plans lui-même (2026-09, voir demande
// utilisateur : "il revient au super Admin de donner accès à ces modules
// là en fonction du type d'abonnement souscrit"). Même 8 zones que l'écran
// "Droits" interne (voir src/features/admin/index.tsx), pour que le Super
// Admin voie exactement ce qu'un administrateur de société pourra ensuite
// accorder à ses propres utilisateurs.
export function ModulesPicker({ selection, onToggle, onSelectAll, onSelectNone }: {
  selection: Set<string>;
  onToggle: (v: string) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
}) {
  return (
    <div className="space-y-3">
      {GROUPES_MODULES.map((g) => (
        <div key={g.label}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g.label}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {g.views.map((v) => (
              <label key={v} className="flex items-center gap-2 py-0.5">
                <input type="checkbox" checked={selection.has(v)} onChange={() => onToggle(v)} className="rounded border-border" />
                <span className="text-[12.5px] text-foreground">{viewLabels[v]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        {onSelectAll && <button type="button" onClick={onSelectAll} className="text-[12px] text-muted-foreground hover:text-foreground">Tout cocher</button>}
        {onSelectNone && <button type="button" onClick={onSelectNone} className="text-[12px] text-muted-foreground hover:text-foreground">Tout décocher</button>}
      </div>
    </div>
  );
}
