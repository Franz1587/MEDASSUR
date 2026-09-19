import { useState } from "react";
import { toast } from "sonner";
import { X, FileDown, FileText, Loader2 } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { chapitresInterne, chapitresSuperAdmin, type GuideChapitre } from "./guideContent";
import { chapitresAssure } from "./guideContentAssure";
import { chapitresClient } from "./guideContentClient";
import { chapitresMedecin } from "./guideContentMedecin";
import { chapitresPrestataire } from "./guideContentPrestataire";

export type GuideProfil = "interne" | "super_admin" | "assure" | "client" | "medecin" | "prestataire";

// Chapitres + titre/sous-titre d'en-tête par profil (2026-09) — extension du
// guide aux 4 portails externes (assuré, client/souscripteur, médecin
// prescripteur, prestataire de santé), qui n'avaient aucun contenu jusqu'ici
// (voir demande utilisateur : "étendre ce guide à tous les portails
// externes"). Un lookup remplace le ternaire binaire d'origine
// (interne/super_admin) — plus lisible à 6 profils qu'une chaîne de
// ternaires.
const GUIDE_PAR_PROFIL: Record<GuideProfil, { chapitres: GuideChapitre[]; titre: string; description: string }> = {
  interne: {
    chapitres: chapitresInterne,
    titre: "Espace Société",
    description: "Comment exploiter MedAssur au quotidien, écran par écran, jusqu'au moindre bouton.",
  },
  super_admin: {
    chapitres: chapitresSuperAdmin,
    titre: "Espace Super Admin",
    description: "Comment administrer la plateforme MedAssur depuis le compte Super Admin.",
  },
  assure: {
    chapitres: chapitresAssure,
    titre: "Espace Assuré",
    description: "Comment utiliser votre espace assuré MedAssur : carte, garanties, prises en charge, remboursements et carnet de santé.",
  },
  client: {
    chapitres: chapitresClient,
    titre: "Espace Client",
    description: "Comment gérer vos contrats, vos bénéficiaires et vos demandes depuis votre espace souscripteur MedAssur.",
  },
  medecin: {
    chapitres: chapitresMedecin,
    titre: "Espace Médecin",
    description: "Comment utiliser votre espace médecin prescripteur MedAssur : file d'attente, consultations et dossiers patients.",
  },
  prestataire: {
    chapitres: chapitresPrestataire,
    titre: "Espace Prestataire",
    description: "Comment utiliser votre espace prestataire de santé MedAssur : patients, prestations et traitement des bons.",
  },
};

// Guide d'utilisateur intégré (2026-09) — voir demande utilisateur : "je
// veux que l'application génère son propre guide d'utilisateur que se soit
// en mode Super Admin ou Admin de la société qui utilise l'application" puis
// (en détail) : "il faut rendre téléchargeable le guide en PDF et en Word...
// le guide doit permettre à n'importe qui de pouvoir manipuler toutes
// fonctionnalité de l'application au détails près... avec des capture
// secondaire, terciaire... chaque commande, chaque bouton". Composant
// PARTAGÉ entre AdminShell.tsx (rôles internes de la société) et
// PortalShell.tsx (portail Super Admin) — seul le jeu de chapitres change
// (`profil`), la mécanique d'affichage (sommaire + sections texte/capture +
// étapes numérotées + zoom + export) est identique.
export function GuideView({ profil, onBack }: { profil: GuideProfil; onBack: () => void }) {
  const { chapitres, titre: titreProfil, description: descriptionProfil } = GUIDE_PAR_PROFIL[profil] ?? GUIDE_PAR_PROFIL.interne;
  const [chapitreId, setChapitreId] = useState(chapitres[0]?.id);
  const [imageAgrandie, setImageAgrandie] = useState<string | null>(null);
  const [export_, setExport] = useState<"pdf" | "word" | null>(null);
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);

  const chapitre: GuideChapitre | undefined = chapitres.find((c) => c.id === chapitreId) ?? chapitres[0];

  const lancerExport = async (format: "pdf" | "word") => {
    if (export_) return;
    setExport(format);
    setProgression({ fait: 0, total: 1 });
    try {
      const onProgress = (fait: number, total: number) => setProgression({ fait, total });
      // Import différé (2026-09) — jsPDF/docx/file-saver ne pèsent que sur
      // les visiteurs qui cliquent réellement un bouton de téléchargement,
      // jamais sur le chargement initial de l'application pour tout le
      // monde (voir mesure de taille de bundle avant/après ce correctif).
      const { exporterGuidePdf, exporterGuideWord } = await import("./exportGuide");
      if (format === "pdf") await exporterGuidePdf(chapitres, titreProfil, onProgress);
      else await exporterGuideWord(chapitres, titreProfil, onProgress);
      toast.success(`Guide ${format === "pdf" ? "PDF" : "Word"} téléchargé.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la génération du document.");
    } finally {
      setExport(null);
      setProgression(null);
    }
  };

  return (
    <div className="p-4 md:p-5 pb-24">
      <div className="bg-card/92 border border-border/80 rounded-2xl p-4 md:p-5 shadow-[0_12px_28px_rgba(17,66,102,0.1)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-border">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground">Guide d'utilisateur</h2>
            <p className="text-[12px] text-muted-foreground mt-1">{descriptionProfil}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button" onClick={() => lancerExport("pdf")} disabled={!!export_}
              className="h-9 px-3.5 rounded-xl border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {export_ === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              {export_ === "pdf" && progression ? `Génération… ${progression.fait}/${progression.total}` : "Télécharger PDF"}
            </button>
            <button
              type="button" onClick={() => lancerExport("word")} disabled={!!export_}
              className="h-9 px-3.5 rounded-xl border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {export_ === "word" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {export_ === "word" && progression ? `Génération… ${progression.fait}/${progression.total}` : "Télécharger Word"}
            </button>
            <BackButton onBack={onBack} label="Retour" className="h-9 px-4 gap-1.5 text-[13px]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 mt-5">
          {/* Sommaire */}
          <nav className="space-y-1 md:sticky md:top-4 md:self-start md:max-h-[80vh] md:overflow-y-auto">
            {chapitres.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChapitreId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[12.5px] transition-colors ${
                  c.id === chapitre?.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-secondary/45"
                }`}
              >
                {c.titre}
              </button>
            ))}
          </nav>

          {/* Contenu du chapitre */}
          <div className="space-y-10">
            {chapitre?.sections.map((section) => (
              <div key={section.titre}>
                <h3 className="text-[15px] font-semibold text-foreground mb-2">{section.titre}</h3>
                <div className="space-y-2 mb-3">
                  {section.texte.map((p, i) => (
                    <p key={i} className="text-[13px] text-muted-foreground leading-relaxed">{p}</p>
                  ))}
                </div>
                {section.image && (
                  <button
                    type="button"
                    onClick={() => setImageAgrandie(section.image!)}
                    className="block w-full rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
                    title="Cliquer pour agrandir"
                  >
                    <img src={section.image} alt={section.titre} className="w-full h-auto block" loading="lazy" />
                  </button>
                )}

                {section.etapes && section.etapes.length > 0 && (
                  <ol className="mt-5 space-y-5">
                    {section.etapes.map((etape, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {etape.titre && <p className="text-[13px] font-semibold text-foreground mb-1">{etape.titre}</p>}
                          <p className="text-[13px] text-muted-foreground leading-relaxed">{etape.texte}</p>
                          {etape.image && (
                            <button
                              type="button"
                              onClick={() => setImageAgrandie(etape.image!)}
                              className="block w-full max-w-2xl mt-2.5 rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
                              title="Cliquer pour agrandir"
                            >
                              <img src={etape.image} alt={etape.titre ?? section.titre} className="w-full h-auto block" loading="lazy" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {imageAgrandie && (
        <div
          className="fixed inset-0 z-[98] bg-black/70 flex items-center justify-center p-6"
          onClick={() => setImageAgrandie(null)}
        >
          <button
            type="button"
            onClick={() => setImageAgrandie(null)}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={imageAgrandie}
            alt="Capture agrandie"
            className="max-w-[92vw] max-h-[90vh] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
