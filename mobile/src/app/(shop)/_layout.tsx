/**
 * Signed-in shell: a bottom tab bar for Shop, Cart and Account.
 *
 * The cart tab shows a live badge from the server cart, so the count on screen
 * is always the count the backend holds.
 */
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useCart } from '@/providers/CartProvider';
import { colors } from '@/lib/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.ink : colors.inkSoft }}>{glyph}</Text>
  );
}

function CartBadge() {
  const { cart } = useCart();
  if (cart.item_count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -6,
        right: -14,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        backgroundColor: colors.cobalt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{cart.item_count}</Text>
    </View>
  );
}

export default function ShopLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon glyph="🛒" focused={focused} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} />,
        }}
      />
    </Tabs>
  );
}