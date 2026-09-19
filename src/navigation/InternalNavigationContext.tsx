import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

const INTERNAL_HISTORY_KEY = "medassur-internal-history";
const INTERNAL_PATH_PREFIXES = ["/app", "/portal"];

function getPathKey(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

function isInternalPath(pathname: string) {
  return INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

interface InternalNavigationContextValue {
  canGoBack: boolean;
  goBack: () => string | null;
}

const InternalNavigationContext = createContext<InternalNavigationContextValue | null>(null);

export function InternalNavigationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [historyStack, setHistoryStack] = useState<string[]>(() => {
    const stored = sessionStorage.getItem(INTERNAL_HISTORY_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      sessionStorage.removeItem(INTERNAL_HISTORY_KEY);
      return [];
    }
  });

  useEffect(() => {
    const currentPath = getPathKey(location.pathname, location.search, location.hash);
    if (!isInternalPath(location.pathname)) return;

    setHistoryStack((prev) => {
      const lastPath = prev[prev.length - 1];
      if (lastPath === currentPath) return prev;
      const next = [...prev, currentPath].slice(-25);
      sessionStorage.setItem(INTERNAL_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [location.hash, location.pathname, location.search]);

  const value = useMemo<InternalNavigationContextValue>(() => ({
    canGoBack: historyStack.length > 1,
    goBack: () => {
      if (historyStack.length < 2) return null;
      const next = historyStack.slice(0, -1);
      const target = next[next.length - 1] ?? null;
      setHistoryStack(next);
      sessionStorage.setItem(INTERNAL_HISTORY_KEY, JSON.stringify(next));
      return target;
    },
  }), [historyStack]);

  return <InternalNavigationContext.Provider value={value}>{children}</InternalNavigationContext.Provider>;
}

export function useInternalNavigation() {
  const ctx = useContext(InternalNavigationContext);
  return ctx;
}