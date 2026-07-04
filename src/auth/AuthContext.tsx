import { createContext, useContext, useEffect, useState } from "react";
import { roles, type RoleDefinition, type RoleId } from "@/auth/roles";
import { http, setAccessToken } from "@/lib/http";

const USER_STORAGE_KEY = "courteva-current-user";

// Matches backend/prisma/seed.ts DEMO_PASSWORD — every seeded demo user
// shares this password, so the "mode démo" role grid can log in for real
// without asking anyone to type it.
export const DEMO_PASSWORD = "courteva2024";

export interface AuthUser {
  id: string;
  nom: string;
  email: string;
  roleId: RoleId;
  initiales: string;
}

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  currentUser: AuthUser | null;
  currentRole: RoleDefinition | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
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
    } catch {
      return { ok: false, error: "Email ou mot de passe incorrect." };
    }
  };

  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
  };

  const currentUser = user;
  const currentRole = user ? roles[user.roleId] : null;

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
