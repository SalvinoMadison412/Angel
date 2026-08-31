export type PairingStatus = "unpaired" | "pairing" | "paired";
export type IncidentStatus = "active" | "cancelled" | "resolved";
export type AlertMode = "call" | "sms";
export type SubscriptionTier = 3 | 6 | 12;
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type HospitalPreference = "government" | "private";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier | null;
  subscription_expiry: string | null;
  onboarding_completed: boolean;
  // 1-indexed step to resume onboarding on — see EmergencyProfile/Guardian/
  // Device for what's actually collected at each step. Not inferred from
  // field emptiness: an empty field can mean "not reached yet" or
  // "explicitly skipped," which need to resume differently.
  onboarding_step: number;
  created_at: string;
}

export interface Device {
  id: string;
  owner_id: string;
  calibration_offset_x: number;
  calibration_offset_y: number;
  calibration_offset_z: number;
  pairing_status: PairingStatus;
  // Whether the sensor's on-device "neutral mount orientation" reference
  // has been set via BLE (CalibrateSensorScreen) — separate from the
  // pitch/roll/yaw offsets above. Until true, telemetry's `tilt` field is
  // degrees from the sensor's raw axis, not from the bike's actual resting
  // angle, and shouldn't be trusted.
  calibrated: boolean;
  bike_make: string | null;
  bike_model: string | null;
  created_at: string;
}

// Sensitive identity/medical data collected during onboarding — kept in its
// own table (not bolted onto Profile) with RLS scoped tightly to user_id.
// Only ever read by: the owning user (Settings/onboarding) and the
// emergency pipeline at the moment of a confirmed crash — see
// emergencyPipeline.confirmIncident.
export interface EmergencyProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  blood_group: BloodGroup | null;
  medical_conditions: string | null;
  insurance_provider: string | null;
  insurance_policy_name: string | null;
  insurance_coverage: string | null;
  insurance_covered: boolean;
  hospital_preference: HospitalPreference | null;
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  priority: number;
  alert_mode: AlertMode;
  created_at: string;
}

export interface Incident {
  id: string;
  user_id: string;
  device_id: string | null;
  severity: number;
  // Raw sensor metrics behind the severity score — see firmware/README.md.
  // Kept alongside the derived severity so a future recalibration of the
  // threshold ladder doesn't need to re-collect data.
  impact: number | null;
  gyro: number | null;
  tilt: number | null;
  still: boolean | null;
  // Whether the sensor had a calibrated mount reference at the moment of
  // this specific event — null for incidents recorded before this field
  // existed. If false, `tilt` above is not meaningful for this incident.
  calibrated: boolean | null;
  status: IncidentStatus;
  lat: number | null;
  lng: number | null;
  assigned_responder_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type CrashTicketStatus = "open" | "accepted" | "closed" | "escalated";
// 'crash' = a detected sensor event (any severity). 'manual' = the rider hit
// "I NEED HELP NOW" — no sensor reading behind it, so severity/trigger/metrics
// are null.
export type CrashTicketSource = "crash" | "manual";

// Every rider-initiated emergency — a detected crash (any severity) or a
// manual SOS — opens a crash_tickets row (migration 0005) so nearby Angel
// Partners can see and accept it while it's still open. Deliberately
// medical-data-free — see the audit comment in
// emergencyPipeline.confirmIncident.
export interface CrashTicket {
  id: string;
  rider_id: string;
  source: CrashTicketSource;
  severity: number | null;
  trigger: "impact" | "tilt" | null;
  impact_g: number | null;
  gyro_dps: number | null;
  tilt_deg: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  status: CrashTicketStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  closed_at: string | null;
  created_at: string;
}

// The responder on the other side of an accepted crash ticket. The Angel
// Partners app owns the partners table; the rider app only ever reads the
// single row RLS exposes to it — the partner assigned to its own ticket
// (policy partners_select_by_ticket_rider, migration 0005).
export interface TicketPartner {
  id: string;
  full_name: string;
  phone: string | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "cancelled";
  created_at: string;
}
