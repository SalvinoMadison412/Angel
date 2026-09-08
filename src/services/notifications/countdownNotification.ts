// The cancel-from-notification countdown alert. Distinct from both
// localCrashNotifications.ts's "tap to check in" notification (fires once,
// no ticking, no action button) and angelAlerts.ts's "guardian alert sent"
// confirmation (fires once the countdown is already over) — this one is
// live for the *entire* countdown window, updates every second, and lets a
// rider cancel without ever opening the app.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANGEL_ACCENT_COLOR } from "./angelAlerts";

const CRASH_CHANNEL_ID = "angel-safety-alerts-crash";
const COUNTDOWN_NOTIFICATION_ID = "angel-countdown-alert";
const CANCEL_CATEGORY_ID = "angel-countdown-cancel";
export const CANCEL_ALERT_ACTION_ID = "CANCEL_ALERT";

/**
 * Registers the "CANCEL ALERT" action button. Must run before a notification
 * referencing this category is scheduled — call alongside the channel setup
 * at app bootstrap (see RootNavigator), not just once during the first-launch
 * permissions gate, since a category has to exist on every cold start, not
 * only the first one.
 *
 * `opensAppToForeground: false` is deliberate — the whole point of this
 * button is cancelling *without* having to open the app (a locked-screen
 * rider shouldn't have to unlock their phone just to say "I'm ok"). Per
 * expo-notifications' own docs this still reaches a *backgrounded* app's
 * response listener; it only stops working if the process was fully killed,
 * which is the same known limitation the rest of this notification system
 * already lives with (no true Android foreground service backs any of it).
 */
export async function configureCountdownNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CANCEL_CATEGORY_ID, [
    {
      identifier: CANCEL_ALERT_ACTION_ID,
      buttonTitle: "CANCEL ALERT",
      options: { isDestructive: true, opensAppToForeground: false },
    },
  ]);
}

function countdownBody(secondsLeft: number, totalSeconds: number): string {
  const n = Math.max(0, Math.round(secondsLeft));
  const unit = n === 1 ? "second" : "seconds";
  // The very first post spells out what CANCEL does; every tick after that
  // is just the updated count, so the notification doesn't repeat the same
  // sentence every second.
  if (secondsLeft >= totalSeconds) {
    return `Alerting your guardians in ${n} ${unit}. Tap CANCEL to stop.`;
  }
  return `Alerting your guardians in ${n} ${unit}…`;
}

/**
 * Posts (or, called again with the same identifier, updates in place) the
 * ticking countdown notification — call once when the countdown starts and
 * again every second it ticks down. Android updates an existing notification
 * ID silently (no repeat heads-up/sound), so this is safe to call every
 * second without re-alerting the rider each time.
 */
export async function presentCountdownNotification(secondsLeft: number, totalSeconds: number): Promise<void> {
  const data: Record<string, unknown> = { kind: "countdown_cancel" };
  await Notifications.scheduleNotificationAsync({
    identifier: COUNTDOWN_NOTIFICATION_ID,
    content: {
      title: "Crash detected",
      body: countdownBody(secondsLeft, totalSeconds),
      data,
      sound: "default",
      color: ANGEL_ACCENT_COLOR,
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: CANCEL_CATEGORY_ID,
    },
    trigger: Platform.OS === "android" ? { channelId: CRASH_CHANNEL_ID } : null,
  });
}

/**
 * Dismisses the countdown notification — call whenever the countdown
 * resolves by any path: it expires and the alert fires, the rider cancels
 * in-app, or the rider cancels from the notification itself. Idempotent —
 * dismissing an already-dismissed/nonexistent notification is a no-op.
 */
export async function dismissCountdownNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(COUNTDOWN_NOTIFICATION_ID);
}

function isCountdownCancelData(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).kind === "countdown_cancel");
}

/** True if a notification response belongs to the countdown notification (tap or action) — see RootNavigator. */
export function isCountdownNotificationResponse(response: Notifications.NotificationResponse | null): boolean {
  return isCountdownCancelData(response?.notification.request.content.data);
}
