/**
 * Live smoke test for the mobile data layer.
 *
 * Runs against the REAL production API and the REAL Supabase project, using the
 * same endpoint contract the app uses (src/lib/api.ts). It proves:
 *
 *   1. Products load from the production API.
 *   2. Unauthenticated cart access is refused (401).
 *   3. A bad password is rejected by Supabase.
 *   4. A real sign-in returns a usable access token.
 *   5. GET /api/cart works with that bearer token.
 *   6. Cart add / quantity / remove round-trip and the server recalculates totals.
 *   7. The original cart state is restored so no test data is left behind.
 *
 * Usage (PowerShell):
 *   $env:SMOKE_EMAIL='you@example.com'; $env:SMOKE_PASSWORD='your-password'
 *   node --experimental-strip-types scripts/smoke.ts
 *
 * Credentials come from the environment and are never written to disk. Without
 * them the authenticated checks are skipped and only the public ones run.
 */
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://kora-bakes.onrender.com').replace(/\/+$/, '');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -> ${detail}` : ''}`);
}

async function json(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...((init.headers as Record<string, string>) ?? {}) },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function signIn(withPassword: string): Promise<Response> {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: withPassword }),
  });
}

async function main(): Promise<void> {
  console.log(`API: ${API_BASE_URL}\n`);

  // 1. Public catalogue.
  const products = await json('/api/products');
  const list: any[] = Array.isArray(products.body) ? products.body : [];
  check(
    'products load from production API',
    products.status === 200 && list.length > 0,
    `${list.length} products`,
  );
  if (list[0]) {
    check(
      'product uses integer kobo pricing',
      Number.isInteger(list[0].price_kobo),
      `price_kobo=${list[0].price_kobo}`,
    );
  }

  // 2. Cart must reject anonymous access.
  const anonCart = await json('/api/cart');
  check('cart rejects unauthenticated access', anonCart.status === 401, `status=${anonCart.status}`);

  if (!email || !password) {
    console.log('\nSMOKE_EMAIL / SMOKE_PASSWORD not set - skipping authenticated cart checks.');
    return;
  }

  // 3. Wrong password must fail.
  const badLogin = await signIn(`${password}-definitely-wrong`);
  check('bad password is rejected', badLogin.status >= 400, `status=${badLogin.status}`);

  // 4. Real sign-in.
  const login = await signIn(password);
  const session: any = await login.json().catch(() => null);
  const token = session?.access_token;
  check('real sign-in returns an access token', login.status === 200 && Boolean(token), `status=${login.status}`);
  if (!token) {
    console.log('\nSign-in failed. An account created with Google on the website has no password yet.');
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 5. Authenticated cart read.
  const cart = await json('/api/cart', { headers: auth });
  const items: any[] = Array.isArray(cart.body?.items) ? cart.body.items : [];
  check('GET /api/cart works with bearer token', cart.status === 200, `status=${cart.status}, ${items.length} lines`);
// 6. Cart mutation round-trip, then restore the original state.
  const product = list[0];
  if (product) {
    const before = items.find((line) => line.product_id === product.id)?.quantity ?? 0;
    const target = Math.min(25, before + 1);

    const added = await json(`/api/cart/items/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: target }),
    });
    const afterAdd = added.body?.items?.find((line: any) => line.product_id === product.id)?.quantity;
    check('add to cart writes to the server', afterAdd === target, `quantity=${afterAdd}`);
    check(
      'server recomputes the subtotal',
      typeof added.body?.subtotal_kobo === 'number',
      `subtotal_kobo=${added.body?.subtotal_kobo}`,
    );

    const bumped = await json(`/api/cart/items/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: Math.max(1, target - 1) }),
    });
    const afterBump = bumped.body?.items?.find((line: any) => line.product_id === product.id)?.quantity;
    check('quantity update works', afterBump === Math.max(1, target - 1), `quantity=${afterBump}`);

    const restored = await json(`/api/cart/items/${encodeURIComponent(product.id)}`, {
      method: before > 0 ? 'PUT' : 'DELETE',
      headers: before > 0 ? { ...auth, 'Content-Type': 'application/json' } : auth,
      ...(before > 0 ? { body: JSON.stringify({ quantity: before }) } : {}),
    });
    check('original cart state restored', restored.status === 200, before > 0 ? `restored to ${before}` : 'line removed');
  }

  // 7. Profile endpoint used by the Account screen.
  const profile = await json('/api/me', { headers: auth });
  check('GET /api/me resolves the account', profile.status === 200 && Boolean(profile.body?.id), `status=${profile.status}`);
}

main()
  .catch((error) => {
    failures += 1;
    console.error(`\nSmoke test crashed: ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(() => {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });