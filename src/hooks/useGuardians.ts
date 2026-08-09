import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { AlertMode, Guardian } from "../types/database";

export interface GuardianInput {
  name: string;
  phone: string;
  relationship: string;
  alertMode: AlertMode;
}

export function useGuardians() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["guardians", userId] });

  const query = useQuery({
    queryKey: ["guardians", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Guardian[]> => {
      const { data, error } = await supabase
        .from("guardians")
        .select("*")
        .eq("user_id", userId)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    // is_active flips server-side via twilio-status-webhook, on the
    // guardian's own schedule (whenever they get around to tapping the
    // WhatsApp share link) — not something any client mutation here ever
    // triggers, so the usual invalidateQueries-on-mutation pattern the rest
    // of this hook uses can't pick it up. Short polling interval instead,
    // only while the query is actually mounted/enabled and the app is
    // foregrounded (refetchIntervalInBackground defaults to false) — cheap
    // enough for a handful of guardian rows, and the GuardiansScreen active/
    // inactive indicator is exactly the kind of status a rider expects to
    // update on its own while they're looking at it.
    refetchInterval: 5000,
  });

  const addGuardian = useMutation({
    mutationFn: async (input: GuardianInput) => {
      const nextPriority = (query.data?.length ?? 0) + 1;
      const { error } = await supabase.from("guardians").insert({
        user_id: userId,
        name: input.name,
        phone: input.phone,
        relationship: input.relationship,
        alert_mode: input.alertMode,
        priority: nextPriority,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateGuardian = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: GuardianInput }) => {
      const { error } = await supabase
        .from("guardians")
        .update({
          name: input.name,
          phone: input.phone,
          relationship: input.relationship,
          alert_mode: input.alertMode,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeGuardian = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guardians").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorderGuardians = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) => supabase.from("guardians").update({ priority: index + 1 }).eq("id", id))
      );
    },
    onSuccess: invalidate,
  });

  return { ...query, addGuardian, updateGuardian, removeGuardian, reorderGuardians };
}

export function guardianTag(index: number, alertMode: AlertMode): string {
  if (index === 0) return "PRIMARY";
  if (alertMode === "sms") return "SMS ONLY";
  return `CALL ${index + 1}${index === 1 ? "ND" : index === 2 ? "RD" : "TH"}`;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
