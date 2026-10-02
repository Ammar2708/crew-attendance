import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

const NOTIFICATION_ROUTES = new Set(['/dashboard', '/tasks']);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Keep the legacy flag for Android and older native builds while the
    // banner/list flags cover the current iOS presentation API.
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function openNotification(notification: Notifications.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && NOTIFICATION_ROUTES.has(url)) {
    router.push(url as Href);
  }
}

export function NotificationResponseHandler() {
  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) {
      openNotification(lastResponse.notification);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response.notification);
    });

    return () => subscription.remove();
  }, []);

  return null;
}
