import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius } from '@/constants/theme';

import type { TaskLocationMapProps } from './task-location-map.types';

export function TaskLocationMap({ employeeLocations, taskLocation }: TaskLocationMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.title}>Employee location map</Text>
      <Text style={styles.copy}>
        The interactive map is available in the iOS and Android app. On web, use the address
        lookup above to set the task location.
      </Text>
      <Pressable
        accessibilityHint="Opens the OpenStreetMap copyright page"
        accessibilityRole="link"
        onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}>
        <Text style={styles.attribution}>Address search © OpenStreetMap contributors</Text>
      </Pressable>
      {taskLocation ? (
        <Text style={styles.taskPoint}>
          Task point: {taskLocation.latitude.toFixed(5)}, {taskLocation.longitude.toFixed(5)}
        </Text>
      ) : null}
      {employeeLocations.length === 0 ? (
        <Text style={styles.empty}>No employees are currently clocked in.</Text>
      ) : (
        <View style={styles.list}>
          {employeeLocations.map((employee) => (
            <View key={employee.id} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.name}>{employee.name}</Text>
              <Text style={styles.coordinate}>
                {employee.coordinate.latitude.toFixed(4)}, {employee.coordinate.longitude.toFixed(4)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderColor: Palette.line,
    borderRadius: Radius.control,
    borderWidth: 1,
    backgroundColor: Palette.paper,
    padding: 16,
  },
  title: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  copy: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 4 },
  attribution: {
    alignSelf: 'flex-start',
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  taskPoint: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 12, marginTop: 12 },
  list: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopColor: Palette.line, borderTopWidth: 1, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.onSite },
  name: { flex: 1, color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 14 },
  coordinate: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 11 },
  empty: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, marginTop: 12 },
});
