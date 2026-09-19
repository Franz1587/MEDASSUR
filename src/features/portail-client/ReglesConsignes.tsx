import { useEffect, useState } from "react";
import { ScrollText, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import { getReglesConsignes, openRegleConsigneDocument } from "@/services/reglesConsignes.service";
import type { RegleConsigne } from "@/types/reglesConsignes";

// Règles & Consignes — lecture seule côté portail client (2026-08) — voir
// demande utilisateur : "la même rubrique doit être ajoutée côté
// assurance... le client n'aura cela qu'en lecture seule et pourra
// télécharger les documents joints par l'assurance". Contenu global (pas
// cloisonné par client) mis en place par l'assurance (zone "Système", voir
// src/features/regles-consignes/index.tsx).
export default function PortailReglesConsignesView() {
  const [regles, setRegles] = useState<RegleConsigne[] | null>(null);

  useEffect(() => {
    getReglesConsignes(true).then(setRegles);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.35rem] font-bold text-foreground">Procédures</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Règles et consignes d'utilisation de votre assurance maladie</p>
      </div>

      {regles === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : regles.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucune règle publiée pour le moment.</div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {regles.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1.5 bg-primary/12 rounded-lg"><ScrollText className="w-4 h-4 text-primary" /></div>
                <h3 className="text-[14.5px] font-semibold text-foreground">{r.titre}</h3>
              </div>
              <div className="text-[13px] text-foreground leading-relaxed prose-sm" dangerouslySetInnerHTML={{ __html: r.contenu }} />
              {r.fichier && (
                <button
                  type="button"
                  onClick={() => openRegleConsigneDocument(r.fichier!).catch((err) => toast.error(err instanceof Error ? err.message : "Ouverture du document impossible."))}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-primary hover:underline mt-3 pt-3 border-t border-border/60"
                >
                  <Paperclip className="w-3.5 h-3.5" />Document joint
                  <Download className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
