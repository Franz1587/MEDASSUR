import { createContext, useContext, useEffect, useState } from "react";
import { roles, type RoleDefinition, type RoleId } from "@/auth/roles";
import { mockUsers, type MockUser } from "@/auth/mockUsers";
import { http, setAccessToken } from "@/lib/http";

const STORAGE_KEY = "courteva-current-role";

// Matches backend/prisma/seed.ts DEMO_PASSWORD — every seeded demo user
// shares this password so the frontend role picker can also obtain a real
// JWT from the backend for the domains already wired to the live API
// (Clients, Compagnies) without a real login form.
const DEMO_PASSWORD = "courteva2024";

interface AuthContextValue {
  currentUser: MockUser | null;
  currentRole: RoleDefinition | null;
  login: (roleId: RoleId) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleId, setRoleId] = useState<RoleId | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (stored && roles[stored]) setRoleId(stored);
  }, []);

  const login = (id: RoleId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setRoleId(id);

    const user = mockUsers[id];
    http
      .post<{ accessToken: string }>("/auth/login", { email: user.email, password: DEMO_PASSWORD })
      .then(({ accessToken }) => setAccessToken(accessToken))
      .catch(() => {
        // Backend not running (or not seeded yet) — the rest of the app
        // keeps working off mocked data, only Clients/Compagnies need it.
        setAccessToken(null);
      });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
    setRoleId(null);
  };

  const currentUser = roleId ? mockUsers[roleId] : null;
  const currentRole = roleId ? roles[roleId] : null;

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
