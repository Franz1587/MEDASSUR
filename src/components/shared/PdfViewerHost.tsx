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
// Rendu via pdf.js sur <canvas> (2026-09) — voir demande utilisateur :
// "sur la version responsive sur smartphone il y a un problème d'affichage
// de document". L'ancienne implémentation déléguait le rendu à l'iframe
// PDF native du navigateur (`<iframe src="blob:...#toolbar=0">`) : Chrome
// et Edge desktop savent l'afficher, mais Chrome/Safari mobile n'ont PAS ce
// plugin PDF intégré dans une iframe — la zone restait blanche. pdf.js
// dessine chaque page nous-mêmes sur un <canvas>, donc le rendu est
// identique sur toutes les plateformes (desktop ET mobile), sans dépendre
// d'une fonctionnalité de navigateur absente sur mobile.
export function PdfViewerHost() {
  const [doc, setDoc] = useState<PdfAAfficher | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nbPages, setNbPages] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PdfjsLib.PDFDocumentProxy | null>(null);
  // Un seul jeu de rendu à la fois par page (2026-09) — un changement de
  // largeur de fenêtre pendant le rendu (rotation d'écran, redimensionnement)
  // relance le rendu de toutes les pages ; sans ce verrou, deux rendus
  // concurrents sur le même <canvas> pdf.js lèvent une exception.
  const renderTokenRef = useRef(0);

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

  // Chargement + rendu de toutes les pages, empilées verticalement dans le
  // conteneur défilant — chaque page mise à l'échelle sur la largeur
  // disponible, recalculée à l'ouverture et au redimensionnement (rotation
  // téléphone/tablette, panneau latéral qui change de taille).
  useEffect(() => {
    if (!url || !scrollRef.current) return;
    const token = ++renderTokenRef.current;
    let annule = false;
    setChargement(true);
    setErreur(false);
    setNbPages(0);

    const rendreTout = async () => {
      const conteneur = scrollRef.current;
      if (!conteneur) return;
      conteneur.innerHTML = "";

      const pdfjsLib = await chargerPdfjs();
      const pdfDoc = await pdfjsLib.getDocument(url).promise;
      if (annule || token !== renderTokenRef.current) { pdfDoc.destroy(); return; }
      pdfDocRef.current = pdfDoc;
      setNbPages(pdfDoc.numPages);

      const largeurDisponible = Math.max(200, conteneur.clientWidth - 32);

      for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (annule || token !== renderTokenRef.current) return;
        const page = await pdfDoc.getPage(n);
        const viewportBrut = page.getViewport({ scale: 1 });
        const echelle = largeurDisponible / viewportBrut.width;
        const viewport = page.getViewport({ scale: echelle * (window.devicePixelRatio || 1) });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${largeurDisponible}px`;
        canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
        canvas.className = "shadow-sm border border-border/60 bg-white mx-auto block mb-3 last:mb-0";
        conteneur.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    };

    rendreTout()
      .catch((e) => { if (!annule) { console.error("Rendu PDF échoué", e); setErreur(true); } })
      .finally(() => { if (!annule) setChargement(false); });

    return () => {
      annule = true;
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
