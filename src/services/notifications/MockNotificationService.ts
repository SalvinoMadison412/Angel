import { supabase } from "../../lib/supabase";
import { Guardian, Incident } from "../../types/database";
import { NotificationService } from "./NotificationService";

/**
 * "Notifying" guardians today just means writing to incident_events, which
 * the Live Incident Tracking screen reads via Realtime, plus a console log.
 * Swap for a Supabase Edge Function that calls Twilio/FCM once real
 * SMS/push is wired up — callers only depend on the NotificationService
 * interface.
 */
export class MockNotificationService implements NotificationService {
  async notifyGuardians(incident: Incident, guardians: Guardian[]): Promise<void> {
    if (guardians.length === 0) {
      await this.logEvent(incident.id, "No guardians configured — nothing to notify");
      return;
    }

    console.log(
      `[notify] incident ${incident.id}: alerting ${guardians.length} guardian(s)`,
      guardians.map((g) => g.name)
    );

    await this.logEvent(
      incident.id,
      `${guardians.length} guardian${guardians.length === 1 ? "" : "s"} notified · ${guardians[0].name} contacted`
    );
  }

  async logEvent(incidentId: string, label: string): Promise<void> {
    const { error } = await supabase.from("incident_events").insert({ incident_id: incidentId, label });
    if (error) {
      console.warn("[notify] failed to log incident event", error.message);
    }
  }
}
