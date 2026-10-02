import { useState } from 'react';
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
import {
  AUTH_CALLBACK_URL,
  supabase,
  supabaseConfigurationError,
} from '@/lib/supabase';

type LoginScreenProps = {
  initialSuccessMessage?: string;
};

export function LoginScreen({ initialSuccessMessage }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    initialSuccessMessage ?? null,
  );

  async function handleLogin() {
    if (supabaseConfigurationError) {
      setErrorMessage(supabaseConfigurationError.message);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    if (supabaseConfigurationError) {
      setErrorMessage(supabaseConfigurationError.message);
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: AUTH_CALLBACK_URL,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Check your email for a password reset link.');
  }

  function toggleResetMode() {
    setIsResetMode((current) => !current);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPassword('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Crew attendance</Text>
          <Text style={styles.title}>{isResetMode ? 'Reset password' : 'Welcome back'}</Text>
          <Text style={styles.subtitle}>
            {isResetMode
              ? 'We’ll email a secure link that opens directly in this app.'
              : 'Sign in to clock in or out for your shift.'}
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                editable={!isSubmitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={Palette.steel}
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            {!isResetMode ? (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!isSubmitting}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleLogin()}
                  placeholder="Password"
                  placeholderTextColor={Palette.steel}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>
            ) : null}

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            {successMessage ? (
              <Text accessibilityRole="alert" style={styles.success}>
                {successMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void (isResetMode ? handlePasswordReset() : handleLogin())}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color={Palette.ink} />
              ) : (
                <Text style={styles.buttonText}>
                  {isResetMode ? 'Send reset link' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={toggleResetMode}
              style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}>
              <Text style={styles.linkText}>
                {isResetMode ? 'Back to sign in' : 'Forgot password?'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.paper,
  },
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
  title: {
    color: Palette.ink,
    fontFamily: Fonts.sansBold,
    fontSize: 32,
  },
  subtitle: {
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  form: {
    gap: 18,
    marginTop: 32,
  },
  field: {
    gap: 8,
  },
  label: {
    color: Palette.ink,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
  },
  input: {
    ...ledgerControls.input,
  },
  error: {
    color: Palette.alert,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: Palette.onSite,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    ...ledgerControls.primary,
    minHeight: 52,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Palette.ink,
    fontFamily: Fonts.sansBold,
    fontSize: 16,
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkButtonPressed: {
    opacity: 0.65,
  },
  linkText: {
    color: Palette.steel,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
