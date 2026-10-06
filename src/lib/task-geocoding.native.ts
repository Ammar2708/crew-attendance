import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { AttendanceCoordinates } from '@/types/attendance';

async function ensureAndroidGeocodingPermission() {
  if (Platform.OS !== 'android') return;

  const currentPermission = await Location.getForegroundPermissionsAsync();
  if (currentPermission.status === Location.PermissionStatus.GRANTED) return;

  const requestedPermission = await Location.requestForegroundPermissionsAsync();
  if (requestedPermission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission is required by Android to look up an address.');
  }
}

export async function geocodeTaskAddress(address: string): Promise<AttendanceCoordinates> {
  await ensureAndroidGeocodingPermission();
  const [result] = await Location.geocodeAsync(address);

  if (!result) throw new Error('That address could not be found. Add more detail and try again.');

  return { latitude: result.latitude, longitude: result.longitude };
}
