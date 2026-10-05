/**
 * OAuth redirect landing route.
 *
 * `openAuthSessionAsync` normally captures the Google redirect by itself. This
 * route is the safety net for the case where Android killed the app while the
 * browser was open: the `korabakes://auth/callback` deep link reopens the app
 * here instead, and we finish the PKCE exchange before continuing.
 *
 * It never renders a "sign-in page" - it exists purely to complete the handshake.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Loading } from '@/components/Feedback';
import { Banner } from '@/components/Feedback';
import { completeOAuthFromCode, readableRedirectError } from '@/lib/googleAuth';
import { colors } from '@/lib/theme';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const pick = (key: string): string | undefined => {
      const value = params[key];
      return Array.isArray(value) ? value[0] : value;
    };

    const finish = async () => {
      try {
        const redirectError = readableRedirectError({
          error: pick('error_code') ?? pick('error'),
          errorDescription: pick('error_description'),
        });
        if (redirectError) throw new Error(redirectError);

        const code = pick('code');
        if (code) await completeOAuthFromCode(code);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Sign-in could not be completed.');
        return;
      }

      if (active) router.replace('/');
    };

    void finish();

    return () => {
      active = false;
    };
    // Runs once per redirect; the deep link supplies new params if repeated.
  }, [params, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 }}>
      <Stack.Screen options={{ headerShown: false }} />
      {error ? <Banner message={error} /> : <Loading label="Finishing Google sign-in…" />}
    </View>
  );
}