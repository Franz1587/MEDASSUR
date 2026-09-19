import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { LogOut, Sun, Moon, Shield, Bell, CheckCheck, BookOpen, Menu, X, WifiOff, RefreshCw } from "lucide-react";
import { onFileAttenteChangee, synchroniser } from "@/lib/syncManager";
import { listerActionsEnAttente } from "@/lib/offlineStore";
import { useAlertesMessagerie } from "@/lib/useAlertesMessagerie";
import { MonProfilModal } from "@/portals/MonProfilModal";
import { GuideView, type GuideProfil } from "@/features/guide/GuideView";
import { useAuth } from "@/auth/AuthContext";
import { viewLabels, moduleIcons, type View } from "@/layout/navConfig";
import { viewRegistry } from "@/layout/viewRegistry";
import { ShellNavigationProvider } from "@/layout/ShellNavigationContext";
import { Badge } from "@/components/shared/Badge";
import { getNotifications, marquerNotificationLue, marquerToutesNotificationsLues } from "@/services/notifications.service";
import { getNonLus as getMessagerieNonLus } from "@/services/messagerie.service";
import type { AppNotification } from "@/types/notifications";
import type { PortalMeta } from "@/portals/portalMeta";
import logoMark from "@/assets/logo-mark.png";

// Cloche de notification (2026-08) — voir demande utilisateur : "que ce soit
// du côté de l'assuré principal ou côté client, il faut mettre la cloche de
// notification et la rendre fonctionnelle". PortalShell est le shell PARTAGÉ
// par les deux portails (client et assuré, voir portalMeta.ts) : une seule
// implémentation couvre les deux. Même endpoint générique que la cloche
// interne (AdminShell.tsx, /notifications) — déjà cloisonné par utilisateur
// connecté côté serveur, aucune adaptation backend nécessaire ici.
const NOTIFICATIONS_POLL_MS = 20_000;

// Association rôle → profil de guide (2026-09) — voir RoleId dans
// src/auth/roles.ts. Les rôles absents de cette table n'ont pas de contenu
// de guide dédié.
const GUIDE_PROFIL_PAR_ROLE: Partial<Record<string, GuideProfil>> = {
  super_admin: "super_admin",
  assure_principal: "assure",
  client_particulier: "client",
  client_entreprise: "client",
  medecin_prescripteur: "medecin",
  prestataire_sante: "prestataire",
};

// Bulle Messagerie (2026-08) — voir demande utilisateur : "un onglet
// messagerie qui... s'actualise toutes les 15s avec une bulle d'indication
// de nouveau message" — intervalle dédié, distinct des notifications.
const MESSAGERIE_POLL_MS = 15_000;

// Barre latérale verticale (2026-08) — voir demande utilisateur, sur le
// modèle de la référence produit partagée (portail à sidebar, pas des
// onglets horizontaux). Mêmes jetons de couleur que la sidebar interne
// (bg-sidebar/sidebar-foreground/sidebar-accent/sidebar-border, voir
// AdminShell.tsx) pour rester cohérent visuellement avec le reste de
// l'application, en plus simple : le portail n'a que 4-5 modules à plat,
// pas de zones/groupes à replier.
export function PortalShell({ meta }: { meta: PortalMeta }) {
  const { currentUser, currentRole, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  // Droits RÉELS par utilisateur (2026-08) — voir demande utilisateur :
  // "donner des droits sur les rubriques du menu" à des utilisateurs
  // individuels du portail, pas seulement au rôle. currentRole.allowedModules
  // ne sert plus que de modèle par défaut à la création (même principe que
  // AdminShell.tsx côté interne, voir AuthContext.tsx AuthUser.modules).
  // modules == [] (défaut Prisma @default([]) pour tout compte jamais
  // personnalisé, ex. super_admin créé par script) doit retomber sur le
  // modèle du rôle exactement comme modules == undefined — sinon ce compte
  // se retrouve avec un menu vide et le dashboard générique (bug constaté
  // en production, 2026-09).
  const modulesUtilisateur = currentUser?.modules as View[] | undefined;
  // "dashboard" (générique, réservé aux rôles internes — voir
  // backend/src/auth/role-modules.ts, jamais dans un rôle externe) traîne
  // encore dans `User.modules` de comptes portail créés avant l'introduction
  // des vues "xxxDashboard" dédiées par portail — le backfill additif ne
  // retire jamais rien. Filtré ici pour tout rôle externe : sans ça, un tel
  // compte atterrit sur le tableau de bord interne générique au lieu du
  // sien (bug constaté en production, 2026-09-13 — "n'affiche plus leur
  // fonctionnalité").
  const modulesBruts = ((modulesUtilisateur && modulesUtilisateur.length > 0 ? modulesUtilisateur : currentRole?.allowedModules) ?? [])
    .filter((m) => m !== "dashboard");
  // Ordre d'affichage du menu (2026-09) — voir demande utilisateur :
  // "mettre message ou messagerie en avant dernier". L'ORDRE STOCKÉ de
  // `User.modules` reflète juste l'ordre de ROLE_MODULES au moment de la
  // création du compte (jamais retrié après coup, voir le bug de dérive
  // des modules corrigé la même session) — recalculer l'ordre d'affichage
  // ICI, à chaque rendu, corrige donc aussi bien les comptes déjà créés que
  // les futurs, sans backfill.
  const modules = useMemo(() => {
    if (!modulesBruts.includes("messagerie")) return modulesBruts;
    const sansMessagerie = modulesBruts.filter((m) => m !== "messagerie");
    const avantDernier = Math.max(0, sansMessagerie.length - 1);
    return [...sansMessagerie.slice(0, avantDernier), "messagerie" as View, ...sansMessagerie.slice(avantDernier)];
  }, [modulesBruts]);
  const [view, setView] = useState<View>(modules[0] ?? "dashboard");

  const ActiveView = viewRegistry[view] ?? viewRegistry.dashboard;
  const isDark = resolvedTheme === "dark";

  // Retour en haut à chaque changement d'écran (2026-09) — voir même
  // correctif sur AdminShell.tsx (côté interne) : sans ça, changer d'écran
  // depuis une position de scroll profonde laisse le nouveau contenu hors
  // champ.
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view]);

  // Tiroir mobile (2026-09) — voir demande utilisateur : la sidebar fixe de
  // 256px écrasait tout le contenu sur téléphone/tablette ("coupures de
  // contenu"). En dessous du point de rupture lg, la sidebar devient un
  // tiroir superposé (fermé par défaut) au lieu de partager la largeur avec
  // le contenu ; au-dessus de lg, comportement desktop inchangé.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  // Profil libre-service (2026-09) — voir demande utilisateur : signature
  // électronique accessible à N'IMPORTE QUEL rôle externe (médecin, assuré,
  // souscripteur, agent d'une société...) — aucun écran "Mon profil" n'existait
  // jusqu'ici côté portails (contrairement à AdminShell.tsx côté interne).
  const [profileOpen, setProfileOpen] = useState(false);
  // Guide d'utilisateur (2026-09) — voir demande utilisateur : "je veux que
  // l'application génère son propre guide d'utilisateur que se soit en mode
  // Super Admin ou Admin de la société", étendu ensuite à tous les portails
  // externes (assuré, client/souscripteur, médecin, prestataire — voir
  // demande utilisateur : "étendre ce guide à tous les portails externes").
  // Un rôle sans entrée ici (courtier partenaire, compagnie d'assurance,
  // expert sinistres) n'a pas encore de contenu dédié : le bouton reste
  // masqué plutôt que d'ouvrir un guide vide.
  const [showGuide, setShowGuide] = useState(false);
  const guideProfil: GuideProfil | undefined = currentRole ? GUIDE_PROFIL_PAR_ROLE[currentRole.id] : undefined;
  useEffect(() => {
    const refresh = () => getNotifications().then(setNotifications).catch(() => undefined);
    refresh();
    const id = setInterval(refresh, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(id);
  }, []);
  const notificationsNonLues = notifications.filter((n) => n.statut === "Envoyée");

  const [messagerieNonLus, setMessagerieNonLus] = useState(0);
  useEffect(() => {
    const refresh = () => getMessagerieNonLus().then(setMessagerieNonLus).catch(() => undefined);
    refresh();
    const id = setInterval(refresh, MESSAGERIE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Bulles + son de notification (2026-09) — voir lib/useAlertesMessagerie.ts.
  // "interne: false" : un compte de portail externe ne peut jamais "prendre"
  // une conversation — il reçoit l'alerte "nouveau message" (une fois par
  // message), jamais le rappel insistant toutes les 5 min (réservé à
  // AdminShell.tsx, seul habilité à réclamer un dossier).
  useAlertesMessagerie({
    interne: false,
    suspendreNouveauMessage: view === "messagerie",
    onOuvrir: () => setView("messagerie"),
  });

  // Mode hors-ligne (2026-09) — voir lib/syncManager.ts. Petit indicateur
  // visible sur TOUS les portails externes (shell partagé) : "hors
  // connexion" dès que le navigateur le signale, "X action(s) en attente"
  // tant que la file (voir lib/offlineStore.ts) n'est pas vide — reste
  // silencieux si aucune action de portail externe n'a jamais été mise en
  // file (cas normal, ERP interne inclus, qui n'utilise jamais cette file).
  const [horsLigne, setHorsLigne] = useState(!navigator.onLine);
  const [enAttente, setEnAttente] = useState(() => listerActionsEnAttente().length);
  useEffect(() => {
    const majEnLigne = () => setHorsLigne(!navigator.onLine);
    window.addEventListener("online", majEnLigne);
    window.addEventListener("offline", majEnLigne);
    const off = onFileAttenteChangee(setEnAttente);
    return () => {
      window.removeEventListener("online", majEnLigne);
      window.removeEventListener("offline", majEnLigne);
      off();
    };
  }, []);

  const handleOuvrirNotification = async (n: AppNotification) => {
    setNotifOpen(false);
    if (n.statut === "Envoyée") {
      await marquerNotificationLue(n.id).catch(() => undefined);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, statut: "Lue" } : x)));
    }
  };
  const handleToutMarquerLu = async () => {
    await marquerToutesNotificationsLues().catch(() => undefined);
    setNotifications((prev) => prev.map((n) => ({ ...n, statut: "Lue" })));
  };

  return (
    <div className="min-h-screen bg-background flex">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] flex-shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/85 transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-16 flex-shrink-0 flex items-center gap-2.5 px-4 border-b border-sidebar-border/85">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm p-1.5">
            <img src={logoMark} alt="MedAssur" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[13.5px] font-bold text-sidebar-foreground truncate">{meta.label}</h1>
            </div>
            <Badge variant="gold">MedAssur</Badge>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/55 flex-shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {modules.map((m) => {
            const Icon = moduleIcons[m] ?? Shield;
            const active = view === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setView(m); setMobileNavOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-left transition-colors ${active ? "bg-white/14 border border-white/35 text-sidebar-foreground font-semibold" : "border border-transparent text-sidebar-foreground/85 hover:bg-sidebar-accent/55"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{viewLabels[m]}</span>
                {m === "messagerie" && messagerieNonLus > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {messagerieNonLus}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-shrink-0 px-4 py-3 border-t border-sidebar-border/70">
          <p className="text-[10.5px] text-sidebar-foreground/45">v1.0.0</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 border-b border-border/80 bg-card/65 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{meta.subtitle}</p>
            <p className="text-xs font-semibold text-foreground truncate sm:hidden">{meta.label}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {(horsLigne || enAttente > 0) && (
              <button
                type="button"
                onClick={() => synchroniser()}
                title={horsLigne ? "Aucune connexion — les données affichées peuvent être en cache" : "Envoyer les actions en attente"}
                className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-medium ${horsLigne ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}
              >
                {horsLigne ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {horsLigne ? "Hors connexion" : `${enAttente} en attente`}
              </button>
            )}
            <span className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bell className="w-4 h-4" />
              </button>
              {notificationsNonLues.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border border-card" />
              )}
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 rounded-xl border border-border bg-card text-foreground shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-border/70 flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Notifications {notificationsNonLues.length > 0 && `(${notificationsNonLues.length})`}</span>
                    {notificationsNonLues.length > 0 && (
                      <button type="button" onClick={handleToutMarquerLu} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" />Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                    {notifications.length === 0 && (
                      <p className="px-3 py-4 text-[12px] text-muted-foreground text-center">Aucune notification.</p>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleOuvrirNotification(n)}
                        className={`w-full text-left px-3 py-2.5 text-[12px] hover:bg-secondary/40 transition-colors flex items-start gap-2 ${n.statut === "Envoyée" ? "" : "opacity-60"}`}
                      >
                        {n.statut === "Envoyée" && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                        <span className="flex-1">
                          <span className="block">{n.message}</span>
                          <span className="block text-[10.5px] text-muted-foreground mt-0.5">{new Date(n.dateEnvoi).toLocaleString("fr-FR")}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </span>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {guideProfil && (
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                title="Guide d'utilisateur"
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2.5 border-l border-border pl-2 sm:pl-3">
              <button
                type="button" onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                title="Mon profil"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{currentUser?.initiales}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-foreground">{currentUser?.nom}</p>
                  <p className="text-xs text-muted-foreground">{currentRole?.label}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                title="Déconnexion"
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main ref={contentRef} className="flex-1 overflow-auto">
          {/* Accès rapide (2026-08) — voir demande utilisateur : "les
              boutons contrats et participant du dashboard doivent être des
              boutons d'accès rapide" — le Tableau de bord a besoin de
              changer de vue lui-même, comme les zones internes. */}
          <ShellNavigationProvider value={{ current: view, setView, shellActionRequest: null, triggerShellAction: () => undefined, scrollToTop: () => contentRef.current?.scrollTo({ top: 0 }) }}>
            {showGuide && guideProfil ? <GuideView profil={guideProfil} onBack={() => setShowGuide(false)} /> : <ActiveView />}
          </ShellNavigationProvider>
        </main>
      </div>

      {profileOpen && <MonProfilModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
