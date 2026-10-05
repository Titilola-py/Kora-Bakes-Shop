/**
 * Product list.
 *
 * Products are read from the existing production API - the app ships no copy
 * of the catalogue. Each tile adds straight to the server cart.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/ProductCard';
import { Banner, EmptyState, Loading } from '@/components/Feedback';
import { listProducts } from '@/lib/api';
import type { Product } from '@/lib/api';
import { colors, spacing } from '@/lib/theme';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setIsRefreshing(true);
    try {
      const data = await listProducts();
      setProducts(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the menu.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  if (isLoading) return <Loading label="Loading today's bake…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.column}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => void load('refresh')} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FRESH FROM THE OVEN</Text>
          <Text style={styles.heading}>Today&rsquo;s counter</Text>
          <Text style={styles.sub}>
            Baked each morning, pickup only. Anything you add here shows on the website too.
          </Text>
          {error ? <Banner message={error} /> : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ProductCard product={item} onOpen={() => router.push(`/product/${item.id}`)} />
        </View>
      )}
      ListEmptyComponent={
        <EmptyState title="No bakes yet" body="The counter is empty for now. Pull down to refresh." />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  column: { gap: spacing.md },
  cell: { flex: 1, marginBottom: spacing.md },
  header: { marginBottom: spacing.xl },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.caramel },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: spacing.xs },
  sub: { fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: spacing.sm },
});