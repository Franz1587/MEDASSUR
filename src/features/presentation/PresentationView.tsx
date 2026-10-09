import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Presentation, Loader2 } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { downloadFile } from "@/lib/http";

type Langue = "fr" | "en";
type Format = "pptx" | "pdf";

interface FichierDeck {
  langue: Langue;
  format: Format;
  labelLangue: string;
  labelFormat: string;
  description: string;
  nomFichier: string;
}

const FICHIERS: FichierDeck[] = [
  {
    langue: "fr", format: "pptx",
    labelLangue: "Français", labelFormat: "PowerPoint (.pptx)",
    description: "25 diapositives — à personnaliser dans PowerPoint avant envoi",
    nomFichier: "MEDASSUR+ - Présentation.pptx",
  },
  {
    langue: "fr", format: "pdf",
    labelLangue: "Français", labelFormat: "PDF",
    description: "Version finale prête à imprimer ou à joindre à un e-mail",
    nomFichier: "MEDASSUR+ - Présentation.pdf",
  },
  {
    langue: "en", format: "pptx",
    labelLangue: "English", labelFormat: "PowerPoint (.pptx)",
    description: "25 slides — customise in PowerPoint before sending",
    nomFichier: "MEDASSUR+ - Presentation (EN).pptx",
  },
  {
    langue: "en", format: "pdf",
    labelLangue: "English", labelFormat: "PDF",
    description: "Print-ready or attach directly to an e-mail",
    nomFichier: "MEDASSUR+ - Presentation (EN).pdf",
  },
];

export function PresentationView({ onBack }: { onBack: () => void }) {
  const [en_cours, setEnCours] = useState<string | null>(null);

  const telecharger = async (f: FichierDeck) => {
    const cle = `${f.langue}-${f.format}`;
    if (en_cours) return;
    setEnCours(cle);
    try {
      await downloadFile(`/presentations/download?lang=${f.langue}&format=${f.format}`, f.nomFichier);
    } catch {
      toast.error("Impossible de télécharger le fichier.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="p-4 md:p-5 pb-24">
      <div className="bg-card/92 border border-border/80 rounded-2xl p-4 md:p-5 shadow-[0_12px_28px_rgba(17,66,102,0.1)]">

        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-border">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground">Présentation commerciale</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Pitch deck MEDASSUR+ — toutes fonctionnalités, portails web et mobile, en français et en anglais.
            </p>
          </div>
          <BackButton onBack={onBack} label="Retour" className="h-9 px-4 gap-1.5 text-[13px]" />
        </div>

        {/* Aperçu */}
        <div className="mt-5 mb-6 rounded-xl bg-[#0A426F]/8 border border-[#0A426F]/15 p-4 flex items-start gap-3">
          <Presentation className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">25 diapositives</span> couvrant la console de gestion, les portails assuré / souscripteur / prestataire / médecin, l&apos;application mobile et l&apos;assistant IA — avec captures d&apos;écran réelles, statistiques et contact.
            Disponible en <span className="font-medium text-foreground">PowerPoint</span> (personnalisable) et en <span className="font-medium text-foreground">PDF</span> (prêt à envoyer).
          </div>
        </div>

        {/* Cartes de téléchargement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FICHIERS.map((f) => {
            const cle = `${f.langue}-${f.format}`;
            const loading = en_cours === cle;
            return (
              <button
                key={cle}
                type="button"
                onClick={() => telecharger(f)}
                disabled={!!en_cours}
                className="text-left rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/4 transition-colors p-4 flex items-start gap-3 disabled:opacity-60"
              >
                <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  {loading
                    ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    : <FileDown className="w-4 h-4 text-primary" />
                  }
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-foreground">
                    {f.labelLangue} — {f.labelFormat}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{f.description}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-1 truncate">{f.nomFichier}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
