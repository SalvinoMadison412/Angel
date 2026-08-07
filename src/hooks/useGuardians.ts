import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { AlertMode, Guardian } from "../types/database";

export const MAX_GUARDIANS = 3;

export interface GuardianInput {
  name: string;
  phoneNumber: string;
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
  });

  const addGuardian = useMutation({
    mutationFn: async (input: GuardianInput) => {
      if ((query.data?.length ?? 0) >= MAX_GUARDIANS) {
        throw new Error(`You can add at most ${MAX_GUARDIANS} guardians`);
      }
      const nextPriority = (query.data?.length ?? 0) + 1;
      const { error } = await supabase.from("guardians").insert({
        user_id: userId,
        name: input.name,
        phone_number: input.phoneNumber,
        relationship: input.relationship,
        alert_mode: input.alertMode,
        priority: nextPriority,
      });
      // The DB also enforces this (enforce_guardian_limit trigger,
      // 0011_guardians_table.sql) — this check just gives a clearer error
      // than the trigger's raised exception before it even makes the call.
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
          phone_number: input.phoneNumber,
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
