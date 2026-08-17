import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { ButtonRow, PillButton } from "./PillButton";
import { colors, radius, spacing, type } from "../theme";

interface Props {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// App-wide replacement for native Alert.alert wherever a confirmation needs
// a loading state and/or an inline error (native Alert supports neither) —
// currently just account deletion, see SettingsScreen.
export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[type.title, styles.title]}>{title}</Text>
          <Text style={[type.body, styles.body]}>{body}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <ButtonRow>
            <View style={styles.buttonHalf}>
              <PillButton title={cancelLabel} variant="outline" onPress={onCancel} disabled={loading} />
            </View>
            <View style={styles.buttonHalf}>
              <PillButton
                title={confirmLabel}
                variant={destructive ? "danger" : "primary"}
                onPress={onConfirm}
                loading={loading}
                disabled={loading}
              />
            </View>
          </ButtonRow>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: colors.text },
  body: { color: colors.textMuted },
  error: { ...type.bodySmall, color: colors.danger },
  buttonHalf: { flex: 1 },
});
