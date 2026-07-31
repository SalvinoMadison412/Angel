import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { GlassCard, PillButton, RouteMap, ScreenBackground, ScreenHeader, Tag } from "../../components";
import { supabase } from "../../lib/supabase";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Bengaluru fallback — matches useLocation.ts and LiveIncidentScreen's own
// default, used only if the ticket somehow has no rider_lat/lng (location
// permission was denied at creation time — see CrashAlertScreen).
const FALLBACK_LAT = 12.9716;
const FALLBACK_LNG = 77.5946;

type TicketStatus = "open" | "accepted" | "closed" | "escalated";

// Local to this screen — deliberately not added to types/database.ts (see
// the prompt that added this file: no other files should change).
interface CrashTicket {
  id: string;
  rider_id: string;
  severity: number;
  trigger: "impact" | "tilt" | null;
  impact_g: number | null;
  gyro_dps: number | null;
  tilt_deg: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  status: TicketStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface Partner {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "WAITING FOR A PARTNER",
  accepted: "PARTNER ACCEPTED",
  closed: "TICKET CLOSED",
  escalated: "ESCALATED",
};

// Same shape as useIncident.ts's realtime pattern, inlined here rather than
// added as a shared hook (see the "no other files" note above).
function useTicket(ticketId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
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
        (payload) => {
          queryClient.setQueryData(["crash-ticket", ticketId], payload.new as CrashTicket);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return query;
}

function usePartner(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: ["partner", partnerId],
    enabled: Boolean(partnerId),
    queryFn: async (): Promise<Partner | null> => {
      const { data, error } = await supabase.from("partners").select("*").eq("id", partnerId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Shown to the rider once a severity 2-5 crash ticket exists — real-time
 * status via Supabase (no polling/refresh needed), a map, and a way to call
 * either the accepted partner or emergency services directly. Reached from
 * CrashAlertScreen.dispatch() once the crash_tickets insert succeeds.
 */
export function ActiveTicketScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "ActiveTicket">>();
  const { ticketId } = route.params;

  const { data: ticket } = useTicket(ticketId);
  const { data: partner } = usePartner(ticket?.accepted_by);
  const [closing, setClosing] = useState(false);

  const handleCallPartner = () => {
    if (!partner?.phone) return;
    Linking.openURL(`tel:${partner.phone}`);
  };

  const handleCallEmergency = () => {
    Linking.openURL("tel:112");
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const { error } = await supabase
        .from("crash_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      navigation.popToTop();
    } catch (err) {
      console.warn("[active-ticket] failed to close ticket", err);
      setClosing(false);
    }
  };

  if (!ticket) {
    return (
      <ScreenBackground contentStyle={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading ticket…</Text>
      </ScreenBackground>
    );
  }

  const riderLat = ticket.rider_lat ?? FALLBACK_LAT;
  const riderLng = ticket.rider_lng ?? FALLBACK_LNG;
  const isAccepted = ticket.status === "accepted" && Boolean(partner);

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} />

      <View style={styles.headerBlock}>
        <Text style={[type.title, styles.heading]}>Help is on the way</Text>
        <Tag label={STATUS_LABELS[ticket.status]} variant={isAccepted ? "accent" : "neutral"} />
      </View>

      <View style={styles.mapWrap}>
        <RouteMap
          riderLat={riderLat}
          riderLng={riderLng}
          responderLat={partner?.current_lat ?? riderLat}
          responderLng={partner?.current_lng ?? riderLng}
        />
      </View>

      <GlassCard style={styles.partnerCard}>
        {isAccepted && partner ? (
          <>
            <Text style={[type.kicker, styles.dim]}>PARTNER</Text>
            <Text style={styles.partnerName}>{partner.full_name}</Text>
            <PillButton
              title="CALL PARTNER"
              variant="inverse"
              onPress={handleCallPartner}
              disabled={!partner.phone}
              style={styles.cta}
            />
          </>
        ) : (
          <Text style={styles.waiting}>Waiting for the nearest partner to accept…</Text>
        )}
      </GlassCard>

      <View style={styles.actions}>
        <PillButton title="CALL 112 · EMERGENCY SERVICES" variant="outline" onPress={handleCallEmergency} />
        <PillButton
          title="I'M SAFE NOW — CLOSE TICKET"
          variant="ghost"
          onPress={handleClose}
          loading={closing}
          disabled={ticket.status === "closed"}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  loadingWrap: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textMuted },
  headerBlock: { paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.lg },
  heading: { color: colors.text },
  dim: { color: colors.textDim },
  mapWrap: { paddingHorizontal: spacing.xl },
  partnerCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg },
  partnerName: { color: colors.text, fontFamily: type.title.fontFamily, fontSize: 20, marginTop: spacing.sm },
  waiting: { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
  cta: { marginTop: spacing.lg },
  actions: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.md },
});
