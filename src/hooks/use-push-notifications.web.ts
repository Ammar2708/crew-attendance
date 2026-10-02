import Constants from 'expo-constants';

import type { PushNotificationDebugStatus } from '@/types/push-notifications';

export function usePushNotifications(_userId: string) {
  const configuredProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const debugStatus: PushNotificationDebugStatus = {
    notificationPermission: 'unavailable on web',
    expoPushToken: null,
    supabaseInsert: 'not attempted',
    supabaseError: null,
    projectId: typeof configuredProjectId === 'string' ? configuredProjectId : null,
  };

  return { unregister: async () => {}, debugStatus };
}
