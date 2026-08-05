"use client";

import { createContext, useContext, useMemo, useState } from "react";

type PitchDeckModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const PitchDeckModalContext = createContext<PitchDeckModalContextValue | null>(null);

export function PitchDeckModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return <PitchDeckModalContext.Provider value={value}>{children}</PitchDeckModalContext.Provider>;
}

export function usePitchDeckModal() {
  const ctx = useContext(PitchDeckModalContext);
  if (!ctx) throw new Error("usePitchDeckModal must be used within PitchDeckModalProvider");
  return ctx;
}
