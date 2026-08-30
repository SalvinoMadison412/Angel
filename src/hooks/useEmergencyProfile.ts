import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { BloodGroup, EmergencyProfile, HospitalPreference } from "../types/database";

export interface EmergencyProfileInput {
  fullName?: string | null;
  dateOfBirth?: string | null; // "YYYY-MM-DD"
  bloodGroup?: BloodGroup | null;
  medicalConditions?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyName?: string | null;
  insuranceCoverage?: string | null;
  insuranceCovered?: boolean;
  hospitalPreference?: HospitalPreference | null;
}

export function useEmergencyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["emergency-profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<EmergencyProfile | null> => {
      const { data, error } = await supabase.from("emergency_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // A single upsert covers both "first save" (onboarding) and "edit later"
  // (Settings) — the row may or may not exist yet in either case.
  const save = useMutation({
    mutationFn: async (input: EmergencyProfileInput) => {
      const patch: Record<string, unknown> = { user_id: userId };
      if ("fullName" in input) patch.full_name = input.fullName;
      if ("dateOfBirth" in input) patch.date_of_birth = input.dateOfBirth;
      if ("bloodGroup" in input) patch.blood_group = input.bloodGroup;
      if ("medicalConditions" in input) patch.medical_conditions = input.medicalConditions;
      if ("insuranceProvider" in input) patch.insurance_provider = input.insuranceProvider;
      if ("insurancePolicyName" in input) patch.insurance_policy_name = input.insurancePolicyName;
      if ("insuranceCoverage" in input) patch.insurance_coverage = input.insuranceCoverage;
      if ("insuranceCovered" in input) patch.insurance_covered = input.insuranceCovered;
      if ("hospitalPreference" in input) patch.hospital_preference = input.hospitalPreference;

      const { error } = await supabase.from("emergency_profiles").upsert(patch, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emergency-profile", userId] }),
  });

  return { ...query, save };
}
