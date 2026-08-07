import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { PillButton, RouteMap, ScreenBackground, ScreenHeader } from "../../components";
import { supabase } from "../../lib/supabase";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Bengaluru fallback — used only if the ticket somehow has no
// rider_lat/lng (location permission was denied at creation time — see
// CrashAlertScreen).
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

// One-time fetch only — the realtime subscription that used to live here
// (reflecting a partner accepting/closing the ticket from the separate
// Angel Partners app) is gone for v1; see the TODO below. The crash_tickets
// row itself is still written (CrashAlertScreen) and still read by that
// separate Partners platform — this screen just no longer shows any of
// that status.
function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ["crash-ticket", ticketId],
    queryFn: async (): Promise<CrashTicket | null> => {
      const { data, error } = await supabase.from("crash_tickets").select("*").eq("id", ticketId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// TODO: RE-ENABLE FOR V2 — this realtime subscription reflected a partner
// (from the separate Angel Partners app) accepting or closing the ticket.
// Removed for the v1 Play Store release (guardians-only via WhatsApp, no
// live partner-matching UI). Was:
//
// useEffect(() => {
//   const channel = supabase
//     .channel(`crash-ticket-${ticketId}`)
//     .on(
//       "postgres_changes",
//       { event: "UPDATE", schema: "public", table: "crash_tickets", filter: `id=eq.${ticketId}` },
//       (payload) => {
//         queryClient.setQueryData(["crash-ticket", ticketId], payload.new as CrashTicket);
//       }
//     )
//     .subscribe();
//   return () => { supabase.removeChannel(channel); };
// }, [ticketId, queryClient]);

/**
 * Shown to the rider once a severity 2-5 crash ticket exists — a simple
 * "your guardians have been notified" confirmation with the crash location
 * and a way to call emergency services directly. Reached from
 * CrashAlertScreen.dispatch() once the crash_tickets insert succeeds.
 *
 * v1 Play Store release: no partner-matching/dispatch UI — see the v2 TODOs
 * in this file and in CrashAlertScreen.dispatch() for what used to be here.
 */
export function ActiveTicketScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "ActiveTicket">>();
  const { ticketId } = route.params;

  const { data: ticket } = useTicket(ticketId);
  const [closing, setClosing] = useState(false);

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

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} />

      <View style={styles.headerBlock}>
        <Text style={[type.title, styles.heading]}>Help is on the way</Text>
        <Text style={[type.bodySmall, styles.subheading]}>Your guardians have been notified.</Text>
      </View>

      <View style={styles.mapWrap}>
        <RouteMap riderLat={riderLat} riderLng={riderLng} />
      </View>

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
  headerBlock: { paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.lg },
  heading: { color: colors.text },
  subheading: { color: colors.textMuted },
  mapWrap: { paddingHorizontal: spacing.xl },
  actions: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.md },
});
