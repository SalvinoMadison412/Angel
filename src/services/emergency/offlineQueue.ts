import { File, Paths } from "expo-file-system";
import { supabase } from "../../lib/supabase";
import { CrashEvent } from "../bluetooth";
import { confirmIncident } from "./emergencyPipeline";

// A confirmed severity 2-5 crash (CrashAlertScreen's countdown expiring, or
// the rider tapping "SEND HELP NOW") must never dead-end just because the
// device has no signal at that instant — that's exactly when it matters
// most. When confirmIncident() fails outright (not a partial failure; see
// its own best-effort internals), the caller has nowhere else in the UI to
// send the rider, so it queues here instead: persisted to disk (survives an
// app restart/kill), retried automatically the next time the app is
// foregrounded with a session available. See flushPendingDispatches, called
// from RootNavigator's CrashDetectorListener.
const QUEUE_FILE_NAME = "pending_dispatches.jsonl";

interface PendingDispatch {
  event: CrashEvent;
  userId: string;
  deviceId: string | null;
  queuedAt: number;
}

function getQueueFile(): File {
  return new File(Paths.document, QUEUE_FILE_NAME);
}

function readQueue(): PendingDispatch[] {
  const file = getQueueFile();
  if (!file.exists) return [];
  try {
    return file
      .textSync()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PendingDispatch);
  } catch (err) {
    console.warn("[offline-queue] failed to read pending dispatches, treating as empty", err);
    return [];
  }
}

function writeQueue(items: PendingDispatch[]): void {
  const file = getQueueFile();
  const content = items.map((item) => JSON.stringify(item)).join("\n") + (items.length > 0 ? "\n" : "");
  if (!file.exists) file.create();
  file.write(content);
}

export function queuePendingDispatch(input: { event: CrashEvent; userId: string; deviceId: string | null }): void {
  try {
    const items = readQueue();
    items.push({ ...input, queuedAt: Date.now() });
    writeQueue(items);
  } catch (err) {
    // Losing a queue write isn't recoverable here, and must never take down
    // the caller's own (already-failing) dispatch attempt.
    console.warn("[offline-queue] failed to persist a pending dispatch", err);
  }
}

let flushInFlight = false;

/**
 * Best-effort retry pass — swallows a still-failing item (still offline, or
 * some other transient error) and leaves it queued for the next call rather
 * than dropping it. Guarded against overlapping calls (e.g. a fast
 * foreground/background/foreground) since each retry re-inserts an
 * `incidents` row and re-sends guardian SMS on success.
 */
export async function flushPendingDispatches(): Promise<void> {
  if (flushInFlight) return;
  const items = readQueue();
  if (items.length === 0) return;

  flushInFlight = true;
  try {
    const remaining: PendingDispatch[] = [];
    for (const item of items) {
      try {
        const { data: guardians, error } = await supabase.from("guardians").select("*").eq("user_id", item.userId);
        if (error) throw error;
        await confirmIncident({
          event: item.event,
          userId: item.userId,
          deviceId: item.deviceId,
          guardians: guardians ?? [],
        });
      } catch (err) {
        console.warn("[offline-queue] retry failed, will try again later", err);
        remaining.push(item);
      }
    }
    writeQueue(remaining);
  } finally {
    flushInFlight = false;
  }
}
