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
  // Mot de passe temporaire (2026-09) — voir backend schema.prisma
  // User.doitChangerMotDePasse ; voir RootNavigator, qui bloque l'accès à
  // l'application tant que ce n'est pas résolu.
  doitChangerMotDePasse?: boolean;
}

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  currentUser: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
          // Resynchronise depuis le serveur (même logique que le web) —
          // silencieux : un token invalide déclenchera déjà onUnauthorized.
          try {
            const frais = await http.get<AuthUser>("/auth/me");
            await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(frais));
            setUser(frais);
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
      return { ok: true };
    } catch (err) {
      return { ok: false, error: messageErreur(err, "Email ou mot de passe incorrect.") };
    }
  };

  const logout = async () => {
    await setAccessToken(null);
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
    setUser(null);
  };

  const refreshCurrentUser = async () => {
    const frais = await http.get<AuthUser>("/auth/me");
    await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(frais));
    setUser(frais);
  };

  return (
    <AuthContext.Provider value={{ currentUser: user, isLoading, login, logout, refreshCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
