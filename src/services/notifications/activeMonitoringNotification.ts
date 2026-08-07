import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// A persistent, non-dismissable "Angel is active" notification shown while
// the BLE crash sensor is connected — the closest thing this app has to
// "detection running" (there's no separate pause toggle; disconnecting the
// device is what stops detection today). Wired up from RootNavigator's
// CrashDetectorListener, which already tracks the real (non-mock)
// connection state.
//
// This is a sticky local notification, NOT a true Android foreground
// service — expo-notifications has no API for the latter, and adding one
// would mean a custom native module/config plugin well beyond a
// notification. It looks and behaves like the "ongoing" notification a
// foreground service would show, but doesn't keep the process alive if
// Android kills it in the background — same known limitation already
// documented on presentCrashNotification in localCrashNotifications.ts.
const MONITORING_CHANNEL_ID = "monitoring-active";
const MONITORING_NOTIFICATION_ID = "angel-monitoring-active";

async function configureMonitoringChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(MONITORING_CHANNEL_ID, {
    name: "Monitoring active",
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  });
}

export async function showMonitoringNotification(): Promise<void> {
  try {
    await configureMonitoringChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: MONITORING_NOTIFICATION_ID,
      content: {
        title: "Angel is active",
        body: "Monitoring for crashes. Your guardians will be alerted if an accident is detected.",
        sound: false,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: Platform.OS === "android" ? { channelId: MONITORING_CHANNEL_ID } : null,
    });
  } catch (err) {
    console.warn("[notifications] failed to show monitoring notification", err);
  }
}

export async function hideMonitoringNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(MONITORING_NOTIFICATION_ID);
  } catch (err) {
    console.warn("[notifications] failed to hide monitoring notification", err);
  }
}
