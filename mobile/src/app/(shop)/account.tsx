/**
 * Account: who is signed in, the live server cart state, and sign out.
 */
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { Banner } from '@/components/Feedback';
import { useAuth } from '@/providers/AuthProvider';
import { useCart } from '@/providers/CartProvider';
import { API_BASE_URL, getProfile } from '@/lib/api';
import type { Profile } from '@/lib/api';
import { colors, formatMoney, radius, spacing } from '@/lib/theme';

const WEBSITE_URL = 'https://kora-bakes.onrender.com';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { cart, refresh } = useCart();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load your profile.');
      });
    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Baker';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
    >
      <View style={styles.brandRow}>
        <BrandMark size={36} />
        <Text style={styles.brand}>Kora Bakes</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>SIGNED IN AS</Text>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        {error ? <Banner message={error} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>YOUR BASKET</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Items</Text>
          <Text style={styles.statValue}>{cart.item_count}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Subtotal</Text>
          <Text style={styles.statValue}>{formatMoney(cart.subtotal_kobo)}</Text>
        </View>
        <Text style={styles.note}>
          This basket lives on the Kora Bakes server, shared with the website for your account.
        </Text>
        <View style={styles.actions}>
          <Button label="Refresh basket" variant="secondary" onPress={() => void refresh()} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>API</Text>
        <Text style={styles.mono}>{API_BASE_URL}</Text>
        <View style={styles.actions}>
          <Button
            label="Open the website"
            variant="secondary"
            onPress={() => void Linking.openURL(WEBSITE_URL)}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Sign out"
          variant="danger"
          testID="sign-out"
          onPress={async () => {
            await signOut();
            // The root layout swaps to the login screen on the session change.
            router.replace('/login');
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { fontSize: 20, fontWeight: '800', color: colors.ink },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.caramel,
    marginBottom: spacing.sm,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  email: { fontSize: 14, color: colors.inkMuted, marginTop: 2, marginBottom: spacing.md },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statLabel: { fontSize: 15, color: colors.inkMuted },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  note: { fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: spacing.sm },
  mono: { fontSize: 12, color: colors.inkMuted, fontFamily: 'monospace' },
  actions: { marginTop: spacing.lg, gap: spacing.md },
});