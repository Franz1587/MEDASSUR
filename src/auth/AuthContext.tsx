import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { roles, type RoleDefinition, type RoleId } from "@/auth/roles";
import { http, setAccessToken, getAccessToken, messageErreur } from "@/lib/http";
import { demarrerAssistance } from "@/services/societes.service";
import { demarrerSynchronisationAutomatique } from "@/lib/syncManager";

const USER_STORAGE_KEY = "medassur-current-user";
// Retour d'assistance (2026-09) — voir demande utilisateur : "le Super
// Admin doit pouvoir accéder dans chaque interface dédiée aux société en
// mode assistance." sessionStorage (pas localStorage) : ne doit PAS
// survivre à la fermeture de l'onglet — une session d'assistance oubliée
// ouverte ne doit jamais devenir un accès permanent silencieux.
const ASSISTANCE_RETURN_KEY = "medassur-assistance-return";

// Matches backend/prisma/seed.ts DEMO_PASSWORD — every seeded demo user
// shares this password, so the "mode démo" role grid can log in for real
// without asking anyone to type it.
export const DEMO_PASSWORD = "medassur2024";

export interface AuthUser {
  id: string;
  nom: string;
  email: string;
  roleId: RoleId;
  initiales: string;
  // Droits par utilisateur (2026-08) — voir demande utilisateur : "c'est
  // l'administrateur qui donne les droits aux fonctionnalités". Source
  // d'autorité réelle pour le filtrage de la nav (voir AdminShell.tsx) —
  // roles.ts.allowedModules ne sert plus que de modèle par défaut à la
  // création d'un utilisateur (voir src/features/admin).
  modules: string[];
  // Rattachement portail client (2026-08) — voir backend schema.prisma
  // User.clientId : un compte client_entreprise/client_particulier ne voit
  // que les données de CE client (voir src/services/portailClient.service.ts).
  clientId?: string | null;
  // Rattachement portail assuré (2026-08) — voir backend schema.prisma
  // User.assureSanteId : un compte assure_principal ne voit que SES propres
  // données (voir src/services/portailMembre.service.ts).
  assureSanteId?: string | null;
  // Rattachement portail prestataire (2026-08) — voir backend schema.prisma
  // User.prestataireId : un compte prestataire_sante ne voit que SES propres
  // données (voir src/services/portailPrestataire.service.ts).
  prestataireId?: string | null;
  // Rattachement portail médecin (2026-08) — voir backend schema.prisma
  // User.medecinId : un compte medecin_prescripteur ne voit que SES propres
  // données, distinctes de celles de SA/SES structure(s) (voir demande
  // utilisateur : "le médecin doit avoir ses accès différents de ceux de
  // la clinique ou l'hôpital... c'est sensible").
  medecinId?: string | null;
  // Mot de passe temporaire (2026-09) — voir backend schema.prisma
  // User.doitChangerMotDePasse. true dès qu'un mot de passe a été fixé par
  // quelqu'un d'autre que le titulaire (création, réinitialisation admin,
  // régénération d'accès mobile) — voir App.tsx ProtectedRoute, qui bloque
  // tout accès aux données tant que ce n'est pas résolu.
  doitChangerMotDePasse?: boolean;
}

type LoginResult = { ok: true } | { ok: false; error: string };

// Session super_admin mise de côté pendant une assistance (2026-09) — voir
// demande utilisateur ci-dessus. Restaurée telle quelle par endAssistance.
interface AssistanceReturn {
  superAdmin: { accessToken: string; user: AuthUser };
  societeNom: string;
}

interface AuthContextValue {
  currentUser: AuthUser | null;
  currentRole: RoleDefinition | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  // Mode assistance (2026-09) — non-null tant qu'une session d'assistance
  // est active : porte le nom de la société assistée pour le bandeau
  // persistant (voir AssistanceBanner). startAssistance échange la session
  // super_admin courante contre celle de la société ciblée, en la mettant
  // de côté ; endAssistance la restaure telle quelle.
  assistance: { societeNom: string } | null;
  startAssistance: (societeId: string) => Promise<void>;
  endAssistance: () => void;
  // Rafraîchit currentUser depuis le serveur (2026-09) — voir demande
  // utilisateur : "Mon profil"/mot de passe modifiables en libre-service ;
  // sans ça, le nom affiché dans l'en-tête (currentUser.nom) resterait
  // l'instantané pris à la connexion après une modification du profil.
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function lireRetourAssistance(): AssistanceReturn | null {
  const stored = sessionStorage.getItem(ASSISTANCE_RETURN_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AssistanceReturn;
  } catch {
    sessionStorage.removeItem(ASSISTANCE_RETURN_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [assistanceSocieteNom, setAssistanceSocieteNom] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
        // Resynchronise modules/droits depuis le serveur (2026-09) — voir
        // demande utilisateur : les nouveaux écrans Super Admin
        // n'apparaissaient pas dans le menu latéral pour une session déjà
        // ouverte AVANT que ses droits soient étendus côté serveur (le
        // menu se construit depuis cet instantané localStorage, capturé à
        // la connexion — voir PortalShell.tsx/AdminShell.tsx). Silencieux :
        // un token expiré ou invalide déclenche déjà l'écouteur
        // "medassur:unauthorized" via http.ts, pas la peine de dupliquer un
        // message d'erreur ici.
        http.get<AuthUser>("/auth/me").then((frais) => {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(frais));
          setUser(frais);
        }).catch(() => undefined);
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    // Un rechargement de page PENDANT une assistance ne doit pas faire
    // disparaître le bandeau/le moyen de revenir au Super Admin.
    setAssistanceSocieteNom(lireRetourAssistance()?.societeNom ?? null);
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const { accessToken, user: authUser } = await http.post<{ accessToken: string; user: AuthUser }>(
        "/auth/login",
        { email, password },
      );
      setAccessToken(accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
      return { ok: true };
    } catch (err) {
      // Message réel du serveur quand disponible (2026-09) — voir demande
      // utilisateur : "Email ou mot de passe incorrect" s'affichait pour
      // N'IMPORTE QUELLE erreur (backend indisponible, cache navigateur
      // périmé après déploiement...), masquant la vraie cause aussi bien à
      // l'utilisateur qu'au diagnostic. Le backend renvoie déjà des
      // messages précis (AuthService : "Identifiants invalides", "Compte
      // introuvable", "Accès suspendu...") — repli générique seulement
      // pour une erreur sans réponse du serveur (réseau, etc.).
      return { ok: false, error: messageErreur(err, "Connexion impossible — vérifiez votre connexion ou réessayez.") };
    }
  };

  const logout = () => {
    sessionStorage.removeItem(ASSISTANCE_RETURN_KEY);
    setAssistanceSocieteNom(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
  };

  // Voir demande utilisateur : "le Super Admin doit pouvoir accéder dans
  // chaque interface dédiée aux société en mode assistance." Échange la
  // session : le token/utilisateur super_admin courant est mis de côté
  // (sessionStorage, jamais localStorage — ne doit pas survivre à la
  // fermeture de l'onglet), remplacé par le token d'assistance émis par le
  // backend (voir SocietesService.assistance — un VRAI compte administrateur
  // de la société, aux droits étendus à tout l'abonnement souscrit).
  const startAssistance = async (societeId: string) => {
    const token = getAccessToken();
    if (!token || !user) throw new Error("Session Super Admin introuvable.");
    const resultat = await demarrerAssistance(societeId);
    const retour: AssistanceReturn = { superAdmin: { accessToken: token, user }, societeNom: resultat.societeNom };
    sessionStorage.setItem(ASSISTANCE_RETURN_KEY, JSON.stringify(retour));
    setAccessToken(resultat.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resultat.user));
    setUser(resultat.user as AuthUser);
    setAssistanceSocieteNom(resultat.societeNom);
  };

  const endAssistance = () => {
    const retour = lireRetourAssistance();
    sessionStorage.removeItem(ASSISTANCE_RETURN_KEY);
    setAssistanceSocieteNom(null);
    if (!retour) { logout(); return; }
    setAccessToken(retour.superAdmin.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(retour.superAdmin.user));
    setUser(retour.superAdmin.user);
  };

  // Le token JWT expire au bout de 8h (voir backend/src/auth/auth.module.ts)
  // — sans ce listener, une action lancée après expiration échoue en 401
  // sans que rien ne prévienne l'utilisateur ni ne le ramène à l'écran de
  // connexion (voir http.ts, qui déclenche cet évènement sur tout 401 hors
  // /auth/login).
  // Mode hors-ligne, portails externes (2026-09) — voir lib/syncManager.ts.
  // Démarré dès qu'une session existe (ERP interne inclus, mais le
  // mécanisme ne fait rien tant qu'aucune action de portail externe n'a été
  // mise en file — voir PREFIXES_HORS_LIGNE dans lib/http.ts).
  useEffect(() => {
    if (user) demarrerSynchronisationAutomatique();
  }, [user?.id]);

  useEffect(() => {
    const onUnauthorized = () => {
      const etaitConnecte = !!localStorage.getItem(USER_STORAGE_KEY);
      logout();
      if (etaitConnecte) toast.error("Session expirée — veuillez vous reconnecter.");
    };
    window.addEventListener("medassur:unauthorized", onUnauthorized);
    return () => window.removeEventListener("medassur:unauthorized", onUnauthorized);
  }, []);

  const refreshCurrentUser = async () => {
    const frais = await http.get<AuthUser>("/auth/me");
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(frais));
    setUser(frais);
  };

  const currentUser = user;
  const currentRole = user ? roles[user.roleId] : null;
  const assistance = assistanceSocieteNom ? { societeNom: assistanceSocieteNom } : null;

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, login, logout, assistance, startAssistance, endAssistance, refreshCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
