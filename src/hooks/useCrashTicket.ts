import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { CrashTicket, TicketPartner } from "../types/database";

// The rider's live view of their own crash ticket. crash_tickets is in the
// supabase_realtime publication (migration 0005), so a partner accepting or
// closing the ticket from the separate Angel Partners app lands here with no
// refetch. The assigned partner row is a plain poll instead — `partners` is
// not in the realtime publication, and a 15s refetch is enough to track a
// responder's location on the rider's map while they're on the way.
export function useCrashTicket(ticketId: string) {
  const queryClient = useQueryClient();

  const ticketQuery = useQuery({
    queryKey: ["crash-ticket", ticketId],
    queryFn: async (): Promise<CrashTicket | null> => {
      const { data, error } = await supabase.from("crash_tickets").select("*").eq("id", ticketId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`crash-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crash_tickets", filter: `id=eq.${ticketId}` },
        (payload) => queryClient.setQueryData(["crash-ticket", ticketId], payload.new as CrashTicket)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  const partnerId = ticketQuery.data?.accepted_by ?? null;
  const responding = ticketQuery.data?.status === "accepted";

  const partnerQuery = useQuery({
    queryKey: ["ticket-partner", partnerId],
    enabled: Boolean(partnerId),
    refetchInterval: responding ? 15000 : false,
    queryFn: async (): Promise<TicketPartner | null> => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, full_name, phone, current_lat, current_lng, location_updated_at")
        .eq("id", partnerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return { ticket: ticketQuery.data ?? null, partner: partnerQuery.data ?? null };
}
