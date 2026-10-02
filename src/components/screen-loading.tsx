import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';

export function ScreenLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={Palette.safety} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.paper,
  },
});
