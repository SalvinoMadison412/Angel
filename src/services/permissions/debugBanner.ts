// Dev-only override so PermissionBanner can be previewed on demand from
// DiagnosticScreen without actually having to revoke a real permission
// first. Same tiny pub/sub shape as inAppAlertBus.ts, kept separate from
// permissionsStatus.ts's real PermissionSnapshot store so a debug trigger
// can never be mistaken for (or accidentally feed into) the real
// requiredPermissionsGranted() check.
const DEFAULT_DURATION_MS = 8000;

let active = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function isDebugPermissionBannerActive(): boolean {
  return active;
}

export function subscribeDebugPermissionBanner(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function triggerDebugPermissionBanner(durationMs = DEFAULT_DURATION_MS): void {
  if (timer) clearTimeout(timer);
  active = true;
  listeners.forEach((listener) => listener());
  timer = setTimeout(() => {
    active = false;
    listeners.forEach((listener) => listener());
  }, durationMs);
}
