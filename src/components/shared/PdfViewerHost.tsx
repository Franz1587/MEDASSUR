import { useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import type * as PdfjsLib from "pdfjs-dist";
import { enregistrerAfficheurPdf, type PdfAAfficher } from "@/lib/pdfViewerBridge";

// Chargement différé de pdf.js (2026-09) — cette visionneuse est montée en
// permanence à la racine de l'app (voir plus bas), mais la plupart des
// visites n'ouvrent jamais de document : un import() dynamique évite
// d'alourdir le bundle initial (~370 Ko) de tout le monde, mobile compris,
// pour une bibliothèque dont seule une minorité de sessions se sert.
let pdfjsLibPromise: Promise<typeof PdfjsLib> | null = null;
function chargerPdfjs(): Promise<typeof PdfjsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// Visionneuse PDF unique, montée une seule fois à la racine de l'app (voir
// main.tsx, même principe que <Toaster />) — tout document PDF généré via
// documents.service.ts s'ouvre ici, dans l'application, plutôt que dans un
// nouvel onglet ou en téléchargement forcé. Télécharger/Imprimer restent
// disponibles depuis la visionneuse elle-même.
//
// Rendu lazy par page (2026-11) : seules les pages visibles (± 150 px) sont
// dessinées sur canvas. Les autres ont un placeholder de la bonne hauteur
// (calculé depuis les dimensions de la page 1, toutes les pages étant A4
// pour les documents générés). Résultat : la page 1 s'affiche en ~300 ms et
// la RAM reste basse même pour un PDF de 24 pages.
//
// DPR plafonné à 1,5 — un DPR=3 (mobiles récents) rend les canvases 9×
// plus lourds qu'à DPR=1 pour un gain visuel marginal sur des documents
// A4 typiquement affichés en plein écran à ~400 px de large.
export function PdfViewerHost() {
  const [doc, setDoc] = useState<PdfAAfficher | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nbPages, setNbPages] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PdfjsLib.PDFDocumentProxy | null>(null);
  const renderTokenRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    enregistrerAfficheurPdf(setDoc);
    return () => enregistrerAfficheurPdf(null);
  }, []);

  useEffect(() => {
    if (!doc) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(doc.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setDoc(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doc]);

  useEffect(() => {
    if (!url || !scrollRef.current) return;
    const token = ++renderTokenRef.current;
    let annule = false;
    setChargement(true);
    setErreur(false);
    setNbPages(0);
    // Plafonner le DPR à 1,5 — DPR=2-3 (Retina/mobile) multiplie la mémoire
    // canvas par 4-9 pour un gain de netteté négligeable sur un PDF A4.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const init = async () => {
      const conteneur = scrollRef.current!;
      conteneur.innerHTML = "";
      observerRef.current?.disconnect();

      const pdfjsLib = await chargerPdfjs();
      const pdfDoc = await pdfjsLib.getDocument(url).promise;
      if (annule || token !== renderTokenRef.current) { pdfDoc.destroy(); return; }
      pdfDocRef.current = pdfDoc;

      const n = pdfDoc.numPages;
      setNbPages(n);

      const largeur = Math.max(200, conteneur.clientWidth - 32);

      // Dimensions de la page 1 utilisées pour tous les placeholders —
      // tous nos PDFs générés sont A4 : une seule requête getPage() suffit.
      const page1 = await pdfDoc.getPage(1);
      if (annule || token !== renderTokenRef.current) return;
      const vp0 = page1.getViewport({ scale: 1 });
      const echelle = largeur / vp0.width;
      const pageH = Math.round(vp0.height * echelle);

      // Créer les placeholders pour toutes les pages en une passe (instantané)
      // afin que le scrollbar reflète la vraie hauteur du document dès
      // l'ouverture, avant même que les pages soient rendues.
      const placeholders: HTMLDivElement[] = [];
      for (let i = 1; i <= n; i++) {
        const ph = document.createElement("div");
        ph.style.cssText = `width:${largeur}px;height:${pageH}px;`;
        ph.className = "mx-auto mb-3 last:mb-0 bg-white shadow-sm border border-border/60";
        ph.dataset.page = String(i);
        conteneur.appendChild(ph);
        placeholders.push(ph);
      }

      const rendered = new Set<number>();

      const renderPage = async (pageNum: number, ph: HTMLDivElement) => {
        if (rendered.has(pageNum) || annule || token !== renderTokenRef.current) return;
        rendered.add(pageNum);
        try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: echelle * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = `width:${largeur}px;height:${Math.round(viewport.height / dpr)}px;display:block;`;
          ph.style.height = "";
          ph.innerHTML = "";
          ph.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
        } catch { /* non-bloquant */ }
      };

      // Rendre la page 1 immédiatement → le spinner disparaît
      await renderPage(1, placeholders[0]);
      setChargement(false);

      // IntersectionObserver pour les pages suivantes : render à la demande
      // quand une page entre dans le viewport (+ 150 px de marge anticipée).
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const ph = entry.target as HTMLDivElement;
            const p = Number(ph.dataset.page);
            renderPage(p, ph).catch(() => {});
            // Pré-rendre la page suivante pour fluidifier le défilement
            if (p < n) renderPage(p + 1, placeholders[p]).catch(() => {});
          }
        },
        { root: conteneur.parentElement, rootMargin: "150px 0px" },
      );
      observerRef.current = observer;
      // Observez toutes les pages sauf la 1re déjà rendue
      for (const ph of placeholders.slice(1)) observer.observe(ph);
    };

    init().catch((e) => {
      if (!annule) { console.error("Rendu PDF échoué", e); setErreur(true); setChargement(false); }
    });

    return () => {
      annule = true;
      observerRef.current?.disconnect();
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [url]);

  // Redimensionnement de la fenêtre pendant l'affichage (2026-09) — relance
  // le rendu à la nouvelle largeur (rotation d'écran mobile notamment).
  useEffect(() => {
    if (!url) return;
    const onResize = () => setUrl((u) => (u ? `${u.split("#")[0]}` : u));
    let frame: number | undefined;
    const debounced = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(onResize);
    };
    window.addEventListener("resize", debounced);
    return () => window.removeEventListener("resize", debounced);
  }, [url]);

  if (!doc || !url) return null;

  const telecharger = () => {
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = doc.nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
  };

  // Impression (2026-09) — l'iframe native a disparu (rendu pdf.js
  // maintenant), donc plus de contentWindow.print() disponible : on ouvre
  // le PDF dans un nouvel onglet, dont le navigateur sait imprimer
  // nativement (fonctionne aussi bien desktop que mobile).
  const imprimer = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center sm:p-4" onClick={() => setDoc(null)}>
      <div
        className="w-full h-full sm:h-[90vh] sm:max-w-5xl bg-card border border-border sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
          <h3 className="text-[12.5px] sm:text-[13.5px] font-semibold text-foreground truncate min-w-0">{doc.nomFichier}</h3>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button" onClick={imprimer} title="Imprimer"
              className="h-8 px-2 sm:px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Imprimer</span>
            </button>
            <button
              type="button" onClick={telecharger} title="Télécharger"
              className="h-8 px-2 sm:px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Télécharger</span>
            </button>
            <button
              type="button" onClick={() => setDoc(null)} title="Fermer"
              className="h-8 px-2 sm:px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /><span className="hidden sm:inline">Fermer</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-secondary/30 p-2 sm:p-4 relative">
          {chargement && nbPages === 0 && (
            <p className="text-[12.5px] text-muted-foreground text-center py-10">Chargement du document…</p>
          )}
          {erreur && (
            <p className="text-[12.5px] text-destructive text-center py-10">
              Impossible d'afficher ce document. Utilisez "Télécharger" pour l'ouvrir.
            </p>
          )}
          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
}
