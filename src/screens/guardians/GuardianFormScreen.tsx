import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { useGuardians } from "../../hooks/useGuardians";
import { localDigits, toE164 } from "../../lib/phone";
import { buildGuardianOptInLink } from "../../lib/whatsapp";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

// Every guardian is called — the alert-mode picker this used to expose
// (call vs SMS-only) was removed from the UI, so every new/edited guardian
// is saved with the same default the backend already defaults to.
const DEFAULT_ALERT_MODE = "call" as const;

export function GuardianFormScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "GuardianForm">>();
  const { guardianId } = route.params;

  const { data: guardians, addGuardian, updateGuardian, removeGuardian } = useGuardians();
  const existing = useMemo(() => guardians?.find((g) => g.id === guardianId), [guardians, guardianId]);

  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(localDigits(existing?.phone ?? ""));
  const [relationship, setRelationship] = useState(existing?.relationship ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set only right after a successful ADD (never an edit of an existing
  // guardian) — switches this screen from the form to the WhatsApp opt-in
  // prompt below instead of navigating away immediately. A guardian who
  // isn't opted into the Twilio sandbox never receives an alert no matter
  // how correctly everything else is configured, so this can't be a step
  // the rider has to go find in settings afterward.
  const [justAdded, setJustAdded] = useState<{ name: string } | null>(null);

  const canSave = name.trim().length > 0 && phone.length === 10;

  const handleSave = async () => {
    if (!canSave) return;
    setSaveError(null);
    const input = {
      name: name.trim(),
      phone: toE164(phone),
      relationship: relationship.trim(),
      alertMode: existing?.alert_mode ?? DEFAULT_ALERT_MODE,
    };
    try {
      if (existing) {
        await updateGuardian.mutateAsync({ id: existing.id, input });
        navigation.goBack();
      } else {
        await addGuardian.mutateAsync(input);
        setJustAdded({ name: input.name });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this guardian — try again.");
    }
  };

  const optInLink = buildGuardianOptInLink();

  const handleShare = () => {
    if (!optInLink) return;
    Linking.openURL(optInLink).catch((err) => console.warn("[guardians] failed to open WhatsApp", err));
  };

  if (justAdded) {
    return (
      <ScreenBackground scroll contentStyle={styles.content}>
        <ScreenHeader title="ONE MORE STEP" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <GlassCard accentBorder>
            <Text style={[type.title, styles.optInHeading]}>{justAdded.name} added</Text>
            <Text style={[type.body, styles.optInCopy]}>
              Your guardian must tap this link and send the message before they can receive crash alerts — Angel
              can't do this step for them.
            </Text>
          </GlassCard>

          {optInLink ? (
            <PillButton title={`SHARE WITH ${justAdded.name.toUpperCase()} ON WHATSAPP`} onPress={handleShare} />
          ) : (
            <Text style={styles.optInMissing}>
              WhatsApp opt-in isn't configured yet — ask whoever set up this build to add
              EXPO_PUBLIC_TWILIO_WHATSAPP_NUMBER / EXPO_PUBLIC_TWILIO_JOIN_MESSAGE.
            </Text>
          )}

          <PillButton title="DONE" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScreenBackground>
    );
  }

  const handleDelete = async () => {
    if (!existing) return;
    setSaveError(null);
    try {
      await removeGuardian.mutateAsync(existing.id);
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't remove this guardian — try again.");
    }
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title={existing ? "EDIT GUARDIAN" : "ADD GUARDIAN"} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <GlassCard>
          <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Anita Sharma" />

          <View style={styles.fieldSpacing}>
            <Text style={[type.kicker, styles.dim]}>PHONE</Text>
            <View style={styles.phoneRow}>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>+91</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(localDigits(v))}
                placeholder="98450 11204"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
                maxLength={10}
                style={[styles.input, styles.phoneInput]}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Field label="RELATIONSHIP" value={relationship} onChangeText={setRelationship} placeholder="Spouse" last />
        </GlassCard>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <PillButton
          title={existing ? "SAVE CHANGES" : "ADD GUARDIAN"}
          onPress={handleSave}
          disabled={!canSave}
          loading={addGuardian.isPending || updateGuardian.isPending}
        />

        {existing && (
          <PillButton
            title="REMOVE GUARDIAN"
            variant="outline"
            onPress={handleDelete}
            loading={removeGuardian.isPending}
          />
        )}
      </View>
    </ScreenBackground>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad";
  last?: boolean;
}) {
  return (
    <View style={!last ? styles.fieldSpacing : undefined}>
      <Text style={[type.kicker, styles.dim]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType}
        style={styles.input}
        underlineColorAndroid="transparent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, marginTop: spacing.md },
  optInHeading: { color: colors.text },
  optInCopy: { color: colors.textMuted, marginTop: spacing.md },
  optInMissing: { color: colors.textDim, textAlign: "center", ...type.bodySmall },
  dim: { color: colors.textDim },
  fieldSpacing: { marginBottom: spacing.lg },
  input: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
  },
  errorText: { color: colors.accent, textAlign: "center", ...type.bodySmall },
  phoneRow: { flexDirection: "row", gap: spacing.md },
  codeBox: {
    marginTop: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.glassFillRaised,
  },
  codeText: { ...type.body, color: colors.text, fontFamily: type.button.fontFamily },
  phoneInput: { flex: 1, letterSpacing: 2 },
});
