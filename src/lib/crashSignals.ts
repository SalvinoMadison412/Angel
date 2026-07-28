// Shared copy for the crash signals shown on both the Home "last reading"
// card and the full-screen CrashAlertScreen — kept in one place so the two
// surfaces never drift into describing the same event differently.

export const SEVERITY_LABELS: Record<number, string> = {
  1: "MINOR",
  2: "MODERATE",
  3: "ELEVATED",
  4: "SEVERE",
  5: "CRITICAL",
};

export type CrashTrigger = "impact" | "tilt";

/** Short badge-style label distinguishing what fired the event. */
export function triggerHeadline(trigger: CrashTrigger): string {
  return trigger === "impact" ? "HARD IMPACT" : "POSSIBLE TIP-OVER";
}

/** One-sentence, plain-language description of what triggered the event. */
export function triggerDescription(trigger: CrashTrigger): string {
  return trigger === "impact"
    ? "Detected: hard impact."
    : "Detected: bike may have tipped over or the sensor was dislodged.";
}
