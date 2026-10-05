/**
 * Cart.
 *
 * Reads and writes the SAME server cart the website uses. There is no local
 * cart here: opening this screen calls GET /api/cart, and every quantity
 * change or removal is sent to the backend, which returns the recalculated
 * cart that this screen then renders.
 */
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, EmptyState, Loading } from '@/components/Feedback';
import { Button } from '@/components/Button';
import { CartRow } from '@/components/CartRow';
import { useCart } from '@/providers/CartProvider';
import { colors, formatMoney, spacing } from '@/lib/theme';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, isLoading, isMutating, error, refresh } = useCart();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  if (isLoading && cart.items.length === 0) return <Loading label="Loading your basket…" />;

  const isEmpty = cart.items.length === 0;

  return (
    <View style={styles.screen}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.product_id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: isEmpty ? spacing.xxl : 250 + insets.bottom },
          isEmpty && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Your basket</Text>
            <Text style={styles.sub}>
              Synced with your Kora Bakes account, so the website shows the same items.
            </Text>
            {error ? <Banner message={error} /> : null}
          </View>
        }
        renderItem={({ item }) => <CartRow line={item} />}
        ListEmptyComponent={
          <EmptyState
            title="Your basket is empty"
            body="Add something from the shop and it will be waiting here on every device."
            action={<Button label="Browse the counter" onPress={() => router.push('/')} />}
          />
        }
      />

      {!isEmpty ? (
        <View style={[styles.summary, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatMoney(cart.subtotal_kobo)}</Text>
          </View>
          <Text style={styles.pickupNote}>
            Pickup only &middot; {cart.item_count} item{cart.item_count === 1 ? '' : 's'}
          </Text>
          <Button label="Finish checkout on the website" onPress={() => router.push('/account')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: spacing.lg },
  heading: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: spacing.xs },
  summary: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 15, color: colors.inkMuted },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.ink },
  pickupNote: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
});