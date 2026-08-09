import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { GuardianInput, useGuardians } from "../../hooks/useGuardians";
import { localDigits, toE164 } from "../../lib/phone";
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

  const { data: guardians, updateGuardian, removeGuardian } = useGuardians();
  const existing = useMemo(() => guardians?.find((g) => g.id === guardianId), [guardians, guardianId]);

  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(localDigits(existing?.phone ?? ""));
  const [relationship, setRelationship] = useState(existing?.relationship ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && phone.length === 10;

  // A brand-new guardian is never written to the database from here —
  // Save instead hands the not-yet-saved input off to GuardianOptInScreen,
  // which performs the actual insert itself once the rider resolves the
  // blocking WhatsApp opt-in step (sent, or explicitly deferred). See that
  // screen for why it has to be a real pushed stack screen rather than an
  // in-place modal. Editing an existing guardian is unaffected — that gate
  // is specifically about a guardian who's never had a chance to opt in.
  const handleSave = () => {
    if (!canSave) return;
    setSaveError(null);
    const input: GuardianInput = {
      name: name.trim(),
      phone: toE164(phone),
      relationship: relationship.trim(),
      alertMode: existing?.alert_mode ?? DEFAULT_ALERT_MODE,
    };

    if (existing) {
      setSaving(true);
      updateGuardian.mutate(
        { id: existing.id, input },
        {
          onSuccess: () => navigation.goBack(),
          onError: (err) => setSaveError(err instanceof Error ? err.message : "Couldn't save this guardian — try again."),
          onSettled: () => setSaving(false),
        }
      );
      return;
    }

    navigation.navigate("GuardianOptIn", { guardianName: input.name, pendingGuardianInput: input });
  };

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
          loading={saving}
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
