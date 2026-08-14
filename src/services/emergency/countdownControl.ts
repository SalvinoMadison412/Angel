// Cross-boundary "cancel this countdown" signal. The countdown notification
// (countdownNotification.ts) is dismissed/handled from a global listener in
// RootNavigator, which has no direct reference to whichever countdown
// screen (CrashAlertScreen or EmergencyCountdownScreen) currently owns the
// active countdown — this is the pub/sub bridge between the two, same
// module-level pattern as inAppAlertBus.ts.
const listeners = new Set<() => void>();

/** Called from RootNavigator's notification response handler when "CANCEL ALERT" is tapped. */
export function requestCountdownCancel(): void {
  listeners.forEach((listener) => listener());
}

/** The active countdown screen subscribes on mount and runs its own cancel handler when notified. */
export function subscribeCountdownCancel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
