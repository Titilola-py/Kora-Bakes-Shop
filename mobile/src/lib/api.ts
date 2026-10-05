/**
 * Typed client for the existing Kora Bakes FastAPI backend.
 *
 * The mobile app is a second client of the SAME API the website uses. It does
 * not introduce a second cart, a second database or a second auth system.
 *
 * Every authenticated request carries the Supabase access token as
 * `Authorization: Bearer <token>`. The backend verifies that token and derives
 * the user itself, so no user id is ever sent as the source of truth.
 */
import { supabase } from './supabase';

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://kora-bakes.onrender.com').replace(/\/+$/, '');

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price_kobo: number;
  unit: string;
  image_url: string;
  badge: string;
};

export type CartLine = {
  product_id: string;
  quantity: number;
  product: Product | null;
  line_total_kobo: number;
};

export type Cart = {
  items: CartLine[];
  item_count: number;
  subtotal_kobo: number;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
};

export type OrderItem = {
  product_id: string;
  product_name: string;
  unit_price_kobo: number;
  quantity: number;
  line_total_kobo: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  pickup_date: string;
  notes: string;
  subtotal_kobo: number;
  currency: string;
  payment_status: string;
  paid_at: string | null;
  email_status: string;
  created_at: string;
  items: OrderItem[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Resolve the current Supabase access token. Never cached so refreshes apply. */
async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = false } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await accessToken();
    if (!token) throw new ApiError('You need to be signed in to do that.', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Could not reach the bakery. Check your internet connection and try again.',
      0,
    );
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed (${response.status})`;
    throw new ApiError(detail, response.status);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const emptyCart: Cart = { items: [], item_count: 0, subtotal_kobo: 0 };

export function listProducts(): Promise<Product[]> {
  return request<Product[]>('/api/products');
}

export function getProfile(): Promise<Profile> {
  return request<Profile>('/api/me', { auth: true });
}

/**
 * The shared cart. The server is authoritative: the mobile app keeps no local
 * cart that could drift from the website.
 */
export function fetchCart(): Promise<Cart> {
  return request<Cart>('/api/cart', { auth: true }).catch((error) => {
    if (error instanceof ApiError && error.status === 401) return emptyCart;
    throw error;
  });
}

/** Add `quantity` of a product, or set an absolute quantity when passed one. */
export async function setCartQuantity(productId: string, quantity: number): Promise<Cart> {
  if (quantity <= 0) return removeCartItem(productId);
  return request<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    auth: true,
    body: { quantity },
  });
}

export function removeCartItem(productId: string): Promise<Cart> {
  return request<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function clearCart(): Promise<Cart> {
  return request<Cart>('/api/cart', { method: 'DELETE', auth: true });
}

export function listOrders(): Promise<Order[]> {
  return request<Order[]>('/api/orders', { auth: true });
}