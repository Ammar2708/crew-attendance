import type { AttendanceCoordinates } from '@/types/attendance';
import { supabase } from '@/lib/supabase';

type GeocodeResponse = {
  latitude?: number;
  longitude?: number;
  error?: string;
};

const resultCache = new Map<string, AttendanceCoordinates>();

export async function geocodeTaskAddress(address: string): Promise<AttendanceCoordinates> {
  const cacheKey = address.trim().toLocaleLowerCase();
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in again to look up an address.');

  const query = new URLSearchParams({ q: address });
  const response = await fetch(`/api/geocode?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const result = (await response.json().catch(() => ({}))) as GeocodeResponse;
  if (response.status === 404) {
    throw new Error('That address could not be found. Add more detail and try again.');
  }
  if (!response.ok) {
    throw new Error(result.error ?? 'Address lookup is temporarily unavailable. Try again shortly.');
  }

  const coordinate = { latitude: Number(result.latitude), longitude: Number(result.longitude) };
  if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
    throw new Error('The address service returned an invalid location. Try again shortly.');
  }

  resultCache.set(cacheKey, coordinate);
  return coordinate;
}

export async function reverseGeocodeTaskLocation(_coordinate: AttendanceCoordinates) {
  return null;
}
