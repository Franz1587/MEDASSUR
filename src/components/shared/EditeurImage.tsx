import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, RotateCw, X } from "lucide-react";

// Éditeur de photo avant envoi (2026-11) — voir demande utilisateur :
// "quand on filme on peut rogner, changer l'orientation". Rotation par quart
// de tour et rognage (cadre déplaçable, coins étirables) ; le recadrage est
// appliqué sur l'image en pleine résolution, jamais sur l'aperçu réduit.
type Cadre = { x: number; y: number; w: number; h: number }; // fractions de l'image tournée
type Prise = "deplacer" | "hg" | "hd" | "bg" | "bd";
const MIN = 0.08;

export function EditeurImage({ fichier, onValider, onAnnuler }: { fichier: File; onValider: (f: File) => void; onAnnuler: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [cadre, setCadre] = useState<Cadre>({ x: 0.03, y: 0.03, w: 0.94, h: 0.94 });
  const zone = useRef<HTMLDivElement>(null);
  const prise = useRef<{ type: Prise; depart: { x: number; y: number }; cadre: Cadre } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  // Image tournée dessinée dans un canvas (pleine taille ou aperçu).
  const dessiner = (img: HTMLImageElement, echelle: number) => {
    const quart = rotation % 180 !== 0;
    const c = document.createElement("canvas");
    c.width = Math.round((quart ? img.naturalHeight : img.naturalWidth) * echelle);
    c.height = Math.round((quart ? img.naturalWidth : img.naturalHeight) * echelle);
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, (-img.naturalWidth * echelle) / 2, (-img.naturalHeight * echelle) / 2, img.naturalWidth * echelle, img.naturalHeight * echelle);
    return c;
  };

  const apercu = image ? dessiner(image, Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight))).toDataURL("image/jpeg", 0.85) : null;

  const tourner = (sens: 1 | -1) => { setRotation((r) => (r + 90 * sens + 360) % 360); setCadre({ x: 0.03, y: 0.03, w: 0.94, h: 0.94 }); };

  const commencer = (type: Prise) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    prise.current = { type, depart: { x: e.clientX, y: e.clientY }, cadre };
  };
  const bouger = (e: React.PointerEvent) => {
    const p = prise.current, z = zone.current?.getBoundingClientRect();
    if (!p || !z) return;
    const dx = (e.clientX - p.depart.x) / z.width, dy = (e.clientY - p.depart.y) / z.height, c = p.cadre;
    const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    if (p.type === "deplacer") { setCadre({ ...c, x: borne(c.x + dx, 0, 1 - c.w), y: borne(c.y + dy, 0, 1 - c.h) }); return; }
    let { x, y, w, h } = c;
    if (p.type === "hg" || p.type === "bg") { const nx = borne(c.x + dx, 0, c.x + c.w - MIN); w = c.w + (c.x - nx); x = nx; }
    if (p.type === "hd" || p.type === "bd") w = borne(c.w + dx, MIN, 1 - c.x);
    if (p.type === "hg" || p.type === "hd") { const ny = borne(c.y + dy, 0, c.y + c.h - MIN); h = c.h + (c.y - ny); y = ny; }
    if (p.type === "bg" || p.type === "bd") h = borne(c.h + dy, MIN, 1 - c.y);
    setCadre({ x, y, w, h });
  };

  const valider = () => {
    if (!image) return;
    const plein = dessiner(image, 1);
    const sortie = document.createElement("canvas");
    sortie.width = Math.round(plein.width * cadre.w);
    sortie.height = Math.round(plein.height * cadre.h);
    sortie.getContext("2d")!.drawImage(plein, plein.width * cadre.x, plein.height * cadre.y, sortie.width, sortie.height, 0, 0, sortie.width, sortie.height);
    sortie.toBlob((b) => b && onValider(new File([b], fichier.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  };

  const coin = (type: Prise, position: React.CSSProperties) => (
    <span onPointerDown={commencer(type)} className="absolute w-5 h-5 rounded-full bg-white border-2 border-primary touch-none" style={{ ...position, cursor: type === "hg" || type === "bd" ? "nwse-resize" : "nesw-resize" }} />
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Rogner et pivoter la photo" className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-4 gap-3">
      <p className="text-white text-[13px]">Ajustez le cadre sur le document, puis validez.</p>
      <div className="relative max-w-full max-h-[70vh] select-none" ref={zone} onPointerMove={bouger} onPointerUp={() => (prise.current = null)}>
        {apercu ? <img src={apercu} alt="Aperçu du document" className="block max-w-full max-h-[70vh]" draggable={false} /> : <div className="w-64 h-64 flex items-center justify-center text-white text-[13px]">Chargement…</div>}
        {apercu && (
          <div className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] touch-none cursor-move"
            style={{ left: `${cadre.x * 100}%`, top: `${cadre.y * 100}%`, width: `${cadre.w * 100}%`, height: `${cadre.h * 100}%` }}
            onPointerDown={commencer("deplacer")}>
            {coin("hg", { left: -10, top: -10 })}{coin("hd", { right: -10, top: -10 })}{coin("bg", { left: -10, bottom: -10 })}{coin("bd", { right: -10, bottom: -10 })}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => tourner(-1)} className="h-10 px-3 rounded-lg bg-white/10 text-white text-[13px] inline-flex items-center gap-2 hover:bg-white/20"><RotateCcw className="w-4 h-4" />Pivoter</button>
        <button type="button" onClick={() => tourner(1)} className="h-10 px-3 rounded-lg bg-white/10 text-white text-[13px] inline-flex items-center gap-2 hover:bg-white/20"><RotateCw className="w-4 h-4" />Pivoter</button>
        <button type="button" onClick={onAnnuler} className="h-10 px-3 rounded-lg bg-white/10 text-white text-[13px] inline-flex items-center gap-2 hover:bg-white/20"><X className="w-4 h-4" />Annuler</button>
        <button type="button" onClick={valider} disabled={!image} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60"><Check className="w-4 h-4" />Valider</button>
      </div>
    </div>
  );
}
