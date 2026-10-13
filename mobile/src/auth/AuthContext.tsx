import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { http, setAccessToken, onUnauthorized, messageErreur } from "../api/http";
import { enregistrerPushToken } from "../utils/pushNotifications";
import { demarrerSynchronisationAutomatique } from "../utils/syncManager";

// Miroir de src/auth/AuthContext.tsx côté web (même forme AuthUser, même
// contrat /auth/login → { accessToken, user }, même endpoint /auth/me pour
// rafraîchir) — adapté au stockage sécurisé RN (expo-secure-store) au lieu
// de localStorage. Seul le compte assure_principal (portail Espace Assuré)
// est utilisé par cette appli mobile, mais AuthUser garde tous les champs
// du backend pour rester un vrai miroir du type serveur.
const USER_STORAGE_KEY = "medassur-current-user";

export interface AuthUser {
  id: string;
  nom: string;
  email: string;
  roleId: string;
  initiales: string;
  modules: string[];
  clientId?: string | null;
  assureSanteId?: string | null;
  prestataireId?: string | null;
  medecinId?: string | null;
  doitChangerMotDePasse?: boolean;
  consentementAccepteAt?: string | null;
}

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  currentUser: AuthUser | null;
  isLoading: boolean;
  consentementDonne: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  accepterConsentement: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CLE_CONSENTEMENT = (userId: string) => `medassur-consentement-${userId}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [consentementDonne, setConsentementDonne] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(USER_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as AuthUser;
          setUser(parsed);
          // Consentement — vérifié depuis SecureStore (fallback tant que la
          // migration User.consentementAccepteAt n'est pas appliquée en prod).
          const consenti = await SecureStore.getItemAsync(CLE_CONSENTEMENT(parsed.id));
          setConsentementDonne(!!consenti || !!parsed.consentementAccepteAt);
          try {
            const frais = await http.get<AuthUser>("/auth/me");
            await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(frais));
            setUser(frais);
            const consentiFrequent = await SecureStore.getItemAsync(CLE_CONSENTEMENT(frais.id));
            setConsentementDonne(!!consentiFrequent || !!frais.consentementAccepteAt);
          } catch {
            /* voir onUnauthorized ci-dessous pour le cas token expiré */
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const off = onUnauthorized(() => {
      setAccessToken(null);
      SecureStore.deleteItemAsync(USER_STORAGE_KEY).catch(() => undefined);
      setUser(null);
    });
    return off;
  }, []);

  // Notifications système (2026-09) — voir utils/pushNotifications.ts.
  // Enregistré à chaque fois qu'un utilisateur devient connu (connexion
  // fraîche OU session restaurée au démarrage) — le backend écrase
  // simplement l'ancien jeton s'il a déjà été enregistré, jamais bloquant.
  useEffect(() => {
    if (user) enregistrerPushToken();
  }, [user?.id]);

  // Mode hors-ligne (2026-09) — voir utils/syncManager.ts. Démarre une seule
  // fois dès qu'un utilisateur est connu ; vide ensuite la file d'attente à
  // chaque retour au premier plan / retour du réseau.
  useEffect(() => {
    if (user) demarrerSynchronisationAutomatique();
  }, [user?.id]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const { accessToken, user: authUser } = await http.post<{ accessToken: string; user: AuthUser }>("/auth/login", { email, password });
      await setAccessToken(accessToken);
      await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
      const consenti = await SecureStore.getItemAsync(CLE_CONSENTEMENT(authUser.id));
      setConsentementDonne(!!consenti || !!authUser.consentementAccepteAt);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: messageErreur(err, "Email ou mot de passe incorrect.") };
    }
  };

  const logout = async () => {
    await setAccessToken(null);
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
    setUser(null);
    setConsentementDonne(false);
  };

  const refreshCurrentUser = async () => {
    const frais = await http.get<AuthUser>("/auth/me");
    await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(frais));
    setUser(frais);
    const consenti = await SecureStore.getItemAsync(CLE_CONSENTEMENT(frais.id));
    setConsentementDonne(!!consenti || !!frais.consentementAccepteAt);
  };

  const accepterConsentement = async () => {
    if (!user) return;
    try { await http.post("/auth/consentement", {}); } catch { /* no-op côté serveur tant que la migration n'est pas appliquée */ }
    await SecureStore.setItemAsync(CLE_CONSENTEMENT(user.id), new Date().toISOString());
    setConsentementDonne(true);
  };

  return (
    <AuthContext.Provider value={{ currentUser: user, isLoading, consentementDonne, login, logout, refreshCurrentUser, accepterConsentement }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
