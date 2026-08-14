// Foreground-only alert channel. When the app is active, a crash-confirmed
// or speed alert shows as an in-app banner (AlertBanner/InAppAlertHost)
// instead of a system notification — AGENTS.md is explicit that the system
// notification is only a background substitute, not something to double up
// with while the rider is already looking at the screen. Plain pub/sub
// (module state, not React context) so non-component code — emergencyPipeline,
// speedMonitor — can publish without needing a hook or a provider in scope.

export type InAppAlertKind = "crash" | "speed";

export interface InAppAlert {
  kind: InAppAlertKind;
  title: string;
  body: string;
  /** Distinguishes repeat alerts of the same kind so the banner can re-trigger its 5s auto-dismiss timer. */
  id: number;
}

const listeners = new Set<(alert: InAppAlert) => void>();
let nextId = 1;

export function publishInAppAlert(kind: InAppAlertKind, title: string, body: string): void {
  const alert: InAppAlert = { kind, title, body, id: nextId++ };
  listeners.forEach((listener) => listener(alert));
}

export function subscribeInAppAlerts(listener: (alert: InAppAlert) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
