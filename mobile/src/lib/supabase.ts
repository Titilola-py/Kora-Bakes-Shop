/**
 * Supabase client for the Kora Bakes mobile app.
 *
 * This uses the SAME Supabase project as the website, so signing in here
 * produces the same user id - which is what makes the server-side cart shared
 * between web and mobile.
 *
 * Security: only the publishable (anon) key is used. It is designed to be
 * public and is safe in a client bundle. The service-role key, the database
 * password and the Mailgun key stay on the server and must never be added to
 * this file or to any EXPO_PUBLIC_* variable.
 */
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    // Authorization Code + PKCE, matching the website's client. Required for the
    // Google OAuth redirect, which returns a `code` rather than tokens in the
    // URL fragment. Email/password sign-in is unaffected by this setting.
    flowType: 'pkce',
    autoRefreshToken: true,
    // Keeps the session on the device between app launches, so a signed-in
    // user is not asked to sign in again.
    persistSession: true,
    // Native apps receive the OAuth result through an explicit redirect we
    // handle ourselves, not by sniffing window.location.
    detectSessionInUrl: false,
  },
});

// Keep the access token fresh while the app is in the foreground, and stop
// refreshing in the background to save battery. Registered exactly once.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}