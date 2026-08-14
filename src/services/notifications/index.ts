import { MockNotificationService } from "./MockNotificationService";

export * from "./NotificationService";
export * from "./MockNotificationService";
export * from "./localCrashNotifications";
export * from "./angelAlerts";
export * from "./inAppAlertBus";
export * from "./countdownNotification";

export const notificationService = new MockNotificationService();
