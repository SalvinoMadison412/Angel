import { useSyncExternalStore } from "react";
import {
  PermissionSnapshot,
  getPermissionSnapshot,
  subscribePermissionSnapshot,
} from "../services/permissions/permissionsStatus";

/** Live snapshot of every permission the first-launch gate covers — updates whenever refreshPermissionSnapshot() runs. */
export function usePermissionSnapshot(): PermissionSnapshot {
  return useSyncExternalStore(subscribePermissionSnapshot, getPermissionSnapshot);
}
