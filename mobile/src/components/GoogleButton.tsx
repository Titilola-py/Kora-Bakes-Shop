/**
 * "Continue with Google" button.
 *
 * Matches the website's primary sign-in affordance so the two clients feel
 * like one product. The Google identity lives in the brand mark only - no
 * Google client id or secret is used anywhere in the app.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/lib/theme';

type Props = {
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

export function GoogleButton({ onPress, busy = false, disabled = false }: Props) {
  const isDisabled = disabled || busy;

  return (
    <Pressable
      testID="google-sign-in"
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: isDisabled, busy }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, pressed && !isDisabled && styles.pressed, isDisabled && styles.dimmed]}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text style={styles.label}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  dimmed: { opacity: 0.45 },
});