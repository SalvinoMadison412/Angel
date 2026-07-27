import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Incident, IncidentEvent } from "../types/database";

export function useIncident(incidentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["incident", incidentId],
    enabled: Boolean(incidentId),
    queryFn: async (): Promise<Incident | null> => {
      const { data, error } = await supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!incidentId) return;
    const channel = supabase
      .channel(`incident-${incidentId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "incidents", filter: `id=eq.${incidentId}` },
        (payload) => {
          queryClient.setQueryData(["incident", incidentId], payload.new as Incident);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId, queryClient]);

  return query;
}

export function useCancelIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase
        .from("incidents")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", incidentId);
      if (error) throw error;
    },
    onSuccess: (_data, incidentId) => queryClient.invalidateQueries({ queryKey: ["incident", incidentId] }),
  });
}

export function useAssignResponder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ incidentId, responderId }: { incidentId: string; responderId: string }) => {
      const { error } = await supabase
        .from("incidents")
        .update({ assigned_responder_id: responderId })
        .eq("id", incidentId);
      if (error) throw error;
    },
    onSuccess: (_data, { incidentId }) => queryClient.invalidateQueries({ queryKey: ["incident", incidentId] }),
  });
}

export function useIncidentEvents(incidentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["incident-events", incidentId],
    enabled: Boolean(incidentId),
    queryFn: async (): Promise<IncidentEvent[]> => {
      const { data, error } = await supabase
        .from("incident_events")
        .select("*")
        .eq("incident_id", incidentId)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!incidentId) return;
    const channel = supabase
      .channel(`incident-events-${incidentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incident_events", filter: `incident_id=eq.${incidentId}` },
        (payload) => {
          queryClient.setQueryData<IncidentEvent[]>(["incident-events", incidentId], (prev) => [
            ...(prev ?? []),
            payload.new as IncidentEvent,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId, queryClient]);

  return query;
}
