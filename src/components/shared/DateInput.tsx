import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, getDaysInMonth, isSameDay, isValid, parse, startOfMonth } from "date-fns";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

function parseFr(value: string): Date | null {
  if (!value) return null;
  const d = parse(value, "dd/MM/yyyy", new Date());
  return isValid(d) ? d : null;
}

// Insère automatiquement les "/" au fil de la saisie (JJ/MM/AAAA) — l'utilisateur
// tape juste les chiffres, la ponctuation se rajoute seule.
function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = "";
  if (digits.length > 0) out += digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}

// Champ date JJ/MM/AAAA avec double saisie : frappe au clavier (les "/"
// s'insèrent automatiquement) ou calendrier déroulant avec sélecteurs
// mois/année pour naviguer instantanément sur plusieurs décennies en arrière
// (utile pour les dates de naissance) sans cliquer mois par mois.
export function DateInput({ value, onChange, placeholder = "JJ/MM/AAAA", className }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => parseFr(value) ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = parseFr(value);
    if (parsed) setViewMonth(parsed);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = parseFr(value);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 6 }, (_, i) => currentYear + 5 - i);

  const firstOfMonth = startOfMonth(viewMonth);
  const daysInMonth = getDaysInMonth(viewMonth);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // lundi = 0

  const days: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pick = (day: number) => {
    onChange(format(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day), "dd/MM/yyyy"));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(formatDigits(e.target.value))}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          inputMode="numeric"
          className={`${className ?? ""} pr-8`}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={viewMonth.getMonth()}
              onChange={(e) => setViewMonth((m) => new Date(m.getFullYear(), Number(e.target.value), 1))}
              className="flex-1 h-7 border border-border rounded px-1 bg-background text-[11.5px] text-foreground min-w-0"
            >
              {MOIS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              value={viewMonth.getFullYear()}
              onChange={(e) => setViewMonth((m) => new Date(Number(e.target.value), m.getMonth(), 1))}
              className="h-7 border border-border rounded px-1 bg-background text-[11.5px] text-foreground"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {JOURS.map((d, i) => <div key={i} className="text-[10px] text-muted-foreground font-semibold py-1">{d}</div>)}
            {days.map((day, i) => {
              const isSelected = day !== null && selected !== null && isSameDay(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day), selected);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={day === null}
                  onClick={() => day && pick(day)}
                  className={`h-7 w-7 text-[11px] rounded flex items-center justify-center ${day === null ? "invisible" : isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-secondary text-foreground"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => { onChange(format(new Date(), "dd/MM/yyyy")); setOpen(false); }} className="w-full mt-2 text-[11px] text-primary hover:underline">
            Aujourd'hui
          </button>
        </div>
      )}
    </div>
  );
}
