import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AttendanceHomeScreen } from '@/components/attendance-home-screen';
import { LoginScreen } from '@/components/login-screen';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function IndexScreen() {
  const { auth_notice: authNotice } = useLocalSearchParams<{
    auth_notice?: string | string[];
  }>();
  const { session, isLoading } = useAuth();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Palette.safety} />
      </View>
    );
  }

  const notice = Array.isArray(authNotice) ? authNotice[0] : authNotice;
  const loginMessage =
    notice === 'account-already-set-up'
      ? 'Your account is already set up — please sign in.'
      : undefined;

  return session ? (
    <AttendanceHomeScreen session={session} />
  ) : (
    <LoginScreen initialSuccessMessage={loginMessage} />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
