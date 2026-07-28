import { EmergencyProfile, Guardian, Incident } from "../../types/database";

// The onboarding/edit-profile consent copy promises this is "shared with
// emergency responders only at the moment of a confirmed crash alert" —
// this is what makes that literally true rather than aspirational.
export type MedicalSnapshot = Pick<EmergencyProfile, "full_name" | "blood_group" | "medical_conditions"> | null;

export interface NotificationService {
  notifyGuardians(incident: Incident, guardians: Guardian[], medicalInfo?: MedicalSnapshot): Promise<void>;
  logEvent(incidentId: string, label: string): Promise<void>;
}
