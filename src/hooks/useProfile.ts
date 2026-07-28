import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { Profile } from "../types/database";

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["profile", userId] });

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Advances the resume pointer as the rider completes (or explicitly
  // skips) each onboarding step — see Profile.onboarding_step.
  const setOnboardingStep = useMutation({
    mutationFn: async (step: number) => {
      const { error } = await supabase.from("profiles").update({ onboarding_step: step }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, setOnboardingStep, completeOnboarding };
}
