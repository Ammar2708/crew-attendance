import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Motion, Palette } from '@/constants/theme';

/** Native navigation keeps the platform gesture while using a short ledger-like slide. */
export function NavigationStack() {
  return (
    <Stack
      screenOptions={{
        animation: Platform.OS === 'ios' ? 'simple_push' : 'slide_from_right',
        animationDuration: Motion.screen,
        contentStyle: { backgroundColor: Palette.paper },
        headerShown: false,
      }}
    />
  );
}
