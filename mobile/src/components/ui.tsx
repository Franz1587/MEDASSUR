import React from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, RefreshControl,
  type StyleProp, type ViewStyle, type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme/colors";

// Petit kit d'UI partagé — style de liste/cartes inspiré de maquettes de
// référence (icônes + chevron, cartes arrondies, tuiles d'accès rapide), adapté au design
// system MedAssur (voir src/theme/colors.ts). Utilisé par TOUS les écrans
// du portail assuré mobile pour un rendu cohérent.

export function Screen({
  children, scroll = true, onRefresh, refreshing, style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (!scroll) {
    return (
      <SafeAreaView style={[styles.screen, style]} edges={["top"]}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function ListRow({
  icon, label, sublabel, onPress, right, iconColor,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  iconColor?: string;
}) {
  const Wrapper: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={({ pressed }: { pressed?: boolean }) => [styles.row, pressed && onPress ? { opacity: 0.6 } : null]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? colors.primary) + "1a" }]}>
          <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
    </Wrapper>
  );
}

export function IconTile({
  icon, label, onPress, color, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  // Bulle de compteur (2026-09) — voir demande utilisateur : "des bulles
  // indiquant... sur les boutons d'accès rapide... le nombre d'entrée",
  // affichée sur l'icône de la tuile, pas juste dans le libellé.
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <View style={[styles.tileIcon, { backgroundColor: (color ?? colors.primary) + "1a" }]}>
        <Ionicons name={icon} size={22} color={color ?? colors.primary} />
        {badge ? (
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";
const badgeColors: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  info: { bg: colors.infoBg, fg: colors.info },
  neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
};

export function Badge({ label, variant = "neutral" }: { label: string; variant?: BadgeVariant }) {
  const c = badgeColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function statutVariant(statut: string): BadgeVariant {
  const s = statut.toLowerCase();
  if (["accordé", "accepté", "actif", "traité", "traite", "validé", "réglé"].some((x) => s.includes(x))) return "success";
  if (["rejeté", "refusé", "annulé", "inactif"].some((x) => s.includes(x))) return "danger";
  if (["attente", "en cours", "partiellement"].some((x) => s.includes(x))) return "warning";
  return "neutral";
}

export function PrimaryButton({
  label, onPress, loading, disabled, icon, variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "outline" | "danger";
}) {
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isOutline ? styles.buttonOutline : isDanger ? styles.buttonDanger : styles.buttonPrimary,
        (disabled || loading) && { opacity: 0.55 },
        pressed && !disabled && !loading ? { opacity: 0.85 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : "#fff"} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={isOutline ? colors.primary : "#fff"} style={{ marginRight: 6 }} /> : null}
          <Text style={[styles.buttonText, isOutline && { color: colors.primary }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({ icon = "document-text-outline", title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textSubtle} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingView({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.emptySubtitle}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
      <Text style={styles.emptyTitle}>Impossible de charger les données</Text>
      <Text style={styles.emptySubtitle}>{message}</Text>
      {onRetry ? <View style={{ marginTop: spacing.md, width: 160 }}><PrimaryButton label="Réessayer" onPress={onRetry} icon="refresh" /></View> : null}
    </View>
  );
}

export function FormField({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.md,
  },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  rowSublabel: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  tile: { width: "31%", alignItems: "center", marginBottom: spacing.lg, gap: 6 },
  tileIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", position: "relative" },
  tileLabel: { fontSize: 11.5, fontWeight: "600", color: colors.text, textAlign: "center" },
  tileBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.background,
  },
  tileBadgeText: { fontSize: 9.5, fontWeight: "800", color: "#fff" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeText: { fontSize: 11.5, fontWeight: "700" },
  button: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 46, borderRadius: radius.md, paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl * 1.5, gap: 6, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.sm, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  fieldLabel: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
});

export const inputStyle = StyleSheet.create({
  base: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, color: colors.text, backgroundColor: colors.surface,
  },
});

export function formatMontant(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
