import { createContext, useContext, useEffect, useState } from "react";
import { roles, type RoleDefinition, type RoleId } from "@/auth/roles";
import { mockUsers, type MockUser } from "@/auth/mockUsers";

const STORAGE_KEY = "courteva-current-role";

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
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
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
