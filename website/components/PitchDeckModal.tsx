"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { usePitchDeckModal } from "@/lib/PitchDeckModalContext";

export default function PitchDeckModal() {
  const { isOpen, close } = usePitchDeckModal();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setSubmitted(false);
        setName("");
        setCompany("");
        setEmail("");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/85 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pitch-deck-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bracket-corner relative w-full max-w-md border border-glass bg-bg-elevated p-8"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-5 top-5 text-ink-dim transition-colors hover:text-accent"
            >
              <X size={18} />
            </button>

            {!submitted ? (
              <>
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">
                  [ INVESTORS ]
                </span>
                <h3 id="pitch-deck-modal-title" className="mt-3 font-heading text-2xl font-bold text-white">
                  Request Pitch Deck
                </h3>
                <p className="mt-2 font-body text-sm text-ink-muted">
                  Tell us who you are and we'll send our current deck and data room access.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="pd-name" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
                      Name
                    </label>
                    <input
                      id="pd-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pd-company"
                      className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim"
                    >
                      Company / Fund
                    </label>
                    <input
                      id="pd-company"
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
                      placeholder="Acme Ventures"
                    />
                  </div>
                  <div>
                    <label htmlFor="pd-email" className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
                      Email
                    </label>
                    <input
                      id="pd-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full border border-glass bg-transparent px-4 py-3 font-body text-white placeholder:text-ink-dim focus:border-accent focus:outline-none"
                      placeholder="jane@acmevc.com"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full border border-accent bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest2 text-white transition-colors duration-100 hover:border-accent-hover hover:bg-accent-hover"
                  >
                    Submit Request
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center border border-accent text-accent">
                  <Check size={22} />
                </div>
                <h3 className="mt-6 font-heading text-xl font-bold text-white">Request received</h3>
                <p className="mt-3 max-w-xs font-body text-sm leading-relaxed text-ink-muted">
                  Thanks, {name.split(" ")[0] || "there"} — someone from our team will follow up at {email} with
                  the deck and data room access shortly.
                </p>
                <button
                  onClick={close}
                  className="mt-8 border border-glass px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest2 text-white transition-colors hover:border-accent hover:text-accent"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
