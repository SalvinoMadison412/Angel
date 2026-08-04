"use client";

import { motion } from "framer-motion";
import Container from "../Container";
import Button from "../Button";
import DeviceRender from "../DeviceRender";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden border-b border-divider pt-[72px]">
      <div className="dot-grid-faint fade-mask-b pointer-events-none absolute inset-0" />
      <motion.div
        className="pointer-events-none absolute -right-40 top-1/4 h-[560px] w-[560px] rounded-full bg-accent/20 blur-[140px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-white/5 blur-[120px]" />

      <Container className="relative grid grid-cols-1 items-center gap-16 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-0">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest2 text-accent"
          >
            <span className="h-px w-6 bg-accent" />
            [ AGL v1 — CRASH DETECTION SYSTEM ]
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="font-heading text-[42px] font-bold leading-[1.08] tracking-tight text-white sm:text-[56px] lg:text-[64px]"
          >
            Drive safer.
            <br />
            React faster.
            <br />
            <span className="text-gradient-accent">Survive anything.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-7 max-w-lg font-body text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            Angel builds AGL v1 — a crash detection device that senses impact in milliseconds and automatically
            alerts emergency contacts and responders with your exact location, so help is already moving before
            you can reach for your phone.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <Button href="/product" size="lg" icon>
              Buy AGL v1
            </Button>
            <Button href="#how-it-works" variant="secondary" size="lg">
              Learn How It Works
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-divider pt-6"
          >
            {[
              ["< 100ms", "Detection"],
              ["500K+", "Protected"],
              ["99.98%", "Uptime"],
            ].map(([stat, label]) => (
              <div key={label}>
                <div className="font-heading text-xl font-bold text-white sm:text-2xl">{stat}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest2 text-ink-dim">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="bracket-corner border border-glass bg-glass-fill p-10">
            <DeviceRender className="w-full drop-shadow-2xl" />
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
