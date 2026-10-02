import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { AppOwnership } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { PushNotificationDebugStatus } from '@/types/push-notifications';

const TOKEN_STORAGE_PREFIX = 'crew-attendance:expo-push-token:';

function tokenStorageKey(userId: string) {
  return `${TOKEN_STORAGE_PREFIX}${userId}`;
}

function resolveProjectId() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof projectId === 'string' ? projectId : null;
}

function createDebugStatus(): PushNotificationDebugStatus {
  return {
    notificationPermission: 'not checked',
    expoPushToken: null,
    supabaseInsert: 'not attempted',
    supabaseError: null,
    projectId: resolveProjectId(),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getPushNotificationRuntimeUnavailableReason() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unavailable on web' as const;
  if (!Device.isDevice) return 'unavailable on simulator' as const;
  // `expoGoConfig` can be the embedded app manifest in an EAS build, and
  // `executionEnvironment` also groups Expo Go with development clients.
  // `appOwnership === expo` is the native value that identifies Expo Go itself.
  if (Constants.appOwnership === AppOwnership.Expo) return 'unavailable in Expo Go' as const;
  return null;
}

function canRegisterForPushNotifications() {
  return getPushNotificationRuntimeUnavailableReason() === null;
}

function hasNotificationPermission(permissions: Notifications.NotificationPermissionsStatus) {
  if (Platform.OS !== 'ios') return permissions.granted;

  const iosStatus = permissions.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function registerPushToken(
  userId: string,
  updateDebugStatus: (update: Partial<PushNotificationDebugStatus>) => void,
) {
  const projectId = resolveProjectId();
  updateDebugStatus({
    notificationPermission: 'not checked',
    expoPushToken: null,
    supabaseInsert: 'not attempted',
    supabaseError: null,
    projectId,
  });

  console.log('[push] Registration started.', {
    userId,
    platform: Platform.OS,
    isDevice: Device.isDevice,
    appOwnership: Constants.appOwnership,
    isExpoGo: Constants.appOwnership === AppOwnership.Expo,
    executionEnvironment: Constants.executionEnvironment,
    isDevelopmentBundle: __DEV__,
  });

  const runtimeUnavailableReason = getPushNotificationRuntimeUnavailableReason();
  if (runtimeUnavailableReason) {
    updateDebugStatus({
      notificationPermission: runtimeUnavailableReason,
    });
    console.log('[push] Registration skipped: unsupported runtime.', {
      reason: runtimeUnavailableReason,
      platform: Platform.OS,
      isDevice: Device.isDevice,
      appOwnership: Constants.appOwnership,
      isExpoGo: Constants.appOwnership === AppOwnership.Expo,
      executionEnvironment: Constants.executionEnvironment,
    });
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Crew Attendance',
      importance: Notifications.AndroidImportance.HIGH,
    });
    console.log('[push] Android notification channel is ready.');
  }

  updateDebugStatus({ notificationPermission: 'checking' });
  let permissions = await Notifications.getPermissionsAsync();
  console.log('[push] Current notification permission result.', permissions);
  if (!hasNotificationPermission(permissions)) {
    console.log('[push] Requesting notification permission.');
    permissions = await Notifications.requestPermissionsAsync();
    console.log('[push] Requested notification permission result.', permissions);
  }
  const permissionGranted = hasNotificationPermission(permissions);
  updateDebugStatus({ notificationPermission: permissionGranted ? 'granted' : 'denied' });
  if (!permissionGranted) {
    console.warn('[push] Registration stopped: notification permission was not granted.');
    return;
  }

  if (!projectId) {
    console.warn('[push] Registration stopped: EAS projectId is not configured.', {
      expoConfigProjectId: Constants.expoConfig?.extra?.eas?.projectId,
      easConfigProjectId: Constants.easConfig?.projectId,
    });
    return;
  }
  console.log('[push] EAS projectId resolved.', { projectId });

  console.log('[push] Requesting Expo push token.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  updateDebugStatus({ expoPushToken: token });
  console.log('[push] Expo push token retrieved.', { token });

  updateDebugStatus({ supabaseInsert: 'checking existing token', supabaseError: null });
  console.log('[push] Checking Supabase for an existing token row.', { userId, token });
  try {
    const { data: existingToken, error: lookupError } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle<{ id: string }>();

    console.log('[push] Supabase token lookup result.', {
      existingTokenId: existingToken?.id ?? null,
      error: lookupError?.message ?? null,
    });
    if (lookupError) throw lookupError;

    if (!existingToken) {
      updateDebugStatus({ supabaseInsert: 'in progress' });
      console.log('[push] Inserting push token into Supabase.', {
        userId,
        token,
        platform: Platform.OS,
      });
      const { error: insertError } = await supabase.from('push_tokens').insert({
        user_id: userId,
        token,
        platform: Platform.OS,
      });

      console.log('[push] Supabase push token insert result.', {
        success: !insertError,
        error: insertError?.message ?? null,
        code: insertError?.code ?? null,
      });
      if (insertError) throw insertError;
      updateDebugStatus({ supabaseInsert: 'succeeded', supabaseError: null });
    } else {
      updateDebugStatus({
        supabaseInsert: 'not needed (already registered)',
        supabaseError: null,
      });
      console.log('[push] Token is already registered; no insert is needed.', {
        tokenId: existingToken.id,
      });
    }
  } catch (error) {
    updateDebugStatus({
      supabaseInsert: 'failed',
      supabaseError: getErrorMessage(error),
    });
    throw error;
  }

  await AsyncStorage.setItem(tokenStorageKey(userId), token);
  console.log('[push] Registration completed and token was stored locally.', { userId });
}

async function unregisterPushToken(userId: string) {
  if (!canRegisterForPushNotifications()) return;

  try {
    const token = await AsyncStorage.getItem(tokenStorageKey(userId));
    if (!token) return;

    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) throw error;
    await AsyncStorage.removeItem(tokenStorageKey(userId));
  } catch (error) {
    console.warn('Unable to unregister this device push token:', error);
  }
}

export function usePushNotifications(userId: string) {
  const [debugStatus, setDebugStatus] = useState<PushNotificationDebugStatus>(createDebugStatus);

  useEffect(() => {
    let isActive = true;
    const updateDebugStatus = (update: Partial<PushNotificationDebugStatus>) => {
      if (isActive) {
        setDebugStatus((current) => ({ ...current, ...update }));
      }
    };

    console.log('[push] Registration effect mounted.', { userId });
    void registerPushToken(userId, updateDebugStatus).catch((error) => {
      console.error('[push] Registration failed.', { userId, error });
    });

    return () => {
      isActive = false;
    };
  }, [userId]);

  const unregister = useCallback(() => unregisterPushToken(userId), [userId]);
  return { unregister, debugStatus };
}
