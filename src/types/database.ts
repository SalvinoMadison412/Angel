export type PairingStatus = "unpaired" | "pairing" | "paired";
export type IncidentStatus = "active" | "cancelled" | "resolved";
export type ResponderType = "gig_partner" | "auto" | "car_uber";
export type AlertMode = "call" | "sms";
export type SubscriptionTier = 3 | 6 | 12;

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  subscription_tier: SubscriptionTier | null;
  subscription_expiry: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  owner_id: string;
  calibration_offset_x: number;
  calibration_offset_y: number;
  calibration_offset_z: number;
  pairing_status: PairingStatus;
  created_at: string;
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
