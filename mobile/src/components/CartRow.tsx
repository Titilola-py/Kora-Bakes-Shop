/** A single line in the cart, with its quantity stepper and remove control. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { QuantityStepper } from '@/components/Feedback';
import { useCart } from '@/providers/CartProvider';
import type { CartLine } from '@/lib/api';
import { colors, formatMoney, radius, spacing } from '@/lib/theme';

export function CartRow({ line }: { line: CartLine }) {
  const router = useRouter();
  const { updateQuantity, removeItem, isMutating } = useCart();
  const product = line.product;
  const name = product?.name ?? line.product_id;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${name}`}
        onPress={() => product && router.push(`/product/${product.id}`)}
        style={styles.thumbWrap}
      >
        {product ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbMissing]} />
        )}
      </Pressable>

      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <View style={styles.rowTitles}>
            <Text style={styles.rowName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.rowUnit}>{product?.unit ?? 'No longer available'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
            disabled={isMutating}
            onPress={() => void removeItem(line.product_id)}
            style={styles.removeButton}
          >
            <Text style={styles.removeGlyph}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.rowBottom}>
          <QuantityStepper
            quantity={line.quantity}
            disabled={isMutating}
            onChange={(next) => void updateQuantity(line.product_id, next)}
          />
          <Text style={styles.lineTotal}>{formatMoney(line.line_total_kobo)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  thumbWrap: { width: 78, height: 78, borderRadius: radius.sm, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbMissing: { backgroundColor: colors.line },
  rowMain: { flex: 1, justifyContent: 'space-between' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowTitles: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowUnit: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  removeButton: { padding: 6 },
  removeGlyph: { fontSize: 14, color: colors.inkMuted },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  lineTotal: { fontSize: 15, fontWeight: '800', color: colors.ink },
});