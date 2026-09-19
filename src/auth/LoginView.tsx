import { Play } from "lucide-react";
import { LoginForm } from "@/auth/LoginForm";
import { ProfessionsCarousel } from "@/auth/ProfessionsCarousel";
import logoFull from "@/assets/logo-full.png";
import logoMark from "@/assets/logo-mark.png";

// Lien de téléchargement mobile (2026-09) — voir demande utilisateur :
// "quand l'application sera déployée sur Play Store, on sera redirigé vers
// cette plateforme pour la télécharger". Un seul point à changer le jour où
// la fiche Play Store existe : remplacer cette URL par
// "https://play.google.com/store/apps/details?id=com.medassur.app" — rien
// d'autre dans le composant n'a besoin de bouger.
const LIEN_TELECHARGEMENT_ANDROID = "/downloads/MedAssur.apk";

// Mode démo retiré de l'écran de connexion (2026-09) — voir demande
// utilisateur : "masque à présent tous les compte demo qui apparaissent
// sur le site... supprime tous les compte demo de l'interface de
// connexion". Les comptes eux-mêmes restent en base (voir
// backend/prisma/seed.ts) — seule cette grille de tuiles "sans mot de
// passe" est retirée ; ils restent accessibles via le formulaire normal
// pour un test interne, identifiants fournis à part (fichier Excel).
export function LoginView() {
  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <div className="absolute -left-24 -top-24 w-80 h-80 rounded-full blur-3xl bg-primary/20 pointer-events-none" />
      <div className="absolute -right-24 bottom-0 w-96 h-96 rounded-full blur-3xl bg-accent/20 pointer-events-none" />

      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[44%] relative overflow-hidden"
        style={{ background: "linear-gradient(152deg, #0a426f 0%, #0b5788 45%, #0d73bf 100%)" }}
      >
        <ProfessionsCarousel />
        <div className="absolute top-10 left-10 bg-white rounded-2xl px-5 py-4 inline-block shadow-[0_16px_34px_rgba(6,49,81,0.28)] w-fit z-10">
          <img src={logoFull} alt="MedAssur" className="h-20 w-auto" />
        </div>
      </div>

      {/* Content pane */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="bg-white rounded-xl p-1.5 shadow-sm border border-border/70 flex-shrink-0">
            <img src={logoMark} alt="MedAssur" className="h-8 w-auto" />
          </div>
          <p className="text-base font-bold text-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>MedAssur</p>
        </div>

        <div className="hidden lg:block w-full max-w-sm mb-7">
          <h1 className="text-3xl font-bold text-[#0a426f] leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            La plateforme de gestion d'assurance santé
          </h1>
        </div>

        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/70 bg-card/90 p-6 shadow-[0_18px_36px_rgba(16,57,92,0.12)]">
          <LoginForm />
        </div>

        {/* Téléchargement de l'app mobile (2026-09) — voir demande
            utilisateur : "il faut que le site ait un lien de génération
            fichier APK et Apple Store afin que l'application puisse un
            jour être déployée sur play store et app store". APK EAS déposé
            tel quel dans frontend-dist/downloads (servi statiquement par
            useStaticAssets côté backend, voir main.ts) — pas encore de
            vraie page de génération à la volée, juste un lien direct vers
            le dernier build stable. iOS nécessite un compte Apple
            Developer (pas encore créé) donc pas de lien équivalent pour
            l'instant.
            Style "badge de store" (2026-09) — voir demande utilisateur :
            "il faudrait cacher [l'APK] derrière le logo de Play Store". Pas
            le logo Google Play lui-même (marque déposée, ne pas reproduire
            sans autorisation) mais un badge sombre du même esprit — bascule
            transparente vers le vrai badge Play Store le jour du
            déploiement (voir LIEN_TELECHARGEMENT_ANDROID ci-dessus). */}
        <a
          href={LIEN_TELECHARGEMENT_ANDROID}
          download
          className="mt-6 w-full max-w-sm flex items-center gap-3 h-14 px-4 rounded-xl bg-[#0a0a0a] hover:bg-black transition-colors shadow-sm"
        >
          <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-white fill-white" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[10px] text-white/70 uppercase tracking-wide">Télécharger sur</span>
            <span className="block text-[15px] font-semibold text-white">Android</span>
          </span>
        </a>

        <p className="hidden lg:block mt-6 w-full max-w-sm text-xs text-muted-foreground/80">© 2026 MedAssur</p>
      </div>
    </div>
  );
}
