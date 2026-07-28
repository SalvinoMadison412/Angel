import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { BloodGroup, EmergencyProfile } from "../types/database";

export interface EmergencyProfileInput {
  fullName?: string | null;
  dateOfBirth?: string | null; // "YYYY-MM-DD"
  bloodGroup?: BloodGroup | null;
  medicalConditions?: string | null;
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

      const { error } = await supabase.from("emergency_profiles").upsert(patch, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emergency-profile", userId] }),
  });

  return { ...query, save };
}
