import { MockNotificationService } from "./MockNotificationService";

export * from "./NotificationService";
export * from "./MockNotificationService";
export * from "./localCrashNotifications";

export const notificationService = new MockNotificationService();
