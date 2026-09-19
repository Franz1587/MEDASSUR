import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface ComboboxProps<T> {
  options: T[];
  value: T | null;
  onChange: (item: T | null) => void;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  getId?: (item: T) => string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  // Filtre optionnel ("Tous les X") en tête de liste — pour les listes de
  // sélection de recherche qui restent facultatives (ex. filtre
  // Prestataire/Compagnie d'un écran de recherche), par opposition à un
  // choix obligatoire (ex. assuré d'une ligne de facture).
  allowClear?: boolean;
  clearLabel?: string;
}

// Recherche à la frappe générique — filtre une liste préchargée par
// sous-chaîne insensible à la casse sur label+sous-label (ex. nom+ville
// d'un prestataire, nom+matricule d'un assuré). Cohérent avec le reste de
// l'app (tout est préchargé puis filtré côté client), voir le plan
// "Refonte de la saisie des Factures".
export function Combobox<T>({ options, value, onChange, getLabel, getSubLabel, getId, placeholder = "Rechercher…", className = "", disabled = false, allowClear = false, clearLabel = "Tous" }: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const normalise = (s: string) => s.trim().toLowerCase();
  const filtres = useMemo(() => {
    const q = normalise(query);
    if (!q) return options;
    return options.filter((o) => normalise(getLabel(o)).includes(q) || (getSubLabel && normalise(getSubLabel(o)).includes(q)));
  }, [options, query]);

  useEffect(() => { setHighlight(0); }, [query, open]);

  const selectionner = (item: T) => {
    onChange(item);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); setQuery(""); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtres.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtres[highlight]) selectionner(filtres[highlight]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  const valeurAffichee = open ? query : value ? getLabel(value) : allowClear ? clearLabel : "";

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={valeurAffichee}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className={`w-full border border-border rounded-lg pl-8 pr-8 py-2 bg-background text-[13px] text-foreground disabled:opacity-60 ${className}`}
        />
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-card border border-border rounded-lg shadow-xl">
          {allowClear && (
            <div
              onMouseDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); setQuery(""); }}
              className={`px-3 py-2 cursor-pointer text-[13px] border-b border-border/50 hover:bg-secondary/40 ${!value ? "text-primary font-medium" : "text-muted-foreground"}`}
            >
              {clearLabel}
            </div>
          )}
          {filtres.length === 0 && <div className="px-3 py-2 text-[12px] text-muted-foreground">Aucun résultat</div>}
          {filtres.map((item, i) => (
            <div
              key={getId ? getId(item) : getLabel(item) + i}
              onMouseDown={(e) => { e.preventDefault(); selectionner(item); }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 cursor-pointer text-[13px] ${i === highlight ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-secondary/40"}`}
            >
              <div className="font-medium">{getLabel(item)}</div>
              {getSubLabel && <div className="text-[11px] text-muted-foreground">{getSubLabel(item)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
