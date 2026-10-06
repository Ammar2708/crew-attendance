import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';

import { Fonts, Palette, Radius } from '@/constants/theme';
import type { AttendanceCoordinates } from '@/types/attendance';

import type { TaskLocationMapProps } from './task-location-map.types';

const DEFAULT_REGION = {
  latitude: 24.8607,
  longitude: 67.0011,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

export function TaskLocationMap({
  employeeLocations,
  onSelectTaskLocation,
  taskLocation,
}: TaskLocationMapProps) {
  const mapRef = useRef<MapView>(null);
  const coordinates = useMemo(
    () => [
      ...employeeLocations.map((employee) => employee.coordinate),
      ...(taskLocation ? [taskLocation] : []),
    ],
    [employeeLocations, taskLocation],
  );

  useEffect(() => {
    if (coordinates.length === 0) return;
    mapRef.current?.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 52, right: 52, bottom: 52, left: 52 },
    });
  }, [coordinates]);

  function selectTaskLocation(event: MapPressEvent) {
    const coordinate: AttendanceCoordinates = {
      latitude: event.nativeEvent.coordinate.latitude,
      longitude: event.nativeEvent.coordinate.longitude,
    };
    onSelectTaskLocation(coordinate);
  }

  return (
    <View style={styles.frame}>
      <MapView
        initialRegion={DEFAULT_REGION}
        onPress={selectTaskLocation}
        ref={mapRef}
        style={styles.map}>
        {employeeLocations.map((employee) => (
          <Marker
            accessibilityLabel={`${employee.name}, location as of last clock-in`}
            anchor={{ x: 0.5, y: 1 }}
            coordinate={employee.coordinate}
            description="As of their last clock-in"
            key={employee.id}
            stopPropagation
            title={employee.name}>
            <View style={styles.employeeMarker}>
              <View style={styles.employeeLabel}>
                <Text numberOfLines={1} style={styles.employeeLabelText}>
                  {employee.name}
                </Text>
              </View>
              <View style={styles.employeePin} />
            </View>
          </Marker>
        ))}
        {taskLocation ? (
          <Marker
            coordinate={taskLocation}
            description="Tap elsewhere on the map to move it"
            pinColor={Palette.safety}
            stopPropagation
            title="Task location"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 310,
    overflow: 'hidden',
    borderColor: Palette.line,
    borderRadius: Radius.control,
    borderWidth: 1,
    backgroundColor: Palette.paper,
  },
  map: { flex: 1 },
  employeeMarker: { alignItems: 'center', maxWidth: 150 },
  employeeLabel: {
    maxWidth: 150,
    borderColor: Palette.ink,
    borderRadius: Radius.stamp,
    borderWidth: 1,
    backgroundColor: Palette.surface,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  employeeLabelText: {
    color: Palette.ink,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
  },
  employeePin: {
    width: 15,
    height: 15,
    marginTop: 3,
    borderColor: Palette.surface,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: Palette.onSite,
  },
});
