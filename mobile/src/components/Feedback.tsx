/** Quantity stepper, message banners and empty/loading states. */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

export function QuantityStepper({
  quantity,
  onChange,
  disabled = false,
}: {
  quantity: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={disabled}
        onPress={() => onChange(Math.max(0, quantity - 1))}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`Quantity ${quantity}`}>
        {quantity}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={disabled || quantity >= 25}
        onPress={() => onChange(Math.min(25, quantity + 1))}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function Banner({
  message,
  tone = 'error',
}: {
  message: string;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        tone === 'error' && { backgroundColor: colors.dangerSoft, borderColor: '#F3C9C3' },
        tone === 'success' && { backgroundColor: '#E7F4EC', borderColor: '#B7DEC7' },
        tone === 'info' && { backgroundColor: colors.cobaltSoft, borderColor: '#C9D8FB' },
      ]}
    >
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.cobalt} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  stepperButton: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  stepperGlyph: { fontSize: 20, color: colors.ink, lineHeight: 24 },
  stepperValue: { minWidth: 28, textAlign: 'center', color: colors.ink, fontSize: 15, fontWeight: '600' },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  bannerText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyAction: { marginTop: spacing.xl, alignSelf: 'stretch' },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingLabel: { color: colors.inkMuted, fontSize: 14 },
});