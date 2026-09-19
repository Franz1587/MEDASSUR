import { createContext, useContext } from "react";
import type { View } from "@/layout/navConfig";

type ShellNavigation = {
  current: View;
  setView: (view: View) => void;
  shellActionRequest: { view: View; label: string; scope: "top" | "nested"; nonce: number } | null;
  triggerShellAction: (view: View, label: string, scope: "top" | "nested") => void;
  // Remonte la zone d'affichage principale en haut (2026-09) — voir demande
  // utilisateur : "quand je sélectionne un participant/prestataire/contrat
  // au bas ou au milieu de la page, l'application ne me ramène pas
  // systématiquement en haut". Le changement d'écran/onglet est déjà géré
  // automatiquement (voir AdminShell.tsx/PortalShell.tsx) ; la sélection
  // d'une LIGNE dans une liste (même écran, juste `setSelected(x)` local)
  // ne déclenche aucun changement de route — chaque écran liste+détail doit
  // appeler cette fonction explicitement au moment de la sélection.
  scrollToTop: () => void;
};

const ShellNavigationContext = createContext<ShellNavigation | null>(null);

export function ShellNavigationProvider({
  value,
  children,
}: {
  value: ShellNavigation;
  children: React.ReactNode;
}) {
  return <ShellNavigationContext.Provider value={value}>{children}</ShellNavigationContext.Provider>;
}

export function useShellNavigation() {
  const ctx = useContext(ShellNavigationContext);
  if (!ctx) {
    return {
      current: "dashboard" as View,
      setView: () => undefined,
      shellActionRequest: null,
      triggerShellAction: () => undefined,
      scrollToTop: () => undefined,
    };
  }
  return ctx;
}
