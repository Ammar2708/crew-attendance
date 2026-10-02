import {
  CardStyleInterpolators,
  Stack,
  type StackNavigationOptions,
} from 'expo-router/js-stack';
import { Easing } from 'react-native';

import { Motion, Palette } from '@/constants/theme';

const transition = {
  animation: 'timing' as const,
  config: {
    duration: Motion.screen,
    easing: Easing.out(Easing.cubic),
  },
};

const screenOptions: StackNavigationOptions = {
  cardStyle: { backgroundColor: Palette.paper },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureDirection: 'horizontal',
  // Expo Router locks body overflow on web. Keeping the card viewport-bound
  // lets each screen's ScrollView/FlatList own scrolling instead of the body.
  headerMode: 'float',
  headerShown: false,
  cardShadowEnabled: false,
  transitionSpec: { open: transition, close: transition },
};

/** The native stack does not animate on web, so use Expo Router's supported JS stack fallback. */
export function NavigationStack() {
  return <Stack screenOptions={screenOptions} />;
}
