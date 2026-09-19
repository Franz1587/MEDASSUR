import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

// Éditeur façon Word (2026-08, voir demande utilisateur : "un interface
// comme Microsoft Word pour la gestion des courrier Maladie") — contentEditable
// + document.execCommand, volontairement sans dépendance npm dédiée (budget
// de cette session). Produit un sous-ensemble HTML délibérément limité
// (<p>, <b>/<strong>, <i>/<em>, <u>, <ul>/<ol>/<li>, alignement) — voir
// DocumentsService.dessinerCorpsCourrier côté backend, qui ne sait
// convertir QUE ce sous-ensemble en PDF.
const boutons: { icon: React.ElementType; cmd: string; value?: string; titre: string }[] = [
  { icon: Bold, cmd: "bold", titre: "Gras" },
  { icon: Italic, cmd: "italic", titre: "Italique" },
  { icon: Underline, cmd: "underline", titre: "Souligné" },
  { icon: AlignLeft, cmd: "justifyLeft", titre: "Aligner à gauche" },
  { icon: AlignCenter, cmd: "justifyCenter", titre: "Centrer" },
  { icon: AlignRight, cmd: "justifyRight", titre: "Aligner à droite" },
  { icon: AlignJustify, cmd: "justifyFull", titre: "Justifier" },
  { icon: List, cmd: "insertUnorderedList", titre: "Liste à puces" },
  { icon: ListOrdered, cmd: "insertOrderedList", titre: "Liste numérotée" },
];

export function RichTextEditor({ value, onChange, placeholder, className = "" }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initialise = useRef(false);

  useEffect(() => {
    if (!initialise.current) {
      try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* navigateur trop ancien — sans effet */ }
      initialise.current = true;
    }
  }, []);

  // Synchronise seulement quand `value` change EXTERNEMENT (chargement d'un
  // modèle, ouverture d'un courrier existant) — jamais à chaque frappe,
  // pour ne pas faire sauter le curseur pendant la saisie.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "<p><br></p>";
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className={`border border-border rounded-lg overflow-hidden bg-background ${className}`}>
      <div className="flex items-center gap-1 border-b border-border bg-secondary/40 px-2 py-1.5">
        {boutons.map((b) => (
          <button
            key={b.cmd}
            type="button"
            title={b.titre}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.cmd, b.value)}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary inline-flex items-center justify-center"
          >
            <b.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        data-placeholder={placeholder}
        className="min-h-[280px] max-h-[55vh] overflow-y-auto px-4 py-3 text-[13.5px] text-foreground leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}
