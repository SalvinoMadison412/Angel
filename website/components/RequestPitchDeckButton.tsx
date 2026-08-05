"use client";

import { usePitchDeckModal } from "@/lib/PitchDeckModalContext";
import ModalTriggerButton from "./ModalTriggerButton";
import { ButtonVariant, ButtonSize } from "@/lib/buttonStyles";

export default function RequestPitchDeckButton({
  variant = "primary",
  size = "md",
  icon = false,
  className = "",
  children = "Request Pitch Deck",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { open } = usePitchDeckModal();

  return (
    <ModalTriggerButton variant={variant} size={size} icon={icon} className={className} onClick={open}>
      {children}
    </ModalTriggerButton>
  );
}
