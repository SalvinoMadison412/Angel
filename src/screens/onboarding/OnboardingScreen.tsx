import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PillButton, ScreenBackground, StepProgress } from "../../components";
import { useDevice, useEmergencyProfile, useGuardians, useProfile } from "../../hooks";
import { colors, radius, spacing, type } from "../../theme";
import { BloodGroup } from "../../types/database";

const TOTAL_STEPS = 4;
const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MAX_CONTACTS = 3;

function isValidDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Runs once after signup, before the main app — collects what actually
 * matters for an emergency response (see AGENTS.md's onboarding brief).
 * One wizard component with internal step state, matching the existing
 * CalibrationWizard pattern rather than a separate nav stack: there's no
 * "back" between steps, and resuming is driven by profiles.onboarding_step,
 * not by pushed routes.
 */
export function OnboardingScreen() {
  const profile = useProfile();
  const emergencyProfile = useEmergencyProfile();
  const guardians = useGuardians();
  const device = useDevice();

  const [step, setStep] = useState(1);
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current || !profile.data) return;
    resumedRef.current = true;
    const resumeStep = profile.data.onboarding_step;
    if (resumeStep > 1 && resumeStep <= TOTAL_STEPS) setStep(resumeStep);
  }, [profile.data]);

  const advanceTo = async (next: number) => {
    if (next > TOTAL_STEPS) {
      await profile.completeOnboarding.mutateAsync();
      return;
    }
    await profile.setOnboardingStep.mutateAsync(next);
    setStep(next);
  };

  return (
    <ScreenBackground scroll contentStyle={styles.content}>
      <View style={styles.progressWrap}>
        <StepProgress steps={TOTAL_STEPS} current={step} />
        <Text style={[type.kicker, styles.stepLabel]}>STEP {step} OF {TOTAL_STEPS}</Text>
      </View>

      {step === 1 && <AboutYouStep emergencyProfile={emergencyProfile} onContinue={() => advanceTo(2)} />}
      {step === 2 && <MedicalStep emergencyProfile={emergencyProfile} onContinue={() => advanceTo(3)} />}
      {step === 3 && <ContactsStep guardians={guardians} onContinue={() => advanceTo(4)} />}
      {step === 4 && <BikeStep device={device} onContinue={() => advanceTo(5)} />}
    </ScreenBackground>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 1 — About You (required, no skip: everything downstream needs a
// name and DOB to mean anything).
// ───────────────────────────────────────────────────────────────────────
function AboutYouStep({
  emergencyProfile,
  onContinue,
}: {
  emergencyProfile: ReturnType<typeof useEmergencyProfile>;
  onContinue: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !emergencyProfile.data) return;
    initialized.current = true;
    setFullName(emergencyProfile.data.full_name ?? "");
    if (emergencyProfile.data.date_of_birth) {
      const [y, m, d] = emergencyProfile.data.date_of_birth.split("-");
      setYear(y);
      setMonth(m);
      setDay(d);
    }
  }, [emergencyProfile.data]);

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const dateValid = isValidDate(dayNum, monthNum, yearNum);
  const canContinue = fullName.trim().length > 0 && dateValid;

  const handleContinue = async () => {
    if (!canContinue) return;
    await emergencyProfile.save.mutateAsync({
      fullName: fullName.trim(),
      dateOfBirth: `${yearNum}-${pad2(monthNum)}-${pad2(dayNum)}`,
    });
    onContinue();
  };

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>About you</Text>
      <Text style={[type.body, styles.copy]}>
        Responders and guardians see this the moment a crash is confirmed — it's how they know who they're looking
        for.
      </Text>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>FULL NAME</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Anita Sharma"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          underlineColorAndroid="transparent"
        />
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>DATE OF BIRTH</Text>
        <View style={styles.dobRow}>
          <TextInput
            value={day}
            onChangeText={(v) => setDay(v.replace(/\D/g, "").slice(0, 2))}
            placeholder="DD"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            maxLength={2}
            style={[styles.input, styles.dobInput]}
            underlineColorAndroid="transparent"
          />
          <TextInput
            value={month}
            onChangeText={(v) => setMonth(v.replace(/\D/g, "").slice(0, 2))}
            placeholder="MM"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            maxLength={2}
            style={[styles.input, styles.dobInput]}
            underlineColorAndroid="transparent"
          />
          <TextInput
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
            placeholder="YYYY"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            maxLength={4}
            style={[styles.input, styles.dobInputYear]}
            underlineColorAndroid="transparent"
          />
        </View>
      </GlassCard>

      <PillButton
        title="CONTINUE"
        onPress={handleContinue}
        disabled={!canContinue}
        loading={emergencyProfile.save.isPending}
        style={styles.cta}
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 2 — Medical (blood group hard-to-skip, conditions freely optional).
// ───────────────────────────────────────────────────────────────────────
function MedicalStep({
  emergencyProfile,
  onContinue,
}: {
  emergencyProfile: ReturnType<typeof useEmergencyProfile>;
  onContinue: () => void;
}) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [conditions, setConditions] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !emergencyProfile.data) return;
    initialized.current = true;
    setBloodGroup(emergencyProfile.data.blood_group);
    setConditions(emergencyProfile.data.medical_conditions ?? "");
  }, [emergencyProfile.data]);

  const handleContinue = async () => {
    await emergencyProfile.save.mutateAsync({
      bloodGroup,
      medicalConditions: conditions.trim() || null,
    });
    onContinue();
  };

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Medical information</Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE ASK</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          Your blood group and conditions are shared with emergency responders only at the moment of a confirmed
          crash alert — never displayed anywhere else in the app, never sold, never used for anything else. Update
          or remove it anytime from Settings.
        </Text>
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>BLOOD GROUP</Text>
        <View style={styles.bloodGrid}>
          {BLOOD_GROUPS.map((group) => (
            <Pressable
              key={group}
              style={[styles.bloodOption, bloodGroup === group && styles.bloodOptionActive]}
              onPress={() => setBloodGroup(group)}
            >
              <Text style={[styles.bloodText, bloodGroup === group && styles.bloodTextActive]}>{group}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>ALLERGIES / CONDITIONS (OPTIONAL)</Text>
        <TextInput
          value={conditions}
          onChangeText={setConditions}
          placeholder="e.g. Type 1 diabetes, penicillin allergy"
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={[styles.input, styles.multilineInput]}
        />
      </GlassCard>

      <PillButton
        title={bloodGroup ? "CONTINUE" : "SKIP (NOT RECOMMENDED)"}
        variant={bloodGroup ? "primary" : "outline"}
        onPress={handleContinue}
        loading={emergencyProfile.save.isPending}
        style={styles.cta}
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 3 — Emergency contacts (hard-to-skip). Writes real Guardian rows —
// same table the Guardians tab and the emergency pipeline already use, so
// there's one source of truth, not a parallel onboarding-only draft.
// ───────────────────────────────────────────────────────────────────────
function ContactsStep({
  guardians,
  onContinue,
}: {
  guardians: ReturnType<typeof useGuardians>;
  onContinue: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const existing = guardians.data ?? [];
  const canAddMore = existing.length < MAX_CONTACTS;
  const canAdd = canAddMore && name.trim().length > 0 && phone.trim().length >= 10;

  const handleAdd = async () => {
    if (!canAdd) return;
    await guardians.addGuardian.mutateAsync({
      name: name.trim(),
      phone: phone.trim(),
      relationship: "",
      alertMode: "call",
    });
    setName("");
    setPhone("");
  };

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Emergency contacts</Text>

      <GlassCard accentBorder>
        <Text style={[type.kicker, styles.accentText]}>WHY WE NEED THIS</Text>
        <Text style={[type.bodySmall, styles.copy, styles.consentCopy]}>
          These are the people Angel calls or texts the moment a crash is confirmed — before anyone else. At least
          one contact is the difference between a silent crash and someone knowing to help.
        </Text>
      </GlassCard>

      {existing.length > 0 && (
        <GlassCard style={styles.contactList} padded={false}>
          {existing.map((g, index) => (
            <View key={g.id} style={[styles.contactRow, index > 0 && styles.contactRowDivider]}>
              <View>
                <Text style={[type.body, styles.contactName]}>{g.name}</Text>
                <Text style={[type.bodySmall, styles.dim]}>{g.phone}</Text>
              </View>
              <Pressable onPress={() => guardians.removeGuardian.mutate(g.id)} hitSlop={12}>
                <Text style={styles.removeText}>REMOVE</Text>
              </Pressable>
            </View>
          ))}
        </GlassCard>
      )}

      {canAddMore ? (
        <GlassCard>
          <Text style={[type.kicker, styles.dim]}>
            {existing.length === 0 ? "FIRST CONTACT" : `CONTACT ${existing.length + 1} OF ${MAX_CONTACTS}`}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.textDim}
            style={[styles.input, styles.fieldSpacing]}
            underlineColorAndroid="transparent"
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98450 11204"
            placeholderTextColor={colors.textDim}
            keyboardType="phone-pad"
            style={styles.input}
            underlineColorAndroid="transparent"
          />
          <PillButton
            title="+ ADD CONTACT"
            variant="outline"
            onPress={handleAdd}
            disabled={!canAdd}
            loading={guardians.addGuardian.isPending}
            style={styles.addContactButton}
          />
        </GlassCard>
      ) : (
        <Text style={[type.bodySmall, styles.dim, styles.maxedText]}>
          You've added the maximum of {MAX_CONTACTS} contacts — manage these anytime from the Guardians tab.
        </Text>
      )}

      <PillButton
        title={existing.length > 0 ? "CONTINUE" : "SKIP (NOT RECOMMENDED)"}
        variant={existing.length > 0 ? "primary" : "outline"}
        onPress={onContinue}
        style={styles.cta}
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Step 4 — Bike (freely skippable). Stored on the same device row the
// calibration flow uses, so it stays linked to whatever sensor gets paired.
// ───────────────────────────────────────────────────────────────────────
function BikeStep({ device, onContinue }: { device: ReturnType<typeof useDevice>; onContinue: () => void }) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !device.data) return;
    initialized.current = true;
    setMake(device.data.bike_make ?? "");
    setModel(device.data.bike_model ?? "");
  }, [device.data]);

  const handleContinue = async () => {
    if (make.trim() || model.trim()) {
      await device.saveBikeInfo.mutateAsync({ bikeMake: make.trim() || null, bikeModel: model.trim() || null });
    }
    onContinue();
  };

  return (
    <View style={styles.stepBody}>
      <Text style={[type.title, styles.heading]}>Your bike</Text>
      <Text style={[type.body, styles.copy]}>
        Purely organizational — this links your bike to whichever CrashDetector sensor you pair later. Skip and add
        it anytime from the Device tab.
      </Text>

      <GlassCard>
        <Text style={[type.kicker, styles.dim]}>MAKE</Text>
        <TextInput
          value={make}
          onChangeText={setMake}
          placeholder="Honda"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.fieldSpacing]}
          underlineColorAndroid="transparent"
        />
        <Text style={[type.kicker, styles.dim]}>MODEL</Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder="Activa 125"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          underlineColorAndroid="transparent"
        />
      </GlassCard>

      <PillButton
        title="FINISH"
        onPress={handleContinue}
        loading={device.saveBikeInfo.isPending}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  progressWrap: { marginTop: spacing.lg, marginBottom: spacing.xl },
  stepLabel: { color: colors.textDim, textAlign: "center", marginTop: spacing.md },
  stepBody: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { color: colors.text },
  copy: { color: colors.textMuted },
  consentCopy: { marginTop: spacing.md },
  dim: { color: colors.textDim },
  accentText: { color: colors.accent },
  input: {
    ...type.body,
    color: colors.text,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glassFillRaised,
  },
  multilineInput: { minHeight: 96 },
  fieldSpacing: { marginBottom: spacing.lg },
  dobRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  dobInput: { flex: 1, marginTop: 0, textAlign: "center" },
  dobInputYear: { flex: 1.6, marginTop: 0, textAlign: "center" },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  bloodOption: {
    width: "22%",
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    backgroundColor: colors.glassFillRaised,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  bloodOptionActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  bloodText: { color: colors.textMuted, fontFamily: type.button.fontFamily, fontSize: 13 },
  bloodTextActive: { color: colors.accent },
  contactList: { paddingVertical: spacing.sm },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  contactRowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  contactName: { color: colors.text },
  removeText: { color: colors.textDim, fontFamily: type.button.fontFamily, fontSize: 11, letterSpacing: 1 },
  addContactButton: { marginTop: spacing.lg },
  maxedText: { textAlign: "center" },
  cta: { marginTop: spacing.sm },
});
