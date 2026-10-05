/**
 * Google sign-in through Supabase Auth.
 *
 * This uses the SAME Supabase project and the SAME Google provider as the
 * website, so the account resolved here is the identical Supabase user the
 * website signs in. That is what keeps the server-side cart shared: the cart is
 * keyed on the Supabase user id, not on how the user authenticated.
 *
 * How it works:
 *  1. Supabase builds the Google authorisation URL (PKCE, no client secret).
 *  2. `expo-web-browser` opens it in a real browser tab / custom tab.
 *  3. Google authenticates and Supabase redirects back to this app's scheme.
 *  4. The `code` is exchanged for a session via `exchangeCodeForSession`.
 *
 * Security: no Google client id or secret is used or needed. The Supabase
 * project holds the Google OAuth credentials server-side; the app only ever
 * sees the publishable key. Nothing here can create a second identity - the
 * provider, project and resulting user id are the website's.
 *
 * REQUIREMENT: this flow needs the app's own URL scheme, which Expo Go does not
 * support. Use a development build or a standalone APK. See mobile/README.md.
 */
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Dismisses the auth browser once the redirect lands back in the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * The redirect URI Google/Supabase sends the browser back to.
 *
 * In a development build or standalone APK this resolves to
 * `korabakes://auth/callback`, using the `scheme` declared in app.json.
 */
export const GOOGLE_REDIRECT_URI = Linking.createURL('/auth/callback');

export type GoogleSignInResult = 'success' | 'cancelled';

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: GOOGLE_REDIRECT_URI,
      // Return the URL to us instead of letting the SDK try to navigate itself,
      // which is what lets openAuthSessionAsync capture the result.
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw new Error(readableOAuthError(error.message));
  if (!data.url) throw new Error('Could not start Google sign-in. Please try again.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URI);

  if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled';
  if (result.type !== 'success') throw new Error('Google sign-in did not finish.');

  const { code, oauthError } = parseRedirectUrl(result.url);
  if (oauthError) throw new Error(oauthError);
  if (!code) throw new Error('Google sign-in did not return an authorisation code.');

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new Error(readableOAuthError(exchanged.error.message));

  return 'success';
}

/**
 * Finish an OAuth redirect that arrived while the app was backgrounded or closed.
 *
 * `openAuthSessionAsync` only resolves if the app process survived. If Android
 * killed it mid-flow the deep link reopens the app and the callback route calls
 * this instead. Safe to call twice: it no-ops once a session already exists.
 */
export async function completeOAuthFromCode(code: string): Promise<boolean> {
  if (!code) return false;

  const { data } = await supabase.auth.getSession();
  if (data.session) return true;

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new Error(readableOAuthError(exchanged.error.message));
  return true;
}

/** Pull `code` / `error` out of a redirect URL, ignoring the OAuth fragment. */
function parseRedirectUrl(url: string): { code: string | null; oauthError: string | null } {
  const [withoutHash] = url.split('#');
  const query = withoutHash.includes('?') ? withoutHash.slice(withoutHash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);

  return {
    code: params.get('code'),
    oauthError: readableRedirectError({
      error: params.get('error_code') ?? params.get('error'),
      errorDescription: params.get('error_description'),
    }),
  };
}

/**
 * Turn an OAuth error into something worth showing a customer.
 *
 * The redirect case matters most: Supabase rejects an unlisted redirect URI,
 * which is the single most likely misconfiguration here, so we name it.
 */
export function readableRedirectError(input: {
  error?: string | null;
  errorDescription?: string | null;
}): string | null {
  const { error, errorDescription } = input;
  if (!error && !errorDescription) return null;

  const detail = errorDescription ?? error ?? '';
  const text = detail.toLowerCase();

  if (text.includes('access_denied')) return 'Google sign-in was cancelled.';
  if (text.includes('redirect_uri_mismatch') || text.includes('invalid_request')) {
    return (
      'Google sign-in was rejected because this redirect is not allowed. ' +
      `Add ${GOOGLE_REDIRECT_URI} to the allowed redirect URLs in Supabase.`
    );
  }
  return readableOAuthError(detail);
}

function readableOAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach Google sign-in. Check your connection.';
  }
  return message;
}