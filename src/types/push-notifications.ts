export type PushNotificationDebugStatus = {
  notificationPermission:
    | 'not checked'
    | 'checking'
    | 'granted'
    | 'denied'
    | 'unavailable on web'
    | 'unavailable on simulator'
    | 'unavailable in Expo Go';
  expoPushToken: string | null;
  supabaseInsert:
    | 'not attempted'
    | 'checking existing token'
    | 'in progress'
    | 'succeeded'
    | 'failed'
    | 'not needed (already registered)';
  supabaseError: string | null;
  projectId: string | null;
};
