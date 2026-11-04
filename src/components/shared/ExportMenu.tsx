import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType, Sheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type FormatExport = "xlsx" | "csv" | "pdf" | "docx";
export interface ContenuExport { id: string; label: string; description?: string }

const FORMATS: { id: FormatExport; label: string; icon: typeof FileText }[] = [
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "csv", label: "CSV", icon: Sheet },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "docx", label: "Word", icon: FileType },
];

// Bouton « Exporter » : choix du contenu puis du format, téléchargement côté serveur.
export function ExportMenu({ contenus, onExporter, label = "Exporter", aide, versLeHaut, aGauche, children }: {
  contenus: ContenuExport[];
  onExporter: (contenu: string, format: FormatExport) => Promise<void>;
  label?: string;
  aide?: string;
  versLeHaut?: boolean; // bouton en pied de fenêtre : le menu s'ouvre au-dessus
  aGauche?: boolean; // bouton à gauche : le menu s'aligne sur son bord gauche
  children?: React.ReactNode; // champs supplémentaires (filtres propres à l'export)
}) {
  const [ouvert, setOuvert] = useState(false);
  const [contenu, setContenu] = useState(contenus[0]?.id ?? "");
  const [format, setFormat] = useState<FormatExport>("xlsx");
  const [encours, setEncours] = useState(false);
  const [hauteurMax, setHauteurMax] = useState<number>();
  const ref = useRef<HTMLDivElement>(null);

  // Hauteur disponible entre le bouton et le bord de la fenêtre : le menu défile au-delà.
  const ouvrir = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setHauteurMax(Math.max(240, (versLeHaut ? r.top : window.innerHeight - r.bottom) - 16));
    setOuvert((v) => !v);
  };

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", clic); document.removeEventListener("keydown", echap); };
  }, [ouvert]);

  const telecharger = async () => {
    setEncours(true);
    try {
      await onExporter(contenu, format);
      setOuvert(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setEncours(false);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={ouvrir} aria-expanded={ouvert} aria-haspopup="dialog"
        className="h-9 px-3 rounded-lg border border-border bg-card text-[13px] font-medium text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Download className="w-4 h-4" aria-hidden />{label}
      </button>
      {ouvert && (
        <div role="dialog" aria-label={label}
          className={`absolute ${aGauche ? "left-0" : "right-0"} z-40 ${versLeHaut ? "bottom-full mb-1.5" : "mt-1.5"} w-[min(92vw,340px)] overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-4 space-y-3.5`}
          style={{ maxHeight: hauteurMax }}>
          {children}
          {contenus.length > 1 && (
            <fieldset>
              <legend className="text-[12px] font-semibold text-muted-foreground mb-1.5">Contenu</legend>
              <div className="space-y-1.5">
                {contenus.map((c) => (
                  <label key={c.id} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${contenu === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                    <input type="radio" name="contenu-export" checked={contenu === c.id} onChange={() => setContenu(c.id)} className="mt-0.5 accent-primary" />
                    <span>
                      <span className="block text-[13px] font-medium text-foreground">{c.label}</span>
                      {c.description && <span className="block text-[11.5px] text-muted-foreground">{c.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="text-[12px] font-semibold text-muted-foreground mb-1.5">Format</legend>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)}
                  className={`h-14 rounded-lg border flex flex-col items-center justify-center gap-1 text-[12px] ${format === f.id ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-foreground hover:bg-secondary/40"}`}>
                  <f.icon className="w-4 h-4" aria-hidden />{f.label}
                </button>
              ))}
            </div>
          </fieldset>
          {aide && <p className="text-[11.5px] text-muted-foreground">{aide}</p>}
          <button type="button" onClick={telecharger} disabled={encours || !contenu}
            className="sticky bottom-0 shadow-[0_-8px_12px_-4px_var(--card)] w-full h-9 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-60">
            {encours ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
            {encours ? "Préparation…" : "Télécharger"}
          </button>
        </div>
      )}
    </div>
  );
}
