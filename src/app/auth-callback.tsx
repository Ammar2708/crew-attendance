import type { EmailOtpType } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ledgerControls } from '@/components/site-ledger-ui';
import { Fonts, Palette } from '@/constants/theme';

type CallbackState = 'verifying' | 'ready' | 'saving' | 'success' | 'error';

type CallbackRouteParams = {
  '#': string | string[];
  account_check: string | string[];
  access_token: string | string[];
  code: string | string[];
  error: string | string[];
  error_code: string | string[];
  error_description: string | string[];
  refresh_token: string | string[];
  token_hash: string | string[];
  type: string | string[];
};

const emailOtpTypes: EmailOtpType[] = [
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isEmailOtpType(value: string): value is EmailOtpType {
  return emailOtpTypes.includes(value as EmailOtpType);
}

function isUsedOrExpiredLinkError(code: string | null, message: string) {
  if (code?.toLowerCase() === 'otp_expired') return true;

  return /already[\s_-]*(?:been[\s_-]*)?(?:confirmed|used)|(?:invalid|expired).*(?:otp|link)|(?:otp|link).*(?:invalid|expired)/i.test(
    message,
  );
}

export default function AuthCallbackScreen() {
  const routeParams = useLocalSearchParams<CallbackRouteParams>();
  const fragment = firstParam(routeParams['#']);
  const queryAccountCheck = firstParam(routeParams.account_check);
  const queryAccessToken = firstParam(routeParams.access_token);
  const queryCode = firstParam(routeParams.code);
  const queryError = firstParam(routeParams.error);
  const queryErrorCode = firstParam(routeParams.error_code);
  const queryErrorDescription = firstParam(routeParams.error_description);
  const queryRefreshToken = firstParam(routeParams.refresh_token);
  const queryTokenHash = firstParam(routeParams.token_hash);
  const queryType = firstParam(routeParams.type);
  const [callbackState, setCallbackState] = useState<CallbackState>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let isActive = true;

    async function createSession() {
      setCallbackState('verifying');
      setErrorMessage(null);

      try {
        // Expo Router exposes the URL fragment under the special "#" parameter.
        // Supabase implicit-flow links put tokens there; PKCE links use the query.
        const fragmentParams = new URLSearchParams(fragment ?? '');
        const readParam = (name: string, queryValue?: string) =>
          queryValue ?? fragmentParams.get(name);
        const authError =
          readParam('error_description', queryErrorDescription) ??
          readParam('error', queryError);

        async function redirectIfAccountIsAlreadySetUp(errorCode: string | null, message: string) {
          const accountCheck = readParam('account_check', queryAccountCheck);
          if (!accountCheck || !isUsedOrExpiredLinkError(errorCode, message)) return false;

          const { supabase, supabaseConfigurationError } = await import('@/lib/supabase');
          if (supabaseConfigurationError) throw supabaseConfigurationError;

          const { data, error } = await supabase.rpc('is_auth_callback_account_set_up', {
            account_check_token: accountCheck,
          });

          if (error || data !== true || !isActive) return false;

          router.replace({ pathname: '/', params: { auth_notice: 'account-already-set-up' } });
          return true;
        }

        if (authError) {
          const errorCode = readParam('error_code', queryErrorCode);
          const readableAuthError = authError.replace(/\+/g, ' ');
          if (await redirectIfAccountIsAlreadySetUp(errorCode, readableAuthError)) return;

          if (isActive) {
            setErrorMessage(readableAuthError);
            setCallbackState('error');
          }
          return;
        }

        const accessToken = readParam('access_token', queryAccessToken);
        const refreshToken = readParam('refresh_token', queryRefreshToken);
        const tokenHash = readParam('token_hash', queryTokenHash);
        const type = readParam('type', queryType);
        const code = readParam('code', queryCode);
        const { supabase, supabaseConfigurationError } = await import('@/lib/supabase');
        if (supabaseConfigurationError) throw supabaseConfigurationError;

        let sessionError: Error | null = null;

        if (tokenHash && type && isEmailOtpType(type)) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          sessionError = error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          sessionError = error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          sessionError = error;
        } else {
          sessionError = new Error('This sign-in link is incomplete or has already been used.');
        }

        if (!isActive) return;

        if (sessionError) {
          const errorCode = 'code' in sessionError ? String(sessionError.code) : null;
          if (await redirectIfAccountIsAlreadySetUp(errorCode, sessionError.message)) return;

          setErrorMessage(sessionError.message);
          setCallbackState('error');
        } else {
          setCallbackState('ready');
        }
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to open this sign-in link.');
        setCallbackState('error');
      }
    }

    void createSession();

    return () => {
      isActive = false;
    };
  }, [
    fragment,
    queryAccountCheck,
    queryAccessToken,
    queryCode,
    queryError,
    queryErrorCode,
    queryErrorDescription,
    queryRefreshToken,
    queryTokenHash,
    queryType,
  ]);

  async function handleSetPassword() {
    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters for your password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setCallbackState('saving');
    setErrorMessage(null);

    try {
      const { supabase, supabaseConfigurationError } = await import('@/lib/supabase');
      if (supabaseConfigurationError) throw supabaseConfigurationError;
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        setCallbackState('ready');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setCallbackState('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save your password.');
      setCallbackState('ready');
    }
  }

  const isBusy = callbackState === 'verifying' || callbackState === 'saving';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Crew attendance</Text>

          {callbackState === 'verifying' ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator color={Palette.safety} size="large" />
              <Text style={styles.title}>Checking your link</Text>
              <Text style={styles.subtitle}>This should only take a moment.</Text>
            </View>
          ) : null}

          {callbackState === 'ready' || callbackState === 'saving' ? (
            <>
              <Text style={styles.title}>Set your password</Text>
              <Text style={styles.subtitle}>
                Choose the password you’ll use to sign in to Crew Attendance.
              </Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>New password</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!isBusy}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    placeholderTextColor={Palette.steel}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!isBusy}
                    onChangeText={setConfirmPassword}
                    onSubmitEditing={() => void handleSetPassword()}
                    placeholder="Enter it again"
                    placeholderTextColor={Palette.steel}
                    returnKeyType="done"
                    secureTextEntry
                    style={styles.input}
                    value={confirmPassword}
                  />
                </View>

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {errorMessage}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => void handleSetPassword()}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    isBusy && styles.buttonDisabled,
                  ]}>
                  {callbackState === 'saving' ? (
                    <ActivityIndicator color={Palette.ink} />
                  ) : (
                    <Text style={styles.buttonText}>Save password</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}

          {callbackState === 'success' ? (
            <View style={styles.centeredContent}>
              <Text style={styles.successMark}>✓</Text>
              <Text style={styles.title}>Password saved</Text>
              <Text style={styles.subtitle}>Your account is ready to use.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
                <Text style={styles.buttonText}>Continue to the app</Text>
              </Pressable>
            </View>
          ) : null}

          {callbackState === 'error' ? (
            <View style={styles.centeredContent}>
              <Text style={styles.title}>Link not available</Text>
              <Text accessibilityRole="alert" style={styles.errorCentered}>
                {errorMessage}
              </Text>
              <Text style={styles.subtitle}>
                Invite and reset links can expire or be used only once. Ask for a new link and try
                again.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.secondaryButtonText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  eyebrow: {
    color: Palette.steel,
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    marginBottom: 12,
  },
  title: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 30, textAlign: 'center' },
  subtitle: {
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center',
  },
  centeredContent: { alignItems: 'center', gap: 10 },
  form: { gap: 18, marginTop: 28 },
  field: { gap: 8 },
  label: { color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 14 },
  input: { ...ledgerControls.input },
  error: { color: Palette.alert, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20 },
  errorCentered: {
    color: Palette.alert,
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  successMark: { color: Palette.onSite, fontFamily: Fonts.sansBold, fontSize: 48 },
  button: { ...ledgerControls.primary, minHeight: 52, alignSelf: 'stretch', marginTop: 8 },
  secondaryButton: {
    ...ledgerControls.secondary,
    alignSelf: 'stretch',
    marginTop: 14,
  },
  buttonPressed: { transform: [{ translateY: 2 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  secondaryButtonText: { ...ledgerControls.secondaryText },
});
