/**
 * Sign in.
 *
 * Authenticates against the SAME Supabase project as the website, so the
 * account used here is the same account used on the web - which is what makes
 * the cart shared. No user id is collected: the backend reads the user from
 * the Supabase access token.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/BrandMark';
import { Button, Field } from '@/components/Button';
import { Banner } from '@/components/Feedback';
import { useAuth } from '@/providers/AuthProvider';
import { styles } from '@/styles/login';
import { spacing } from '@/lib/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, configured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        setNotice(
          needsConfirmation
            ? 'Account created. Check your email to confirm it, then sign in.'
            : 'Account created. Signing you in…',
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const configError =
    'Sign-in is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and ' +
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to mobile/.env, then restart the app.';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <BrandMark size={40} />
          <View>
            <Text style={styles.brand}>Kora Bakes</Text>
            <Text style={styles.tagline}>Bread, pastry and cake</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </Text>
          <Text style={styles.subtitle}>
            Use the same email address you use on the website and your basket comes with you.
          </Text>

          {!configured ? <Banner message={configError} /> : null}
          {error ? <Banner message={error} /> : null}
          {notice ? <Banner tone="success" message={notice} /> : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            testID="login-email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            testID="login-password"
          />

          <Button
            label={mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={handleSubmit}
            busy={busy}
            disabled={!configured}
            testID="login-submit"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'signin' ? 'No account yet?' : 'Already have an account?'}
            </Text>
            <Text
              accessibilityRole="link"
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setNotice(null);
              }}
              style={styles.switchAction}
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Your cart is saved to your account, so the website and this app always show the same
          basket.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}