// Angel Safety Alerts — the two new local-notification types from the
// notification-system brief: a "confirmed crash, guardians alerted"
// notification (distinct from localCrashNotifications.ts's earlier
// "tap to check in before guardians are alerted" one — that fires the
// moment a crash is *detected*, this one fires once the countdown has
// actually expired and the alert went out) and a speed alert.
//
// Both channels share the app's dark/orange theme via `color` (Android
// accent tint applied by the OS's own notification template) and a large
// launcher icon (`icon` in app.json's expo-notifications plugin config) —
// true custom RemoteViews layouts require a native Android module/config
// plugin outside what expo-notifications' managed API exposes, so this is
// the closest themed result achievable without ejecting.
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { publishInAppAlert } from "./inAppAlertBus";

export const ANGEL_ACCENT_COLOR = "#FF4500";

const CRASH_CONFIRMED_CHANNEL_ID = "angel-safety-alerts-crash";
const SPEED_ALERT_CHANNEL_ID = "angel-safety-alerts-speed";

const CHANNEL_DESCRIPTION = "Crash detection and speed alerts from Angel";

/** Must run before the notifications permission is requested — Android reads channel importance/behavior at request time. */
export async function configureAngelSafetyChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  // No `sound` field here on purpose — passing the literal string "default"
  // makes expo-notifications look for a bundled custom sound file named
  // "default" and warn when it can't find one (visible as a LogBox toast in
  // dev). Omitting it gets the channel's actual default: the system
  // notification sound. `sound: "default"` on the notification *content*
  // in scheduleNotificationAsync below is a different, valid code path.
  await Notifications.setNotificationChannelAsync(CRASH_CONFIRMED_CHANNEL_ID, {
    name: "Angel Safety Alerts",
    description: CHANNEL_DESCRIPTION,
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: ANGEL_ACCENT_COLOR,
  });
  await Notifications.setNotificationChannelAsync(SPEED_ALERT_CHANNEL_ID, {
    name: "Angel Safety Alerts — Speed",
    description: CHANNEL_DESCRIPTION,
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: ANGEL_ACCENT_COLOR,
  });
}

export interface CrashConfirmedNotificationData {
  kind: "crash_confirmed";
}

const CRASH_CONFIRMED_TITLE = "⚠️ ANGEL — CRASH DETECTED";
const CRASH_CONFIRMED_BODY = "A crash has been detected. Guardian alert sent. Tap to open Angel.";

async function scheduleCrashConfirmedSystemNotification(): Promise<void> {
  const data: Record<string, unknown> = { kind: "crash_confirmed" };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: CRASH_CONFIRMED_TITLE,
      body: CRASH_CONFIRMED_BODY,
      data,
      sound: "default",
      color: ANGEL_ACCENT_COLOR,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === "android" ? { channelId: CRASH_CONFIRMED_CHANNEL_ID } : null,
  });
}

/**
 * Fires once a crash alert has actually gone out to guardians — see
 * confirmIncident()/sendGuardianAlert() in emergencyPipeline.ts, both of
 * which call this right after a successful dispatch. Foregrounded: shown as
 * an in-app banner instead (AlertBanner) so the rider doesn't get a system
 * notification stacked on top of a screen they're already looking at.
 */
export async function presentCrashConfirmedAlert(): Promise<void> {
  if (AppState.currentState === "active") {
    publishInAppAlert("crash", CRASH_CONFIRMED_TITLE, CRASH_CONFIRMED_BODY);
    return;
  }
  await scheduleCrashConfirmedSystemNotification();
}

export interface SpeedAlertNotificationData {
  kind: "speed_alert";
}

const SPEED_ALERT_NOTIFICATION_ID = "angel-speed-alert";
const SPEED_ALERT_AUTO_DISMISS_MS = 10_000;
const SPEED_ALERT_TITLE = "🏎️ ANGEL — SPEED ALERT";
const SPEED_ALERT_BODY = "You are riding above 80 km/h. Ride safe.";

async function scheduleSpeedAlertSystemNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: SPEED_ALERT_NOTIFICATION_ID,
    content: {
      title: SPEED_ALERT_TITLE,
      body: SPEED_ALERT_BODY,
      data: { kind: "speed_alert" } as Record<string, unknown>,
      sound: "default",
      color: ANGEL_ACCENT_COLOR,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: Platform.OS === "android" ? { channelId: SPEED_ALERT_CHANNEL_ID } : null,
  });

  setTimeout(() => {
    Notifications.dismissNotificationAsync(SPEED_ALERT_NOTIFICATION_ID).catch(() => {
      // Already dismissed by the user or the OS — nothing to do.
    });
  }, SPEED_ALERT_AUTO_DISMISS_MS);
}

/** Fires when speed has been sustained above the threshold — see speedMonitor.ts for the 3s-sustained / 5min-cooldown logic. */
export async function presentSpeedAlert(): Promise<void> {
  if (AppState.currentState === "active") {
    publishInAppAlert("speed", SPEED_ALERT_TITLE, SPEED_ALERT_BODY);
    return;
  }
  await scheduleSpeedAlertSystemNotification();
}

function isCrashConfirmedData(value: unknown): value is CrashConfirmedNotificationData {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).kind === "crash_confirmed");
}

/** True if a tapped notification response was one of ours and should route straight to Home — see RootNavigator. */
export function isCrashConfirmedNotificationResponse(response: Notifications.NotificationResponse | null): boolean {
  return isCrashConfirmedData(response?.notification.request.content.data);
}
