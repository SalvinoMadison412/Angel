import { Guardian, Incident } from "../../types/database";

export interface NotificationService {
  notifyGuardians(incident: Incident, guardians: Guardian[]): Promise<void>;
  logEvent(incidentId: string, label: string): Promise<void>;
}
