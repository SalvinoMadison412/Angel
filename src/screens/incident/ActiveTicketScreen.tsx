import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { PartnerSearchMap, PillButton, RouteMap, ScreenBackground, ScreenHeader } from "../../components";
import { useCrashTicket } from "../../hooks";
import { haversineKm, etaMinutes } from "../../lib/geo";
import { supabase } from "../../lib/supabase";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Bengaluru fallback — used only if the ticket somehow has no
// rider_lat/lng (location permission was denied at creation time — see
// CrashAlertScreen).
const FALLBACK_LAT = 12.9716;
const FALLBACK_LNG = 77.5946;

/**
 * Shown to the rider once a crash ticket exists — any severity, or a manual
 * "I NEED HELP NOW". While it's open this is a "searching for a nearby
 * responder" state; the moment a partner accepts it from the separate Angel
 * Partners app, the crash_tickets realtime subscription (useCrashTicket)
 * flips this to a "partner responding" card with their live pin, ETA and a
 * call button. Also reacts to the partner closing or escalating the ticket.
 * Reached from CrashAlertScreen.dispatch() / the guardian-alert flows once
 * the crash_tickets insert succeeds.
 */
export function ActiveTicketScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "ActiveTicket">>();
  const { ticketId } = route.params;

  const { ticket, partner } = useCrashTicket(ticketId);
  const [closing, setClosing] = useState(false);

  const handleCallEmergency = () => {
    Linking.openURL("tel:112");
  };

  const handleCallPartner = () => {
    if (partner?.phone) Linking.openURL(`tel:${partner.phone}`);
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
  const responding = ticket.status === "accepted" && Boolean(partner);
  const escalated = ticket.status === "escalated";
  // Closed from another session/device — a rider who closed it here has
  // already navigated away (handleClose → popToTop).
  const closedElsewhere = ticket.status === "closed";

  const partnerHasFix = partner?.current_lat != null && partner?.current_lng != null;

  // Straight-line ETA — a rough "how far out" for the rider, not a routed
  // estimate. Only shown when the partner has pushed a location (they do so
  // on an interval while responding).
  let etaMin: number | null = null;
  if (responding && partnerHasFix) {
    const km = haversineKm({ lat: riderLat, lng: riderLng }, { lat: partner!.current_lat!, lng: partner!.current_lng! });
    etaMin = etaMinutes(km);
  }

  const heading = escalated
    ? "Escalated to emergency services"
    : responding
      ? "A partner is on the way"
      : "Help is on the way";

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} />

      <View style={styles.headerBlock}>
        <Text style={[type.title, styles.heading]}>{heading}</Text>
        <Text style={[type.bodySmall, styles.subheading]}>
          {escalated
            ? "A responder flagged this for emergency services. Your guardians were also notified."
            : closedElsewhere
              ? "This alert has been closed."
              : "Your guardians have been notified."}
        </Text>
      </View>

      {responding && partner ? (
        <View style={styles.section}>
          <View style={styles.partnerCard}>
            <Text style={[type.kicker, styles.partnerLabel]}>PARTNER RESPONDING</Text>
            <Text style={[type.body, styles.partnerName]}>{partner.full_name}</Text>
            {etaMin != null && (
              <Text style={[type.bodySmall, styles.partnerEta]}>~{etaMin} min away</Text>
            )}
            {partner.phone && (
              <PillButton title="CALL PARTNER" variant="outline" onPress={handleCallPartner} />
            )}
          </View>
          <RouteMap
            riderLat={riderLat}
            riderLng={riderLng}
            partnerLat={partnerHasFix ? partner.current_lat : null}
            partnerLng={partnerHasFix ? partner.current_lng : null}
          />
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {closedElsewhere || escalated ? (
            <RouteMap riderLat={riderLat} riderLng={riderLng} />
          ) : (
            <PartnerSearchMap riderLat={riderLat} riderLng={riderLng} />
          )}
        </View>
      )}

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
  section: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  partnerCard: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  partnerLabel: { color: colors.success },
  partnerName: { color: colors.text },
  partnerEta: { color: colors.textMuted },
  mapWrap: { paddingHorizontal: spacing.xl },
  actions: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.md },
});
