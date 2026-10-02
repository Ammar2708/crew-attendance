import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AttendanceRecord = {
  id: string;
  clock_in_time: string;
};

function getLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function getCurrentCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission is required to clock in or out.');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

function fetchOpenAttendance(employeeId: string) {
  return supabase
    .from('attendance')
    .select('id, clock_in_time')
    .eq('employee_id', employeeId)
    .is('clock_out_time', null)
    .order('clock_in_time', { ascending: false })
    .limit(1)
    .maybeSingle<AttendanceRecord>();
}

export function useAttendance(employeeId: string) {
  const [openAttendance, setOpenAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadOpenAttendance = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setHasLoadError(false);

    const { data, error } = await fetchOpenAttendance(employeeId);

    if (error) {
      setErrorMessage(error.message);
      setHasLoadError(true);
    } else {
      setOpenAttendance(data);
    }

    setIsLoading(false);
  }, [employeeId]);

  useEffect(() => {
    let isCancelled = false;

    void fetchOpenAttendance(employeeId).then(({ data, error }) => {
      if (isCancelled) return;

      if (error) {
        setErrorMessage(error.message);
        setHasLoadError(true);
      } else {
        setOpenAttendance(data);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [employeeId]);

  const clockIn = useCallback(async () => {
    if (isSubmitting || openAttendance) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const coordinates = await getCurrentCoordinates();
      const now = new Date();
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          employee_id: employeeId,
          clock_in_time: now.toISOString(),
          clock_in_lat: coordinates.latitude,
          clock_in_lng: coordinates.longitude,
          date: getLocalDate(now),
        })
        .select('id, clock_in_time')
        .single<AttendanceRecord>();

      if (error) throw error;
      setOpenAttendance(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to clock in.');
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeId, isSubmitting, openAttendance]);

  const clockOut = useCallback(async () => {
    if (isSubmitting || !openAttendance) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const coordinates = await getCurrentCoordinates();
      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out_time: new Date().toISOString(),
          clock_out_lat: coordinates.latitude,
          clock_out_lng: coordinates.longitude,
        })
        .eq('id', openAttendance.id)
        .eq('employee_id', employeeId)
        .is('clock_out_time', null)
        .select('id')
        .single();

      if (error) throw error;
      setOpenAttendance(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to clock out.');
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeId, isSubmitting, openAttendance]);

  return {
    openAttendance,
    isLoading,
    isSubmitting,
    errorMessage,
    hasLoadError,
    clockIn,
    clockOut,
    retry: loadOpenAttendance,
  };
}
