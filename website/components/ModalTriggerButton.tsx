"use client";

import { ArrowRight } from "lucide-react";
import { ButtonHTMLAttributes } from "react";
import { buttonClasses, ButtonVariant, ButtonSize } from "@/lib/buttonStyles";

type ModalTriggerButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  className?: string;
  children: React.ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function ModalTriggerButton({
  variant = "primary",
  size = "md",
  icon = false,
  className = "",
  children,
  ...rest
}: ModalTriggerButtonProps) {
  return (
    <button type="button" className={buttonClasses(variant, size, className)} {...rest}>
      {children}
      {icon && <ArrowRight size={14} className="transition-transform duration-100 group-hover:translate-x-1" />}
    </button>
  );
}
