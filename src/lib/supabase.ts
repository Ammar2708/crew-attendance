import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const AUTH_CALLBACK_URL = 'crewattendance://auth-callback';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? new Error(
        'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in this build environment.',
      )
    : null;

// Keep configuration mistakes from crashing the app while Expo Router discovers
// route modules. Auth screens surface supabaseConfigurationError before any request.
export const supabase = createClient(
  supabaseUrl ?? 'https://missing-configuration.invalid',
  supabaseAnonKey ?? 'missing-anon-key',
  {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
