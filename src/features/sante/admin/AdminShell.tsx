import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Users, Receipt, Bell, UserCircle, Home, LayoutGrid, Package, ShieldAlert, Building2, Plus, Search, List, Settings2, Mail, Send, Stethoscope, IdCard, BarChart3, CreditCard, ClipboardCheck, CheckCheck, BookOpen, Menu, X, WifiOff, RefreshCw } from "lucide-react";
import { onFileAttenteChangee, synchroniser } from "@/lib/syncManager";
import { listerActionsEnAttente } from "@/lib/offlineStore";
import { useAlertesMessagerie } from "@/lib/useAlertesMessagerie";
import { useAlertesDossiers } from "@/lib/useAlertesDossiers";
import { getAccordsPrealables } from "@/services/accordPrealable.service";
import { getDemandesClient } from "@/services/demandeClient.service";
import { GuideView } from "@/features/guide/GuideView";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { viewIcons, type View } from "@/layout/navConfig";
import { santeAdminNavTree } from "@/features/sante/admin/navTree";
import { useAuth } from "@/auth/AuthContext";
import { BackButton } from "@/components/shared/BackButton";
import { SignatureManager } from "@/components/shared/SignatureManager";
import { getNotifications, marquerNotificationLue, marquerToutesNotificationsLues } from "@/services/notifications.service";
import { getNonLus as getMessagerieNonLus } from "@/services/messagerie.service";
import { runSilently } from "@/lib/http";
import type { AppNotification } from "@/types/notifications";
import logoMark from "@/assets/logo-mark.png";

// Rafraîchissement de la bulle de notification (2026-08) — pas de canal
// temps réel (WebSocket) côté backend pour l'instant, un polling à
// intervalle court reste le compromis "temps réel perçu" le plus simple à
// exploiter côté client (voir demande utilisateur : "notification en temps
// réel... rien ne soit négligé ou ne passe inaperçu").
const NOTIFICATIONS_POLL_MS = 20_000;

// Bulle Messagerie (2026-08) — voir demande utilisateur : "un onglet
// messagerie qui... s'actualise toutes les 15s avec une bulle d'indication
// de nouveau message" — intervalle dédié, distinct des notifications.
const MESSAGERIE_POLL_MS = 15_000;

const zoneSections = [
  {
    label: "Accueil",
    icon: LayoutGrid,
    description: "Accès rapide et vue d'ensemble",
    items: [{ label: "Tableau de Bord", view: "dashboard" as const, icon: viewIcons.dashboard }],
  },
  {
    label: "Commercial",
    icon: Building2,
    description: "Prospection, souscripteurs et devis",
    items: [
      { label: "Prospection", view: "crm" as const, icon: viewIcons.crm },
      { label: "Souscripteurs", view: "clients" as const, icon: viewIcons.clients },
      { label: "Appels d'Offres", view: "appelOffres" as const, icon: viewIcons.appelOffres },
      { label: "Cotation", view: "cotation" as const, icon: viewIcons.cotation },
    ],
  },
  {
    label: "Production",
    icon: Package,
    description: "Contrats et participants santé",
    items: [
      { label: "Contrats", view: "contrats" as const, icon: viewIcons.contrats },
      { label: "Renouvellements", view: "renouvellements" as const, icon: viewIcons.renouvellements },
      { label: "Quittances et Avenants", view: "avenants" as const, icon: viewIcons.avenants },
      { label: "Demandes client", view: "demandesClient" as const, icon: viewIcons.demandesClient },
      { label: "Résiliations", view: "resiliations" as const, icon: viewIcons.resiliations },
      { label: "Participants", view: "participants" as const, icon: viewIcons.participants },
      { label: "Facture Production", view: "factureProduction" as const, icon: viewIcons.factureProduction },
    ],
  },
  {
    label: "Factures & Prises en charge",
    icon: ShieldAlert,
    description: "Dossiers de facturation et contrôle médical",
    items: [
      { label: "Factures", view: "prisesEnCharge" as const, icon: viewIcons.prisesEnCharge },
      { label: "Prise en charge", view: "accordPrealable" as const, icon: viewIcons.accordPrealable },
    ],
  },
  {
    label: "Réseau de Soins",
    icon: Stethoscope,
    description: "Prestataires conventionnés et règlement",
    items: [
      { label: "Prestataires", view: "prestataires" as const, icon: viewIcons.prestataires },
      { label: "Règlement", view: "reglementPrestataire" as const, icon: viewIcons.reglementPrestataire },
    ],
  },
  {
    label: "Finance",
    icon: viewIcons.comptabilite,
    description: "Comptabilité, commissions et trésorerie",
    items: [
      { label: "Comptabilité", view: "comptabilite" as const, icon: viewIcons.comptabilite },
      { label: "Règlement comptable", view: "reglementComptable" as const, icon: viewIcons.reglementComptable },
      { label: "État TPS", view: "etatTps" as const, icon: viewIcons.etatTps },
      { label: "Bordereau Sinistres", view: "bordereauSinistres" as const, icon: viewIcons.bordereauSinistres },
      { label: "Bordereau Production", view: "bordereauProduction" as const, icon: viewIcons.bordereauProduction },
      { label: "Bordereau Encaissement", view: "bordereauEncaissement" as const, icon: viewIcons.bordereauEncaissement },
      { label: "Commissions", view: "commissions" as const, icon: viewIcons.commissions },
      { label: "Recouvrement", view: "recouvrement" as const, icon: viewIcons.recouvrement },
      { label: "Trésorerie", view: "tresorerie" as const, icon: viewIcons.tresorerie },
      { label: "Fonds de Roulement", view: "fondsDeRoulement" as const, icon: viewIcons.fondsDeRoulement },
      { label: "Honoraires de Gestion", view: "honoraires" as const, icon: viewIcons.honoraires },
    ],
  },
  {
    label: "Outils",
    icon: viewIcons.ia,
    description: "Documents, assistant IA et reporting",
    items: [
      { label: "GED & Documents", view: "ged" as const, icon: viewIcons.ged },
      { label: "Assistant IA", view: "ia" as const, icon: viewIcons.ia },
      { label: "Reporting & KPIs", view: "rapports" as const, icon: viewIcons.rapports },
      { label: "Journal des opérations", view: "journalOperations" as const, icon: viewIcons.journalOperations },
      { label: "Suivi de production par agent", view: "suiviAgents" as const, icon: viewIcons.suiviAgents },
      { label: "Statistiques", view: "statistiques" as const, icon: viewIcons.statistiques },
      { label: "Courrier Maladie", view: "courrierMaladie" as const, icon: viewIcons.courrierMaladie },
      { label: "Messagerie", view: "messagerie" as const, icon: viewIcons.messagerie },
      { label: "Communications", view: "communications" as const, icon: viewIcons.communications },
    ],
  },
  {
    label: "Système",
    icon: viewIcons.admin,
    description: "Utilisateurs et administration",
    items: [
      { label: "Administration", view: "admin" as const, icon: viewIcons.admin },
      { label: "Paramètres de l'entreprise", view: "parametresEntreprise" as const, icon: viewIcons.parametresEntreprise },
      { label: "Compagnies", view: "compagnies" as const, icon: viewIcons.compagnies },
      { label: "Auto-Gestion", view: "autoGestion" as const, icon: viewIcons.autoGestion },
      { label: "Catalogue de garanties", view: "garantiesCatalogue" as const, icon: viewIcons.garantiesCatalogue },
      { label: "Cartes d'assurance", view: "cartesAssurance" as const, icon: viewIcons.cartesAssurance },
      { label: "Catalogue des actes médicaux", view: "actesMedicaux" as const, icon: viewIcons.actesMedicaux },
      { label: "Professionnel de santé", view: "professionnelsSante" as const, icon: viewIcons.professionnelsSante },
      { label: "Lettres clés (nomenclature)", view: "lettresCles" as const, icon: viewIcons.lettresCles },
      { label: "Modèles de courrier", view: "modelesCourrier" as const, icon: viewIcons.modelesCourrier },
      { label: "Contrôle fraude", view: "fraude" as const, icon: viewIcons.fraude },
      { label: "Procédures", view: "reglesConsignes" as const, icon: viewIcons.reglesConsignes },
      { label: "Banques", view: "banques" as const, icon: viewIcons.banques },
      { label: "Agences", view: "agences" as const, icon: viewIcons.agences },
      { label: "Import de données", view: "importDonnees" as const, icon: viewIcons.importDonnees },
    ],
  },
];

function getSubActionIcon(label: string): React.ElementType {
  const normalized = label.toLowerCase();
  if (normalized.includes("cré")) return Plus;
  if (normalized.includes("recher")) return Search;
  if (normalized.includes("liste")) return List;
  if (normalized.includes("config") || normalized.includes("param") || normalized.includes("type") || normalized.includes("rubrique")) return Settings2;
  if (normalized.includes("message") || normalized.includes("boite")) return Mail;
  if (normalized.includes("télé") || normalized.includes("transmission")) return Send;
  if (normalized.includes("facture") || normalized.includes("règlement") || normalized.includes("devis") || normalized.includes("tiers")) return Receipt;
  if (normalized.includes("carte")) return IdCard;
  if (normalized.includes("participant") || normalized.includes("souscripteur") || normalized.includes("ayant")) return Users;
  if (normalized.includes("compagnie")) return Building2;
  if (normalized.includes("médical") || normalized.includes("prestation")) return Stethoscope;
  if (normalized.includes("reporting") || normalized.includes("bordereau")) return BarChart3;
  if (normalized.includes("couverture")) return CreditCard;
  return FileText;
}

function ZoneCard({
  label,
  icon: ZoneIcon,
  description,
  items,
  current,
  setView,
  badges,
}: {
  label: string;
  icon: React.ElementType;
  description: string;
  items: Array<{ label: string; view: View; icon: React.ElementType }>;
  current: View;
  setView: (view: View) => void;
  badges?: Partial<Record<View, number>>;
}) {
  return (
    <div className="rounded-xl border border-sidebar-border/75 bg-sidebar-accent/35 px-3 py-3 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="flex items-start gap-2">
        <ZoneIcon className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/80 mt-0.5" />
        <div>
          <div className="text-[12px] font-semibold leading-tight">{label}</div>
          <div className="text-[10.5px] text-sidebar-foreground/55 mt-1 leading-tight">{description}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {items.length > 0 ? (
          items.map((item) => {
            const ItemIcon = item.icon;
            const active = current === item.view;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setView(item.view)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? "bg-white/14 border-white/35 text-sidebar-foreground" : "border-sidebar-border/70 bg-sidebar text-sidebar-foreground/90 hover:bg-sidebar-accent/65"}`}
              >
                <div className="flex items-center gap-2">
                  <ItemIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[12px] font-semibold leading-tight flex-1">{item.label}</span>
                  {!!badges?.[item.view] && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {badges[item.view]}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-sidebar-border/70 px-3 py-2 text-[11px] text-sidebar-foreground/55">
            Zone prête à recevoir les onglets.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminShell({
  breadcrumb,
  children,
  contentRef,
}: {
  breadcrumb: string[];
  children: React.ReactNode;
  // Créée par SanteAdminConsole (2026-09), pas ici — le Provider
  // ShellNavigationContext (qui expose scrollToTop via cette même ref)
  // enveloppe AdminShell DEPUIS SanteAdminConsole, donc APRÈS le rendu de
  // sa valeur ; la ref doit donc exister au niveau du parent, pas être
  // créée localement ici.
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { current, setView, triggerShellAction } = useShellNavigation();
  const { currentUser, currentRole, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  // Tiroir mobile (2026-09) — voir demande utilisateur : la console interne
  // gardait sa sidebar (76-250px) en permanence dans le flux, même sur
  // téléphone/tablette, contrairement au correctif déjà appliqué à
  // PortalShell.tsx pour les portails externes. En dessous de lg, la
  // sidebar passe en tiroir superposé (fermé par défaut, toujours en mode
  // "étendu" — le bouton collapsed/étendu du desktop n'a pas de sens dans
  // un tiroir) ; au-dessus de lg, comportement desktop inchangé.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showGuidePage, setShowGuidePage] = useState(false);
  const [phone, setPhone] = useState("+241 00 00 00 00");
  const [address, setAddress] = useState("Libreville, Gabon");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [horizontalTabs, setHorizontalTabs] = useState<Partial<Record<View, string>>>({});
  const [horizontalNestedTabs, setHorizontalNestedTabs] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [factureMenuOpen, setFactureMenuOpen] = useState(false);
  const [messagerieNonLus, setMessagerieNonLus] = useState(0);

  useEffect(() => {
    // Badge de fond (compteur non-lus) — jamais l'overlay de chargement
    // plein écran (PageLoader), ni au premier chargement ni au sondage.
    const refresh = () => runSilently(() => getNotifications()).then(setNotifications).catch(() => undefined);
    refresh();
    const id = setInterval(refresh, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const refresh = () => runSilently(() => getMessagerieNonLus()).then(setMessagerieNonLus).catch(() => undefined);
    refresh();
    const id = setInterval(refresh, MESSAGERIE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Bulles + son de notification (2026-09) — voir lib/useAlertesMessagerie.ts.
  // "interne: true" : ce shell est TOUJOURS l'ERP interne, donc éligible au
  // rappel insistant toutes les 5 min tant qu'une conversation de la file
  // partagée n'est prise par personne.
  useAlertesMessagerie({
    interne: true,
    suspendreNouveauMessage: current === "messagerie",
    onOuvrir: () => setView("messagerie"),
  });

  // Prise en main des dossiers (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production". Même bulle/son que
  // la messagerie, sur les Prises en charge et les Demandes client — actif
  // uniquement pour un rôle qui a réellement accès à l'écran concerné (ex.
  // un comptable ne sera jamais relancé sur des prises en charge).
  const moduleAllowed = (currentRole?.allowedModules as string[] | undefined) ?? [];
  useAlertesDossiers({
    actif: moduleAllowed.includes("accordPrealable"),
    recuperer: async () => (await getAccordsPrealables()).map((a) => ({
      id: a.id, titre: `${a.type} — ${a.prestataire}`, enAttente: !a.assigneAId && a.decision === "En attente",
    })),
    labelNouveau: (d) => `Nouvelle prise en charge — ${d.titre}`,
    labelRelance: (d) => `Prise en charge en attente — ${d.titre}`,
    onOuvrir: () => setView("accordPrealable"),
  });
  useAlertesDossiers({
    actif: moduleAllowed.includes("demandesClient"),
    recuperer: async () => (await getDemandesClient()).map((d) => ({
      id: d.id, titre: `${d.type} — ${d.clientNom ?? d.contratReference ?? d.id}`, enAttente: !d.gestionnaireId && d.statut === "En attente",
    })),
    labelNouveau: (d) => `Nouvelle demande client — ${d.titre}`,
    labelRelance: (d) => `Demande client en attente — ${d.titre}`,
    onOuvrir: () => setView("demandesClient"),
  });

  const notificationsNonLues = notifications.filter((n) => n.statut === "Envoyée");

  // Mode hors-ligne (2026-09) — voir lib/syncManager.ts et
  // src/portals/PortalShell.tsx (même indicateur côté portails externes).
  // Ici, la file reste TOUJOURS vide en usage normal : aucune écriture de
  // l'ERP interne (facturation, règlements, sinistres) n'est mise en file
  // pour l'instant — ces actions déclenchent des effets de bord qui se
  // rejouent à l'identique (SMS, notifications) sans détection de conflit
  // entre deux décisions concurrentes, contrairement à une simple demande ou
  // un message. Seul le cache de LECTURE (sans risque) s'applique déjà
  // partout, y compris ici. L'indicateur reste affiché pour la visibilité
  // "hors connexion" et parce qu'un futur module interne pourra un jour
  // rejoindre la file en toute sécurité.
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
    // Toutes les notifications actuelles proviennent de demandes de prise
    // en charge déposées via un portail externe — navigue directement vers
    // le dossier concerné (voir AccordPrealableService.create).
    setView("accordPrealable");
  };

  const handleToutMarquerLu = async () => {
    await marquerToutesNotificationsLues().catch(() => undefined);
    setNotifications((prev) => prev.map((n) => ({ ...n, statut: "Lue" })));
  };

  const handleOpenProfile = () => {
    setProfileOpen(false);
    setShowProfilePage(true);
  };

  const handleOpenGuide = () => {
    setShowGuidePage(true);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Tous les champs mot de passe sont obligatoires.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setPasswordMessage("Mot de passe mis à jour avec succès.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // Chaque utilisateur ne voit que les zones/items qui lui ont été
  // attribués individuellement (voir demande utilisateur : "c'est
  // l'administrateur qui donne les droits aux fonctionnalités... un
  // utilisateur a accès aux fonctionnalités qu'on lui aura attribué") —
  // User.modules (backend) est la source d'autorité réelle, distincte du
  // modèle par défaut du rôle (src/auth/roles.ts `allowedModules`, qui ne
  // sert plus qu'à pré-remplir un nouvel utilisateur à sa création, voir
  // src/features/admin).
  const allowed = currentUser?.modules as View[] | undefined;
  const visibleZoneSections = allowed
    ? zoneSections
        .map((zone) => ({ ...zone, items: zone.items.filter((item) => allowed.includes(item.view)) }))
        .filter((zone) => zone.items.length > 0)
    : zoneSections;

  const activeBreadcrumb = showProfilePage ? ["Profil utilisateur"] : showGuidePage ? ["Guide d'utilisateur"] : breadcrumb;
  const currentNav = santeAdminNavTree.find((item) => item.id === current);
  const currentSubMenus = currentNav?.children ?? [];
  const activeHorizontal = horizontalTabs[current] ?? currentSubMenus[0]?.label ?? "";
  const activeHorizontalItem = currentSubMenus.find((item) => item.label === activeHorizontal);
  const nestedSubMenus = activeHorizontalItem?.children ?? [];
  const nestedKey = `${current}:${activeHorizontal}`;
  const activeNested = horizontalNestedTabs[nestedKey] ?? nestedSubMenus[0]?.label ?? "";

  // Retour en haut de la zone d'affichage à chaque changement d'écran ou
  // d'onglet (2026-09) — voir demande utilisateur : "si je sélectionne [un
  // écran] au bas de la page ou au milieu, l'application ne me ramène pas
  // systématiquement en haut... où se trouve la zone d'affichage". Le
  // conteneur défilant est unique et partagé par TOUS les écrans (`contentRef`
  // reçue en prop, voir SanteAdminConsole.tsx — c'est aussi elle qui sert de
  // base à `scrollToTop` exposé par ShellNavigationContext) — sans ce reset,
  // changer d'écran depuis une position de scroll profonde laissait le
  // nouveau contenu apparaître hors champ, comme si le clic n'avait rien fait.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [nestedKey, activeNested]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
      {/* Top bar */}
      <div className="h-16 flex-shrink-0 flex items-center justify-between pr-3 sm:pr-5 bg-sidebar border-b border-sidebar-border/85">
        <div className={`h-16 flex items-center gap-2 sm:gap-3 pl-3 sm:pl-5 w-auto ${collapsed ? "lg:w-[76px]" : "lg:w-[250px]"}`}>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sidebar-foreground/85 hover:bg-sidebar-accent/55 transition-colors"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm p-1">
            <img src={logoMark} alt="MedAssur" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="leading-tight hidden sm:block">
              <div className="text-sidebar-foreground font-bold text-[15px] tracking-wide">MedAssur</div>
              <div className="text-sidebar-foreground/68 text-[10px] tracking-wide">Espace Santé Administration</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex w-7 h-7 rounded-full items-center justify-center flex-shrink-0 bg-primary hover:brightness-95 transition"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 text-primary-foreground" /> : <ChevronLeft className="w-4 h-4 text-primary-foreground" />}
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-sidebar-foreground/80 relative">
          <div className="hidden md:flex items-center gap-4">
          {(!allowed || allowed.includes("clients")) && (
            <span title="Nouveau souscripteur">
              <FileSpreadsheet
                className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground"
                onClick={() => { setView("clients"); triggerShellAction("clients", "Nouveau souscripteur", "top"); }}
              />
            </span>
          )}
          {(!allowed || allowed.includes("contrats")) && (
            <span title="Nouveau contrat">
              <FileText
                className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground"
                onClick={() => { setView("contrats"); triggerShellAction("contrats", "Nouveau contrat", "top"); }}
              />
            </span>
          )}
          {(!allowed || allowed.includes("participants")) && (
            <span title="Nouveau participant / ayant droit">
              <Users
                className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground"
                onClick={() => { setView("participants"); triggerShellAction("participants", "Nouveau participant", "top"); }}
              />
            </span>
          )}
          {(!allowed || allowed.includes("prisesEnCharge") || allowed.includes("accordPrealable")) && (
            <span className="relative" title="Nouvelle facture ou prise en charge">
              <Receipt
                className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground"
                onClick={() => setFactureMenuOpen((v) => !v)}
              />
              {factureMenuOpen && (
                <div className="absolute right-0 top-8 w-56 rounded-xl border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-xl z-50">
                  {(!allowed || allowed.includes("prisesEnCharge")) && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-sidebar/40 transition-colors"
                      onClick={() => { setFactureMenuOpen(false); setView("prisesEnCharge"); triggerShellAction("prisesEnCharge", "Nouvelle facture", "top"); }}
                    >
                      Nouvelle facture
                    </button>
                  )}
                  {(!allowed || allowed.includes("accordPrealable")) && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-sidebar/40 transition-colors"
                      onClick={() => { setFactureMenuOpen(false); setView("accordPrealable"); triggerShellAction("accordPrealable", "Nouvelle prise en charge", "top"); }}
                    >
                      Nouvelle prise en charge
                    </button>
                  )}
                </div>
              )}
            </span>
          )}
          </div>
          {(horsLigne || enAttente > 0) && (
            <button
              type="button"
              onClick={() => synchroniser()}
              title={horsLigne ? "Aucune connexion — les données affichées peuvent être en cache" : "Envoyer les actions en attente"}
              className={`hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium mr-1.5 ${horsLigne ? "bg-amber-500/15 text-amber-400" : "bg-sidebar-foreground/10 text-sidebar-foreground"}`}
            >
              {horsLigne ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {horsLigne ? "Hors connexion" : `${enAttente} en attente`}
            </button>
          )}
          <span className="relative">
            <Bell className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground" onClick={() => setNotifOpen((v) => !v)} />
            {notificationsNonLues.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive border border-sidebar" />
            )}
            {notifOpen && (
              <div className="absolute right-0 top-8 w-80 rounded-xl border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-xl z-50">
                <div className="px-3 py-2 border-b border-sidebar-border/70 flex items-center justify-between">
                  <span className="text-[12px] font-semibold">Notifications {notificationsNonLues.length > 0 && `(${notificationsNonLues.length})`}</span>
                  {notificationsNonLues.length > 0 && (
                    <button type="button" onClick={handleToutMarquerLu} className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground inline-flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" />Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-sidebar-border/50">
                  {notifications.length === 0 && (
                    <p className="px-3 py-4 text-[12px] text-sidebar-foreground/60 text-center">Aucune notification.</p>
                  )}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleOuvrirNotification(n)}
                      className={`w-full text-left px-3 py-2.5 text-[12px] hover:bg-sidebar/40 transition-colors flex items-start gap-2 ${n.statut === "Envoyée" ? "" : "opacity-60"}`}
                    >
                      {n.statut === "Envoyée" && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                      <span className="flex-1">
                        <span className="block">{n.message}</span>
                        <span className="block text-[10.5px] text-sidebar-foreground/60 mt-0.5">{new Date(n.dateEnvoi).toLocaleString("fr-FR")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </span>
          <span title="Guide d'utilisateur">
            <BookOpen
              className="w-[18px] h-[18px] cursor-pointer hover:text-sidebar-foreground"
              onClick={handleOpenGuide}
            />
          </span>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="w-[26px] h-[26px] rounded-full border border-sidebar-border flex items-center justify-center hover:bg-sidebar-accent/70 transition-colors"
            title="Profil utilisateur"
          >
            <UserCircle className="w-[18px] h-[18px]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-11 w-56 rounded-xl border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-xl z-50">
              <div className="px-3 py-2 border-b border-sidebar-border/70">
                <div className="text-[12px] font-semibold truncate">{currentUser?.nom ?? "Utilisateur"}</div>
                <div className="text-[11px] text-sidebar-foreground/70 truncate">{currentRole?.label ?? "Profil"}</div>
              </div>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-sidebar/40 transition-colors"
                onClick={handleOpenProfile}
              >
                Profil utilisateur
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[12px] text-red-200 hover:bg-red-500/20 transition-colors"
                onClick={logout}
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (desktop) */}
        <div
          className="hidden lg:block flex-shrink-0 overflow-y-auto pb-6 bg-sidebar border-r border-sidebar-border/85"
          style={{ width: collapsed ? 76 : 250 }}
        >
          {!collapsed ? (
            <div className="px-3 py-3 border-b border-sidebar-border/70 space-y-2 bg-sidebar-accent/15">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/55">Zones d'accès</div>
              {visibleZoneSections.map((zone) => (
                <ZoneCard key={zone.label} label={zone.label} icon={zone.icon} description={zone.description} items={zone.items} current={current} setView={setView} badges={{ messagerie: messagerieNonLus }} />
              ))}
            </div>
          ) : (
            <div className="py-2">
              {visibleZoneSections.flatMap((zone) => zone.items).map((item) => {
                const ItemIcon = item.icon;
                const isCurrent = current === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setView(item.view)}
                    className={`relative w-full flex items-center justify-center py-2.5 transition-colors border-l-[3px] ${
                      isCurrent
                        ? "bg-white/14 text-sidebar-foreground border-primary"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/65 border-transparent"
                    }`}
                  >
                    <ItemIcon className="w-4 h-4 flex-shrink-0" />
                    {item.view === "messagerie" && messagerieNonLus > 0 && (
                      <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-destructive border border-sidebar" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar (tiroir mobile/tablette) — toujours en mode "étendu",
            voir note sur mobileNavOpen plus haut. */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setMobileNavOpen(false)} />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] overflow-y-auto pb-6 bg-sidebar border-r border-sidebar-border/85 transform transition-transform duration-200 ease-out lg:hidden ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border/70">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm p-1">
                <img src={logoMark} alt="MedAssur" className="w-full h-full object-contain" />
              </div>
              <span className="text-sidebar-foreground font-bold text-[13.5px] tracking-wide">MedAssur</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="p-1.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/55"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
          <div className="px-3 py-3 space-y-2 bg-sidebar-accent/15">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/55">Zones d'accès</div>
            {visibleZoneSections.map((zone) => (
              <ZoneCard
                key={zone.label}
                label={zone.label}
                icon={zone.icon}
                description={zone.description}
                items={zone.items}
                current={current}
                setView={(v) => { setView(v); setMobileNavOpen(false); }}
                badges={{ messagerie: messagerieNonLus }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto bg-background">
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 bg-card/85 border-b border-border/85 text-[12px] text-muted-foreground backdrop-blur-sm overflow-x-auto">
            <BackButton className="w-7 h-7 flex-shrink-0" fallbackTo="/app" />
            <Home className="w-3.5 h-3.5" />
            {activeBreadcrumb.map((crumb, idx) => (
              <span key={crumb} className="flex items-center gap-1.5">
                <span className="text-border">›</span>
                <span className={idx === activeBreadcrumb.length - 1 ? "text-foreground" : ""}>{crumb}</span>
              </span>
            ))}
          </div>

          {!showProfilePage && !showGuidePage && currentSubMenus.length > 0 && (
            <div className="bg-card/88 border-b border-border/80 px-3 sm:px-5 py-2.5 space-y-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {currentSubMenus.map((sub) => {
                  const isActive = sub.label === activeHorizontal;
                  const SubIcon = getSubActionIcon(sub.label);
                  return (
                    <button
                      key={sub.label}
                      type="button"
                      onClick={() => {
                        setHorizontalTabs((prev) => ({ ...prev, [current]: sub.label }));
                        triggerShellAction(current, sub.label, "top");
                        if (sub.children?.length) {
                          const firstNested = sub.children[0].label;
                          const nextNestedKey = `${current}:${sub.label}`;
                          setHorizontalNestedTabs((prev) => ({ ...prev, [nextNestedKey]: prev[nextNestedKey] ?? firstNested }));
                        }
                      }}
                      className={`h-8 px-3 rounded-xl border text-[12px] whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${isActive ? "bg-primary text-primary-foreground border-primary shadow-[0_8px_18px_rgba(13,115,191,0.22)]" : "bg-background text-foreground border-border hover:bg-secondary/45"}`}
                    >
                      <SubIcon className="w-3.5 h-3.5" />
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              {nestedSubMenus.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                  {nestedSubMenus.map((sub) => {
                    const isActive = sub.label === activeNested;
                    const SubIcon = getSubActionIcon(sub.label);
                    return (
                      <button
                        key={`${nestedKey}:${sub.label}`}
                        type="button"
                        onClick={() => {
                          setHorizontalNestedTabs((prev) => ({ ...prev, [nestedKey]: sub.label }));
                          triggerShellAction(current, sub.label, "nested");
                        }}
                        className={`h-7 px-2.5 rounded-lg border text-[11.5px] whitespace-nowrap transition-colors inline-flex items-center gap-1 ${isActive ? "bg-secondary/80 text-foreground border-primary/60" : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-secondary/35"}`}
                      >
                        <SubIcon className="w-3 h-3" />
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showProfilePage ? (
            <div className="p-4 md:p-5 pb-24">
              <div className="bg-card/92 border border-border/80 rounded-2xl p-4 md:p-5 shadow-[0_12px_28px_rgba(17,66,102,0.1)]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-[18px] font-semibold text-foreground">Profil utilisateur</h2>
                    <p className="text-[12px] text-muted-foreground mt-1">Informations du compte, coordonnées et sécurité.</p>
                  </div>
                  <BackButton
                    onBack={() => setShowProfilePage(false)}
                    label="Retour"
                    className="h-9 px-4 gap-1.5 text-[13px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[12px] text-muted-foreground mb-1.5">Nom complet</div>
                      <input
                        value={currentUser?.nom ?? "Utilisateur"}
                        readOnly
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-[13px] text-foreground"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-muted-foreground mb-1.5">Email de connexion</div>
                      <input
                        value={currentUser?.email ?? ""}
                        readOnly
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-[13px] text-foreground"
                      />
                    </div>
                    <div>
                      <div className="text-[12px] text-muted-foreground mb-1.5">Profil / rôle</div>
                      <input
                        value={currentRole?.label ?? ""}
                        readOnly
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-[13px] text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[12px] text-muted-foreground mb-1.5 block">Téléphone</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none text-[13px] text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-muted-foreground mb-1.5 block">Adresse</label>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none text-[13px] text-foreground"
                      />
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] hover:brightness-95"
                      >
                        Enregistrer les coordonnées
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-border">
                  <h3 className="text-[14px] font-semibold text-foreground mb-3">Sécurité du compte</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[12px] text-muted-foreground mb-1.5 block">Mot de passe actuel</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none text-[13px] text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-muted-foreground mb-1.5 block">Nouveau mot de passe</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none text-[13px] text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-muted-foreground mb-1.5 block">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none text-[13px] text-foreground"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] hover:brightness-95"
                    >
                      Modifier le mot de passe
                    </button>
                    {passwordMessage && <span className="text-[12px] text-muted-foreground">{passwordMessage}</span>}
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-border">
                  <SignatureManager />
                </div>
              </div>
            </div>
          ) : showGuidePage ? (
            <GuideView profil="interne" onBack={() => setShowGuidePage(false)} />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
