import { useMutation } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

// Calls the delete-account edge function, which removes the avatar from
// Storage and then deletes the auth.users row — every profiles/devices/
// guardians/emergency_profiles/incidents/subscriptions/crash_tickets row
// for this user cascade-deletes with it (all declared `on delete cascade`
// against auth.users, see supabase/migrations/0001_init.sql,
// 0004_onboarding.sql, 0005_partners_platform.sql). Does NOT sign out on
// success — SettingsScreen does that once this resolves, so a failure here
// never leaves the caller half signed-out.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}
