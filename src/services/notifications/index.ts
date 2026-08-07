import { MockNotificationService } from "./MockNotificationService";

export * from "./NotificationService";
export * from "./MockNotificationService";
export * from "./localCrashNotifications";
export * from "./activeMonitoringNotification";

export const notificationService = new MockNotificationService();
