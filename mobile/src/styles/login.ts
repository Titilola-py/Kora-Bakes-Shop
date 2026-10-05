/** Styles for the sign-in screen. */
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  brand: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  tagline: { fontSize: 13, color: colors.inkMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.caramel,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginBottom: spacing.xl },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: 6 },
  switchText: { color: colors.inkMuted, fontSize: 14 },
  switchAction: { color: colors.cobalt, fontSize: 14, fontWeight: '700' },
  footnote: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
});