import { FunctionsHttpError } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ledgerControls } from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type CreateEmployeeResponse = {
  success?: boolean;
  error?: string;
};

const PASSWORD_LENGTH = 16;
const PASSWORD_CHARACTER_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%*-_+=?',
] as const;

function secureRandomIndex(maxExclusive: number) {
  const byteLimit = 256 - (256 % maxExclusive);
  const bytes = new Uint8Array(1);

  do {
    Crypto.getRandomValues(bytes);
  } while (bytes[0] >= byteLimit);

  return bytes[0] % maxExclusive;
}

function randomCharacter(characters: string) {
  return characters[secureRandomIndex(characters.length)];
}

function generateSecurePassword() {
  const allCharacters = PASSWORD_CHARACTER_GROUPS.join('');
  const characters = PASSWORD_CHARACTER_GROUPS.map(randomCharacter);

  while (characters.length < PASSWORD_LENGTH) {
    characters.push(randomCharacter(allCharacters));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join('');
}

async function getFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = (await error.context.json()) as CreateEmployeeResponse;
      if (body.error) return body.error;
    } catch {
      // Fall back to the client error below when the response is not JSON.
    }
  }

  return error instanceof Error ? error.message : 'Unable to add the employee.';
}

export function OwnerAddEmployeeScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function submitEmployee() {
    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedPhone || !normalizedEmail || !password) {
      setErrorMessage('Enter the employee’s full name, phone, email, and password.');
      setSuccessMessage(null);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      setSuccessMessage(null);
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters for the password.');
      setSuccessMessage(null);
      return;
    }

    if (password.length > 72) {
      setErrorMessage('Use no more than 72 characters for the password.');
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data, error } = await supabase.functions.invoke<CreateEmployeeResponse>(
      'create-employee',
      {
        body: {
          full_name: normalizedName,
          phone: normalizedPhone,
          email: normalizedEmail,
          password,
        },
      },
    );

    if (error) {
      setErrorMessage(await getFunctionErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    if (!data?.success) {
      setErrorMessage(data?.error ?? 'Unable to add the employee.');
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(
      `Account created for ${normalizedEmail}. Share the email and password shown above directly with the employee.`,
    );
    setIsSubmitting(false);
  }

  function generatePassword() {
    setPassword(generateSecurePassword());
    setIsPasswordVisible(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add employee</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>New employee</Text>
            <Text style={styles.description}>
              Create their login now, then share the email and password with them directly.
            </Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              editable={!isSubmitting}
              onChangeText={setFullName}
              placeholder="Jordan Smith"
              placeholderTextColor={Palette.steel}
              returnKeyType="next"
              style={styles.input}
              textContentType="name"
              value={fullName}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              autoComplete="tel"
              editable={!isSubmitting}
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+1 555 123 4567"
              placeholderTextColor={Palette.steel}
              returnKeyType="next"
              style={styles.input}
              textContentType="telephoneNumber"
              value={phone}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="jordan@example.com"
              placeholderTextColor={Palette.steel}
              returnKeyType="next"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void submitEmployee()}
              placeholder="At least 8 characters"
              placeholderTextColor={Palette.steel}
              returnKeyType="done"
              secureTextEntry={!isPasswordVisible}
              style={[styles.input, styles.passwordInput]}
              value={password}
            />

            <View style={styles.passwordActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => setIsPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordAction, pressed && styles.pressed]}>
                <Text style={styles.passwordActionText}>
                  {isPasswordVisible ? 'Hide password' : 'Show password'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={generatePassword}
                style={({ pressed }) => [styles.passwordAction, pressed && styles.pressed]}>
                <Text style={styles.passwordActionText}>Generate password</Text>
              </Pressable>
            </View>

            <Text style={styles.passwordNote}>
              No invitation email will be sent. Ask the employee to change this password later if
              they want.
            </Text>

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
              onPress={() => void submitEmployee()}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
                isSubmitting && styles.disabled,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color={Palette.ink} />
              ) : (
                <Text style={styles.submitButtonText}>Create employee account</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  keyboardView: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    backgroundColor: Palette.paper,
  },
  back: { width: 72, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  headerTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  headerSpacer: { width: 72 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Layout.narrow,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
  },
  formCard: { backgroundColor: Palette.surface, borderTopColor: Palette.ink, borderTopWidth: 2, borderBottomColor: Palette.line, borderBottomWidth: 1, padding: 22 },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 22 },
  description: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21, marginTop: 6 },
  label: { color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 14, marginTop: 18, marginBottom: 8 },
  input: { ...ledgerControls.input },
  passwordInput: { fontFamily: Fonts.mono },
  passwordActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  passwordAction: {
    minHeight: 38,
    justifyContent: 'center',
    borderColor: Palette.line,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  passwordActionText: {
    color: Palette.ink,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  passwordNote: {
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, marginTop: 14 },
  success: { color: Palette.onSite, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20, marginTop: 14 },
  submitButton: {
    ...ledgerControls.primary,
    marginTop: 22,
  },
  submitButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.65 },
});
