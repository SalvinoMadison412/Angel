import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, ScreenHeader } from "../../components";
import { AlertMode } from "../../types/database";
import { useGuardians } from "../../hooks/useGuardians";
import { colors, spacing, type } from "../../theme";
import { RootStackNavigation, RootStackParamList } from "../../navigation/types";

export function GuardianFormScreen() {
  const navigation = useNavigation<RootStackNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, "GuardianForm">>();
  const { guardianId } = route.params;

  const { data: guardians, addGuardian, updateGuardian, removeGuardian } = useGuardians();
  const existing = useMemo(() => guardians?.find((g) => g.id === guardianId), [guardians, guardianId]);

  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [relationship, setRelationship] = useState(existing?.relationship ?? "");
  const [alertMode, setAlertMode] = useState<AlertMode>(existing?.alert_mode ?? "call");

  const canSave = name.trim().length > 0 && phone.trim().length >= 10;

  const handleSave = async () => {
    if (!canSave) return;
    const input = { name: name.trim(), phone: phone.trim(), relationship: relationship.trim(), alertMode };
    if (existing) {
      await updateGuardian.mutateAsync({ id: existing.id, input });
    } else {
      await addGuardian.mutateAsync(input);
    }
    navigation.goBack();
  };

  const handleDelete = async () => {
    if (!existing) return;
    await removeGuardian.mutateAsync(existing.id);
    navigation.goBack();
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <ScreenHeader title={existing ? "EDIT GUARDIAN" : "ADD GUARDIAN"} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <GlassCard>
          <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Anita Sharma" />
          <Field
            label="PHONE"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98450 11204"
            keyboardType="phone-pad"
          />
          <Field label="RELATIONSHIP" value={relationship} onChangeText={setRelationship} placeholder="Spouse" last />
        </GlassCard>

        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>ALERT MODE</Text>
          <View style={styles.modeRow}>
            {(["call", "sms"] as AlertMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.modeOption, alertMode === mode && styles.modeOptionActive]}
                onPress={() => setAlertMode(mode)}
              >
                <Text style={[styles.modeText, alertMode === mode && styles.modeTextActive]}>
                  {mode === "call" ? "CALL" : "SMS ONLY"}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

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
  modeRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  modeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modeOptionActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  modeText: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 12 },
  modeTextActive: { color: colors.accent },
});
