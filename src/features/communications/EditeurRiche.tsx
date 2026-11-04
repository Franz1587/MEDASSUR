import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, IndentDecrease, IndentIncrease,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link2, Undo2, Redo2, RemoveFormatting, Highlighter, Baseline, Minus,
} from "lucide-react";

// Éditeur de texte riche natif (contentEditable + execCommand) : suffisant pour
// un corps d'email, sans dépendance. Les raccourcis Ctrl+B/I/U fonctionnent nativement.
const POLICES = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const TAILLES: { label: string; valeur: string }[] = [
  { label: "8", valeur: "1" }, { label: "10", valeur: "2" }, { label: "12", valeur: "3" },
  { label: "14", valeur: "4" }, { label: "18", valeur: "5" }, { label: "24", valeur: "6" }, { label: "36", valeur: "7" },
];

interface Props {
  initialHtml: string;
  onChange: (html: string, texte: string) => void;
  minHeight?: number;
  ariaLabel?: string;
}

export function EditeurRiche({ initialHtml, onChange, minHeight = 260, ariaLabel = "Corps du message" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Contenu initial posé une seule fois : l'éditeur reste non contrôlé pour garder le curseur.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml;
      onChange(ref.current.innerHTML, ref.current.innerText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sélection mémorisée : les sélecteurs (couleur, police) prennent le focus et la feraient perdre.
  const selection = useRef<Range | null>(null);
  const memoriser = () => {
    const s = window.getSelection();
    if (s?.rangeCount && ref.current?.contains(s.anchorNode)) selection.current = s.getRangeAt(0).cloneRange();
  };
  const emettre = () => { if (ref.current) onChange(ref.current.innerHTML, ref.current.innerText); };
  const cmd = (commande: string, valeur?: string) => {
    ref.current?.focus();
    if (selection.current) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(selection.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(commande, false, valeur);
    memoriser();
    emettre();
  };
  const lien = () => {
    const url = window.prompt("Adresse du lien (https://…)");
    if (!url) return;
    if (!/^(https?:|mailto:|tel:)/i.test(url)) { cmd("createLink", `https://${url}`); return; }
    cmd("createLink", url);
  };

  const btn = "h-8 w-8 inline-flex items-center justify-center rounded-md text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const outil = (label: string, Icon: typeof Bold, action: () => void) => (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={action} className={btn}>
      <Icon className="w-4 h-4" aria-hidden />
    </button>
  );
  const sep = <span className="w-px h-5 bg-border mx-1" aria-hidden />;

  return (
    <div className="border border-border rounded-lg bg-background flex flex-col min-h-0">
      <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-border bg-secondary/20">
        {outil("Annuler (Ctrl+Z)", Undo2, () => cmd("undo"))}
        {outil("Rétablir (Ctrl+Y)", Redo2, () => cmd("redo"))}
        {sep}
        <select aria-label="Police" defaultValue="" onChange={(e) => { cmd("fontName", e.target.value); e.target.value = ""; }}
          className="h-8 rounded-md border border-border bg-background text-[12px] text-foreground px-1.5 max-w-[120px]">
          <option value="" disabled>Police</option>
          {POLICES.map((p) => <option key={p} value={p} style={{ fontFamily: p }}>{p}</option>)}
        </select>
        <select aria-label="Taille" defaultValue="" onChange={(e) => { cmd("fontSize", e.target.value); e.target.value = ""; }}
          className="h-8 rounded-md border border-border bg-background text-[12px] text-foreground px-1.5 ml-1">
          <option value="" disabled>Taille</option>
          {TAILLES.map((t) => <option key={t.valeur} value={t.valeur}>{t.label}</option>)}
        </select>
        {sep}
        {outil("Gras (Ctrl+B)", Bold, () => cmd("bold"))}
        {outil("Italique (Ctrl+I)", Italic, () => cmd("italic"))}
        {outil("Souligné (Ctrl+U)", Underline, () => cmd("underline"))}
        {outil("Barré", Strikethrough, () => cmd("strikeThrough"))}
        <label title="Couleur du texte" className={`${btn} relative cursor-pointer`}>
          <Baseline className="w-4 h-4" aria-hidden />
          <span className="sr-only">Couleur du texte</span>
          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => cmd("foreColor", e.target.value)} />
        </label>
        <label title="Surlignage" className={`${btn} relative cursor-pointer`}>
          <Highlighter className="w-4 h-4" aria-hidden />
          <span className="sr-only">Couleur de surlignage</span>
          <input type="color" defaultValue="#fff59d" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => cmd("hiliteColor", e.target.value)} />
        </label>
        {sep}
        {outil("Liste à puces", List, () => cmd("insertUnorderedList"))}
        {outil("Liste numérotée", ListOrdered, () => cmd("insertOrderedList"))}
        {outil("Diminuer le retrait", IndentDecrease, () => cmd("outdent"))}
        {outil("Augmenter le retrait", IndentIncrease, () => cmd("indent"))}
        {sep}
        {outil("Aligner à gauche", AlignLeft, () => cmd("justifyLeft"))}
        {outil("Centrer", AlignCenter, () => cmd("justifyCenter"))}
        {outil("Aligner à droite", AlignRight, () => cmd("justifyRight"))}
        {outil("Justifier", AlignJustify, () => cmd("justifyFull"))}
        {sep}
        {outil("Insérer un lien", Link2, lien)}
        {outil("Ligne horizontale", Minus, () => cmd("insertHorizontalRule"))}
        {outil("Effacer la mise en forme", RemoveFormatting, () => cmd("removeFormat"))}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { memoriser(); emettre(); }}
        onKeyUp={memoriser}
        onMouseUp={memoriser}
        onBlur={() => { memoriser(); emettre(); }}
        className="flex-1 overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-foreground focus:outline-none [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground"
        style={{ minHeight, fontFamily: "Arial, sans-serif" }}
      />
    </div>
  );
}
