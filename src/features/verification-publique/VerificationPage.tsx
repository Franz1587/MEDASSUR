import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ShieldCheck, ShieldX } from "lucide-react";
import { verifierDocument, type SignatureVerifiee } from "@/services/verification.service";

// Page PUBLIQUE de vérification de document, ouverte en scannant le QR
// imprimé sur un document généré par l'application (2026-09) — voir
// demande utilisateur : "une signature électronique unique (QR code) pour
// chaque document créé ou édité dans l'application... une authentification
// infaillible". JAMAIS connectée sur cet appareil — l'id dans l'URL est la
// seule clé (voir VerificationPubliqueController côté backend, aucun
// JwtAuthGuard). Volontairement hors du shell applicatif, un seul écran de
// lecture, pensé pour un téléphone.
export default function VerificationPage() {
  const { id } = useParams<{ id: string }>();
  const [signature, setSignature] = useState<SignatureVerifiee | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    verifierDocument(id)
      .then(setSignature)
      .catch((err) => setErreur(err instanceof Error ? err.message : "Ce document n'a pas pu être authentifié."));
  }, [id]);

  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <ShieldX className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold mb-1">Document non authentifié</p>
          <p className="text-slate-500 text-sm">{erreur}</p>
        </div>
      </div>
    );
  }

  if (!signature) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-400 text-sm">Vérification…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-slate-900 font-semibold text-[15px]">Document authentique</p>
            <p className="text-slate-400 text-[11px]">{signature.documentType}</p>
          </div>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Référence</span>
            <span className="text-slate-900 font-medium">{signature.statutActuel?.reference ?? signature.documentRef}</span>
          </div>
          {signature.statutActuel && (
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Statut actuel</span>
              <span className="text-slate-900 font-medium">{signature.statutActuel.statut}</span>
            </div>
          )}
          {signature.statutActuel?.details.map((d) => (
            <div key={d.label} className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">{d.label}</span>
              <span className="text-slate-900 font-medium">{d.valeur}</span>
            </div>
          ))}
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Édité par</span>
            <span className="text-slate-900 font-medium">{signature.acteurNom}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">Origine</span>
            <span className="text-slate-900 font-medium">{signature.origine}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Généré le</span>
            <span className="text-slate-900 font-medium">{new Date(signature.dateSignature).toLocaleString("fr-FR")}</span>
          </div>
        </div>

        <p className="text-slate-400 text-[11px] mt-4">Ce statut est recalculé en temps réel à chaque vérification.</p>
      </div>
    </div>
  );
}
