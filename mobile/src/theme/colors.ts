// Palette MedAssur — reprise du dégradé de l'écran de connexion web
// (src/auth/LoginView.tsx : linear-gradient(152deg, #0a426f 0%, #0b5788 45%, #0d73bf 100%))
// Style d'ergonomie inspiré de maquettes de référence fournies par
// l'utilisateur (listes à icônes/chevron, cartes arrondies, tuiles d'accès
// rapide, bloc "carte d'urgence" des informations médicales) — jamais une
// marque ni un nom de produit tiers, uniquement une mise en page.
export const colors = {
  primaryDark: "#0a426f",
  primary: "#0b5788",
  primaryLight: "#0d73bf",
  gradient: ["#0a426f", "#0b5788", "#0d73bf"] as const,

  background: "#f4f7fb",
  surface: "#ffffff",
  surfaceMuted: "#eef3f8",
  border: "#e2e8f0",

  text: "#0f1f2e",
  textMuted: "#5b6b7c",
  textSubtle: "#8a97a6",
  textOnPrimary: "#ffffff",

  success: "#16a34a",
  successBg: "#dcfce7",
  warning: "#d97706",
  warningBg: "#fef3c7",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  info: "#0d73bf",
  infoBg: "#e0f2fe",

  // Bloc "carte d'urgence" des informations médicales — rouge d'urgence,
  // jamais confondu avec le bleu de marque MedAssur (mise en page inspirée
  // de maquettes de référence, pas la couleur : le rouge reste standard
  // "urgence médicale").
  emergency: "#b91c1c",
  emergencyBg: "#fef2f2",
  emergencyBorder: "#fecaca",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};
