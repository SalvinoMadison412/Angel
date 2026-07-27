import { MockNotificationService } from "./MockNotificationService";

export * from "./NotificationService";
export * from "./MockNotificationService";

export const notificationService = new MockNotificationService();
