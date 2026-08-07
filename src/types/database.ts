export type PairingStatus = "unpaired" | "pairing" | "paired";
export type IncidentStatus = "active" | "cancelled" | "resolved";
export type ResponderType = "gig_partner" | "auto" | "car_uber";
export type AlertMode = "call" | "sms";
export type SubscriptionTier = 3 | 6 | 12;
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  relationship: string | null;
  priority: number;
  alert_mode: AlertMode;
  created_at: string;
}

export interface Responder {
  id: string;
  name: string;
  type: ResponderType;
  platform_label: string | null;
  rating: number | null;
  vehicle_label: string | null;
  lat: number;
  lng: number;
  available: boolean;
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

export interface IncidentEvent {
  id: string;
  incident_id: string;
  label: string;
  occurred_at: string;
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
