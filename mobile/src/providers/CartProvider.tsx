/**
 * Server cart provider.
 *
 * The server is the single source of truth for the cart. There is deliberately
 * NO local cart here: whatever `GET /api/cart` returns is what the screens
 * render, and every mutation goes back through the same API the website uses.
 * That is what makes the website and mobile show the same cart.
 *
 * A refresh trigger lets screens re-pull the cart after an action or when the
 * app comes back to the foreground.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetchCart, removeCartItem, setCartQuantity, clearCart } from '@/lib/api';
import type { Cart } from '@/lib/api';
import { useAuth } from './AuthProvider';

type CartContextValue = {
  cart: Cart;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  quantityOf: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY: Cart = { items: [], item_count: 0, subtotal_kobo: 0 };

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [cart, setCart] = useState<Cart>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCart(EMPTY);
      return;
    }
    setIsLoading(true);
    try {
      const next = await fetchCart();
      if (mounted.current) setCart(next);
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : 'Could not load your cart.');
      }
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [userId]);

  // Load the server cart whenever the signed-in user changes. Signing in is
  // what pulls in whatever the website put in the cart.
  useEffect(() => {
    setCart(EMPTY);
    setError(null);
    if (userId) void refresh();
  }, [userId, refresh]);

  // Re-pull when the app returns to the foreground, so a cart changed on the
  // website shows up when the user switches back to the app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) void refresh();
    });
    return () => subscription.remove();
  }, [userId, refresh]);

  const mutate = useCallback(
    async (action: () => Promise<Cart>) => {
      setIsMutating(true);
      setError(null);
      try {
        // The API returns the whole recalculated cart, so the UI always shows
        // server-computed quantities and totals rather than a local guess.
        const next = await action();
        if (mounted.current) setCart(next);
      } catch (caught) {
        if (mounted.current) {
          setError(caught instanceof Error ? caught.message : 'Something went wrong.');
        }
        if (mounted.current) void refresh();
      } finally {
        if (mounted.current) setIsMutating(false);
      }
    },
    [refresh],
  );

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      const current = cart.items.find((line) => line.product_id === productId)?.quantity ?? 0;
      const next = Math.min(25, current + quantity);
      await mutate(() => setCartQuantity(productId, next));
    },
    [cart.items, mutate],
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      await mutate(() => setCartQuantity(productId, quantity));
    },
    [mutate],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      await mutate(() => removeCartItem(productId));
    },
    [mutate],
  );

  const clear = useCallback(async () => {
    await mutate(() => clearCart());
  }, [mutate]);

  const quantityOf = useCallback(
    (productId: string) => cart.items.find((line) => line.product_id === productId)?.quantity ?? 0,
    [cart.items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ cart, isLoading, isMutating, error, refresh, addItem, updateQuantity, removeItem, clear, quantityOf }),
    [cart, isLoading, isMutating, error, refresh, addItem, updateQuantity, removeItem, clear, quantityOf],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}