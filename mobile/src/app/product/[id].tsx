/**
 * Product detail.
 *
 * The product comes from the same `/api/products` catalogue the website uses.
 * Adding to the basket writes to the shared server cart, so the quantity shown
 * here reflects what is actually on the account.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Banner, Loading, QuantityStepper } from '@/components/Feedback';
import { useCart } from '@/providers/CartProvider';
import { listProducts } from '@/lib/api';
import type { Product } from '@/lib/api';
import { colors, formatMoney, radius, spacing } from '@/lib/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState(1);

  const { addItem, updateQuantity, quantityOf, isMutating } = useCart();
  const inCart = product ? quantityOf(product.id) : 0;

  useEffect(() => {
    let active = true;
    void listProducts()
      .then((products) => {
        if (!active) return;
        const match = products.find((item) => item.id === id) ?? null;
        setProduct(match);
        if (!match) setError('That bake is no longer on the counter.');
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load this bake.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Loading label="Loading…" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
    >
      <Stack.Screen options={{ title: product?.name ?? 'Product' }} />

      {product ? (
        <>
          <Image
            source={{ uri: product.image_url }}
            style={styles.hero}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.body}>
            {product.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{product.badge}</Text>
              </View>
            ) : null}

            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.description}>{product.description}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(product.price_kobo)}</Text>
              <Text style={styles.unit}>per {product.unit}</Text>
            </View>

            <View style={styles.addRow}>
              <QuantityStepper quantity={toAdd} disabled={isMutating} onChange={setToAdd} />
              <View style={styles.addButton}>
                <Button
                  label={inCart > 0 ? 'Add another' : 'Add to basket'}
                  testID="add-to-cart"
                  busy={isMutating}
                  disabled={!product}
                  onPress={() => {
                    void addItem(product!.id, toAdd);
                    setToAdd(1);
                  }}
                />
              </View>
            </View>

            {inCart > 0 ? (
              <View style={styles.inCart}>
                <Text style={styles.inCartText}>{inCart} already in your basket</Text>
                <QuantityStepper
                  quantity={inCart}
                  disabled={isMutating}
                  onChange={(next) => void updateQuantity(product.id, next)}
                />
              </View>
            ) : null}

            {error ? <Banner message={error} /> : null}
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.name}>Not found</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  hero: { width: '100%', height: 280, backgroundColor: colors.cobaltSoft },
  body: { padding: spacing.lg },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  category: { fontSize: 12, color: colors.inkSoft, fontWeight: '700', textTransform: 'uppercase' },
  name: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: spacing.xs },
  description: { fontSize: 15, lineHeight: 23, color: colors.inkMuted, marginTop: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.lg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  addButton: { flex: 1 },
  price: { fontSize: 24, fontWeight: '800', color: colors.ink },
  unit: { fontSize: 14, color: colors.inkMuted },
  inCart: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
  },
  inCartText: { fontSize: 14, color: colors.inkMuted },
});