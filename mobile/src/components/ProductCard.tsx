/** A single product tile in the shop grid. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useCart } from '@/providers/CartProvider';
import type { Product } from '@/lib/api';
import { colors, formatMoney, radius, spacing } from '@/lib/theme';

export function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const { addItem, quantityOf, isMutating } = useCart();
  const inCart = quantityOf(product.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatMoney(product.price_kobo)}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: product.image_url }} style={styles.image} contentFit="cover" transition={200} />
        {product.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unit}>{product.unit}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.price} numberOfLines={1}>
            {formatMoney(product.price_kobo)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.name} to cart`}
            disabled={isMutating}
            onPress={(event) => {
              // Keep the card press from also opening the detail screen.
              event.stopPropagation();
              void addItem(product.id, 1);
            }}
            style={({ pressed }) => [styles.addButton, pressed && styles.cardPressed]}
          >
            <Text style={styles.addButtonText}>{inCart > 0 ? `In cart · ${inCart}` : 'Add'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.7 },
  imageWrap: { height: 132, backgroundColor: colors.cobaltSoft },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: spacing.md },
  category: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', textTransform: 'uppercase' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  unit: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  price: { fontSize: 14, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  addButton: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});