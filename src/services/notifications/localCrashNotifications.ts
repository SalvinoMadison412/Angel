import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { CrashEvent } from "../bluetooth";

// This is the rider's OWN phone waking up to a crash the sensor just
// detected — distinct from NotificationService above, which is about
// alerting guardians. Local-only (no push server): the BLE listener that
// already receives crash events schedules these directly.
const CRASH_CHANNEL_ID = "crash-alerts";

// Notification `data` payloads are plain JSON — CrashEvent is already all
// primitives, so it round-trips through Notifications.scheduleNotificationAsync
// -> response.notification.request.content.data unchanged.
export interface CrashNotificationData extends CrashEvent {
  kind: "crash";
}

function isCrashNotificationData(value: unknown): value is CrashNotificationData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "crash" && typeof v.severity === "number" && typeof v.receivedAt === "number";
}

/** Must run before requesting POST_NOTIFICATIONS — Android reads the channel's importance/vibration at request time. */
export async function configureCrashNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CRASH_CHANNEL_ID, {
    name: "Crash alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: "#FF5722",
    sound: "default",
  });
}

export async function requestCrashNotificationPermission(): Promise<void> {
  await configureCrashNotificationChannel();
  await Notifications.requestPermissionsAsync();
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Fires a high-priority local notification for a crash event received while
 * the app isn't in the foreground (foreground crashes navigate straight to
 * the alert screen instead — see CrashDetectorListener). No foreground
 * service backs this: if Android has already suspended/killed the process
 * by the time the sensor sends the packet, nothing fires until the app is
 * reopened — that's a known limitation of this approach, not a bug.
 */
export async function presentCrashNotification(event: CrashEvent): Promise<void> {
  // Untyped as Record<string, unknown> to satisfy NotificationContentInput's
  // data field — isCrashNotificationData() below re-validates the shape on
  // the way back out, so nothing downstream trusts this cast blindly.
  const data: Record<string, unknown> = { ...event, kind: "crash" };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⚠ Crash detected",
      body: "Tap to check in before guardians are alerted.",
      data,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    // ChannelAwareTriggerInput — delivers immediately (like trigger: null)
    // but, unlike null, actually applies our high-importance channel
    // (vibration pattern, MAX importance) instead of falling back to a
    // default one.
    trigger: Platform.OS === "android" ? { channelId: CRASH_CHANNEL_ID } : null,
  });
}

/** Extracts the CrashEvent out of a tapped notification's payload, or null if it wasn't one of ours. */
export function crashEventFromNotificationResponse(
  response: Notifications.NotificationResponse | null
): CrashEvent | null {
  const data = response?.notification.request.content.data;
  if (!isCrashNotificationData(data)) return null;
  const { kind, ...event } = data;
  return event;
}
