import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { CheckCircle2, Eraser, RotateCcw } from "lucide-react";
import { infoJetonSignaturePublique, envoyerSignaturePublique } from "@/services/maSignature.service";

// Page PUBLIQUE de signature, ouverte depuis le téléphone/tablette qui
// scanne le QR code (2026-09) — voir demande utilisateur : "l'application
// devra générer un QR code qui sera scanné. Une fois scanné, en cliquant
// sur le lien le téléphone ou la tablette nous ouvre une page de
// signature, on signe et on valide." JAMAIS connectée sur cet appareil —
// le jeton dans l'URL est la seule preuve d'identité (voir
// SignaturePubliqueController côté backend, aucun JwtAuthGuard ici).
// Volontairement hors du shell applicatif (pas de sidebar/menu) : conçue
// pour un écran de téléphone, un seul geste (signer) puis c'est terminé.
export default function SignaturePage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessineRef = useRef(false);
  const aTraceRef = useRef(false);

  const [nom, setNom] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    if (!token) return;
    infoJetonSignaturePublique(token)
      .then((r) => setNom(r.nom))
      .catch((err) => setErreur(err instanceof Error ? err.message : "Lien de signature invalide ou expiré."));
  }, [token]);

  // Canvas redimensionné à la taille réelle affichée (2026-09) — sans ça,
  // un canvas HTML garde sa résolution par défaut (300×150) quelle que
  // soit sa taille CSS, et le tracé apparaît décalé/pixelisé sur un écran
  // de téléphone plus large. Reappliqué au changement d'orientation
  // (2026-09, voir demande utilisateur : "afficher la zone de signature
  // dans le téléphone en paysage") — sans ça, une personne qui tourne son
  // téléphone APRÈS le chargement de la page (le cas réel : elle scanne en
  // portrait, tourne ensuite pour une zone plus large) garde l'ancienne
  // résolution/les anciennes coordonnées, le tracé partirait alors décalé.
  // Efface le tracé en cours au passage — cas rare (on tourne rarement le
  // téléphone EN PLEIN tracé), toujours resignable ensuite.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redimensionner = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
      }
      aTraceRef.current = false;
    };
    redimensionner();
    window.addEventListener("resize", redimensionner);
    window.addEventListener("orientationchange", redimensionner);
    return () => {
      window.removeEventListener("resize", redimensionner);
      window.removeEventListener("orientationchange", redimensionner);
    };
  }, [nom]);

  const positionDe = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const debuterTrait = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    dessineRef.current = true;
    aTraceRef.current = true;
    const { x, y } = positionDe(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const continuerTrait = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dessineRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = positionDe(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminerTrait = () => {
    dessineRef.current = false;
  };

  const effacer = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    aTraceRef.current = false;
  };

  const valider = async () => {
    if (!token || !canvasRef.current) return;
    if (!aTraceRef.current) { setErreur("Signez d'abord dans la zone ci-dessus."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      await envoyerSignaturePublique(token, dataUrl);
      setTermine(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible — réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  if (erreur && !nom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-slate-900 font-semibold mb-1">Lien invalide</p>
          <p className="text-slate-500 text-sm">{erreur}</p>
        </div>
      </div>
    );
  }

  if (termine) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold mb-1">Signature enregistrée</p>
          <p className="text-slate-500 text-sm">Vous pouvez fermer cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
      {/* Paysage = zone de signature plus large (2026-09) — voir demande
          utilisateur : "afficher la zone de signature dans le téléphone en
          paysage afin d'avoir une zone plus large". `landscape:`/`portrait:`
          (media query CSS `orientation`, pas de verrouillage JS fragile —
          peu fiable sur iOS Safari) : le conteneur s'élargit et le canvas
          s'aplatit dès que le téléphone est tourné, sans rien demander de
          plus à la personne qui signe. */}
      <div className="max-w-sm landscape:max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-6">
        <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mb-1">Signature électronique</p>
        <p className="text-slate-900 font-semibold text-[15px] mb-1">{nom ? `Signature pour : ${nom}` : "Chargement…"}</p>
        <p className="portrait:block landscape:hidden text-slate-400 text-[11.5px] mb-3">Tournez votre téléphone pour une zone de signature plus large.</p>

        <canvas
          ref={canvasRef}
          className="w-full h-56 landscape:h-40 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 touch-none"
          onPointerDown={debuterTrait}
          onPointerMove={continuerTrait}
          onPointerUp={terminerTrait}
          onPointerLeave={terminerTrait}
        />
        <p className="text-slate-400 text-[11px] mt-1.5">Signez avec le doigt ou un stylet dans la zone ci-dessus.</p>

        {erreur && <p className="text-red-600 text-[12.5px] mt-3">{erreur}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button" onClick={effacer}
            className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 text-[13.5px] font-medium inline-flex items-center gap-1.5"
          >
            <Eraser className="w-4 h-4" />Effacer
          </button>
          <button
            type="button" onClick={valider} disabled={envoi || !nom}
            className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-[13.5px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {envoi ? <RotateCcw className="w-4 h-4 animate-spin" /> : null}
            {envoi ? "Envoi…" : "Valider ma signature"}
          </button>
        </div>
      </div>
    </div>
  );
}
