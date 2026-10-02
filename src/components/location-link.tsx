import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, Palette } from '@/constants/theme';

type LocationLinkProps = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

export function LocationLink({ latitude, longitude }: LocationLinkProps) {
  if (latitude == null || longitude == null) return null;

  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <Pressable
      accessibilityHint="Opens these coordinates in Google Maps"
      accessibilityRole="link"
      onPress={(event) => {
        event.stopPropagation();
        void Linking.openURL(mapsUrl);
      }}
      style={({ pressed }) => pressed && styles.pressed}>
      <Text style={styles.link}>View location</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 11, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
